/**
 * Test calls from /admin/apeluri: an imaginary order (first name, scenario, products) and a number; the agent
 * calls with exactly the variables a real recovery call would carry, built from today's catalog, prices and
 * promotions. Nothing real is touched: no lead, no order, no consent, no code email, no CRM. The agent's tools
 * answer from this test's own context (call id "test-<id>") and the result is kept in test_calls only.
 *
 * Only with the ticked confirmation that the person agreed to the test call; never to a number on the
 * do-not-call list.
 */
import 'server-only'
import { randomUUID } from 'node:crypto'
import { getProduct, resolveLine, variantLabel } from '@/content/catalog'
import { CALL_CODE, PROMOTIONS } from '@/config/promotions'
import { romanianE164 } from '@/lib/consent/calling'
import { formatLei } from '@/lib/money'
import { priceLines } from '@/lib/promotions'
import type { Config } from '@/server/config'
import type { Queryable } from '@/server/db'
import { elevenlabs } from '@/server/integrations/elevenlabs'
import { callBlocklist } from './blocklist'
import { openingLine, RECOVERY_PERCENT } from './offer'

export type TestCallInput = {
  phone: string
  firstName: string
  scenario: 'cart' | 'price_reveal'
  funnel: 'visible_price' | 'gated_price'
  items: { productId: string; variantId?: string; quantity: number }[]
  emailSent: boolean
}

export type TestCall = {
  id: string
  phone: string
  scenario: string
  vars: Record<string, string | number>
  status: string
  conversationId: string | null
  outcome: string | null
  agentOutcome: string | null
  durationSecs: number | null
  error: string | null
  createdAt: Date
}

/** The variables the agent gets, built like a real call's (calls.ts callVariables) from the imaginary order. */
export function testVariables(id: string, x: TestCallInput) {
  const lines = x.items.flatMap((i) => {
    const r = resolveLine(i.productId, i.variantId)
    return r && r.unit !== null ? [{ ...i, name: r.product.name, variant: r.variant ? variantLabel(r.product, r.variant) : null, unit: r.unit }] : []
  })
  const names = [...new Set(lines.map((l) => l.name))].join(', ')
  const cart = x.scenario === 'cart'
  const pricing = priceLines(lines.map((l, i) => ({ key: String(i), productId: l.productId, quantity: l.quantity, unitAmount: l.unit })))
  const promo = !cart && lines[0] ? PROMOTIONS.find((p) => (p.products as string[]).includes(lines[0].productId)) : undefined
  return {
    call_id: `test-${id}`,
    opening_line: openingLine({ firstName: x.firstName, cart, productNames: names }),
    customer_first_name: x.firstName,
    funnel_type: x.funnel,
    abandonment_type: cart ? 'cos_nefinalizat' : 'oferta_solicitata',
    product_names: names,
    product_quantities: cart ? lines.map((l) => `${l.quantity} × ${l.name}${l.variant ? ` (${l.variant})` : ''}`).join(', ') : '',
    cart_total: cart ? formatLei(pricing.totalMinor) : '',
    existing_discounts: cart ? pricing.promotions.map((a) => `${a.label}: −${formatLei(a.amountMinor)}`).join('; ') : promo ? `promoție disponibilă: ${promo.line}` : '',
    recovery_discount_percent: RECOVERY_PERCENT,
    recovery_code: CALL_CODE,
    checkout_recovery_url: '',
    recovery_email_sent: x.emailSent ? 'da' : 'nu',
  }
}

export type TestCallProblem = 'no_phone' | 'blocked' | 'no_products' | 'not_configured'

export async function placeTestCall(q: Queryable, c: Config, x: TestCallInput, by: string): Promise<{ ok: true; call: TestCall } | { ok: false; problem: TestCallProblem; message: string }> {
  const phone = romanianE164(x.phone)
  if (!phone) return { ok: false, problem: 'no_phone', message: 'Numărul nu este un număr românesc valid.' }
  if (await callBlocklist.has(q, phone)) return { ok: false, problem: 'blocked', message: 'Numărul este pe lista „nu suna”.' }
  if (!x.items.some((i) => getProduct(i.productId))) return { ok: false, problem: 'no_products', message: 'Alege cel puțin un produs.' }
  if (!c.elevenlabs) return { ok: false, problem: 'not_configured', message: 'ElevenLabs nu este configurat (cheie, agent, număr).' }
  const id = randomUUID()
  const vars = testVariables(id, x)
  await q.query('insert into test_calls (id, phone, scenario, vars, status, created_by) values ($1, $2, $3, $4, $5, $6)', [id, phone, x.scenario, JSON.stringify(vars), 'dialing', by.slice(0, 80)])
  try {
    const r = await elevenlabs.outboundCall(c.elevenlabs, phone, vars)
    if (!r.success || !r.conversation_id) throw new Error(`ElevenLabs refused the call: ${r.message}`.slice(0, 300))
    await q.query('update test_calls set conversation_id = $2, updated_at = now() where id = $1', [id, r.conversation_id])
  } catch (e) {
    await q.query("update test_calls set status = 'failed', error = $2, updated_at = now() where id = $1", [id, String((e as Error).message ?? e).slice(0, 300)])
  }
  return { ok: true, call: (await testCalls.byId(q, id))! }
}

const toTest = (r: Record<string, unknown>): TestCall => ({
  id: r.id as string,
  phone: r.phone as string,
  scenario: r.scenario as string,
  vars: r.vars as Record<string, string | number>,
  status: r.status as string,
  conversationId: (r.conversation_id as string) ?? null,
  outcome: (r.outcome as string) ?? null,
  agentOutcome: (r.agent_outcome as string) ?? null,
  durationSecs: r.duration_secs == null ? null : Number(r.duration_secs),
  error: (r.error as string) ?? null,
  createdAt: new Date(r.created_at as string),
})

export const testCalls = {
  async byId(q: Queryable, id: string) {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null
    const { rows } = await q.query('select * from test_calls where id = $1', [id])
    return rows[0] ? toTest(rows[0]) : null
  },
  async recent(q: Queryable, limit = 20) {
    return (await q.query('select * from test_calls order by created_at desc limit $1', [limit])).rows.map(toTest)
  },
  /** The post-call report of a test call (webhook or read-back): outcome and duration only, nothing else changes. */
  async finish(q: Queryable, id: string, r: { status: 'completed' | 'failed'; outcome: string | null; durationSecs: number | null; error?: string | null }) {
    await q.query('update test_calls set status = $2, outcome = coalesce($3, outcome), duration_secs = $4, error = coalesce($5, error), updated_at = now() where id = $1', [id, r.status, r.outcome, r.durationSecs, r.error ?? null])
  },
}
