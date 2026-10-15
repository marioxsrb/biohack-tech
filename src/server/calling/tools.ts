/**
 * The ElevenLabs agent's server tools, answered from Supabase. The agent sees only what one call needs (first
 * name, products, the offer the server made, the email's status) and can only record things about that call:
 * an outcome, a request for a person, a refusal. It can never change an order, a payment, an invoice or a code.
 *
 * Every request carries the call id the agent was given; only a call that is ringing or in progress (started
 * in the last two hours) answers. The id "test" answers sample data and writes nothing (the agent's test in
 * the ElevenLabs dashboard).
 */
import 'server-only'
import type { Config } from '@/server/config'
import type { Queryable } from '@/server/db'
import { jobs } from '@/server/jobs/outbox'
import { leads } from '@/server/leads'
import { promoCodes } from '@/server/promo'
import { calls, callScenario, optOut, type Call } from './calls'
import { cartTotal, describeItems, formatExpiry, lei, RECOVERY_PERCENT } from './offer'

/** The header the agent's server tools send (set in the agent's tool configuration, never in a prompt). */
export const TOOL_SECRET_HEADER = 'x-biohack-tool-secret'

export const CALL_TOOLS = ['get_recovery_context', 'check_discount', 'recovery_email_status', 'record_outcome', 'request_human_follow_up', 'record_opt_out'] as const
export type CallTool = (typeof CALL_TOOLS)[number]

/** Outcomes the agent may record during the call (the line outcomes come from the provider). */
const AGENT_OUTCOMES = ['interested', 'more_info', 'human_follow_up', 'not_interested', 'opted_out'] as const

const ACTIVE_HOURS = 2
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max) : '')

const SAMPLE = {
  customer_first_name: 'Ana',
  funnel_type: 'visible_price',
  abandonment_type: 'cos_nefinalizat',
  product_names: 'NEUROS Calm',
  product_quantities: '1 × NEUROS Calm',
  cart_total: '6.380 lei',
  discount: { eligible: true, percent: RECOVERY_PERCENT, code: 'BTTEST01', expires: 'mâine, ora 12:00', combinable_with_promotions: false },
  recovery_email: { sent: true, status: 'sent' },
}

export type ToolResult = { status: number; body: Record<string, unknown> }

async function activeCall(q: Queryable, id: string): Promise<Call | null> {
  const call = await calls.byId(q, id)
  if (!call) return null
  if (call.status !== 'dialing' && call.status !== 'dry_run') return null
  if (Date.now() - call.createdAt.getTime() > ACTIVE_HOURS * 3_600_000) return null
  return call
}

async function discountState(q: Queryable, call: Call, email: string) {
  if (!call.discountCode) return { eligible: false, reason: 'no_code' }
  const checked = await promoCodes.check(q, call.discountCode, { email })
  if (!checked.ok) return { eligible: false, reason: checked.problem }
  return {
    eligible: true,
    percent: checked.code.value,
    code: checked.code.code,
    expires: checked.code.endsAt ? formatExpiry(checked.code.endsAt) : '',
    combinable_with_promotions: false,
    rule: 'Se aplică oferta mai avantajoasă: fie promoția din coș, fie codul de 10% din prețul întreg, nu amândouă.',
  }
}

const emailState = (call: Call) => ({ sent: call.emailStatus === 'sent', status: call.emailStatus ?? 'not_sent' })

export async function runCallTool(q: Queryable, c: Config, tool: string, body: Record<string, unknown>): Promise<ToolResult> {
  if (!(CALL_TOOLS as readonly string[]).includes(tool)) return { status: 404, body: { error: 'unknown tool' } }
  const callId = clean(body.call_id, 64)
  if (callId === 'test') return { status: 200, body: tool === 'get_recovery_context' ? SAMPLE : tool === 'check_discount' ? SAMPLE.discount : tool === 'recovery_email_status' ? SAMPLE.recovery_email : { ok: true, test: true } }
  const call = await activeCall(q, callId)
  if (!call) return { status: 404, body: { error: 'no active call' } }
  const lead = await leads.byId(q, call.leadId)
  if (!lead) return { status: 404, body: { error: 'no active call' } }

  switch (tool as CallTool) {
    case 'get_recovery_context': {
      const items = describeItems(lead)
      const cart = callScenario(lead) === 'cart'
      return {
        status: 200,
        body: {
          customer_first_name: lead.name?.split(' ')[0] ?? '',
          funnel_type: lead.funnel,
          abandonment_type: cart ? 'cos_nefinalizat' : 'oferta_solicitata',
          product_names: items.names,
          product_quantities: cart ? items.quantities : '',
          cart_total: lei(cartTotal(lead)),
          discount: await discountState(q, call, lead.email),
          recovery_email: emailState(call),
        },
      }
    }
    case 'check_discount':
      return { status: 200, body: await discountState(q, call, lead.email) }
    case 'recovery_email_status':
      return { status: 200, body: emailState(call) }
    case 'record_outcome': {
      const outcome = clean(body.outcome, 30)
      if (!(AGENT_OUTCOMES as readonly string[]).includes(outcome)) return { status: 422, body: { error: `outcome must be one of ${AGENT_OUTCOMES.join(', ')}` } }
      await calls.update(q, call.id, { agent_outcome: outcome })
      if (outcome === 'opted_out') await recordOptOut(q, c, call, lead)
      return { status: 200, body: { ok: true } }
    }
    case 'request_human_follow_up': {
      await calls.update(q, call.id, { follow_up: true, follow_up_reason: clean(body.reason, 200) || null })
      await jobs.enqueue(q, { kind: 'call.notify', dedupeKey: `call.notify:${call.id}`, payload: { callId: call.id } })
      return { status: 200, body: { ok: true, message: 'Un coleg va reveni în cel mai scurt timp, în timpul programului.' } }
    }
    case 'record_opt_out':
      await recordOptOut(q, c, call, lead)
      return { status: 200, body: { ok: true, message: 'Refuzul a fost înregistrat: nu mai sunăm și nu mai trimitem emailuri comerciale.' } }
  }
}

/** Effective at once (not at the end of the call): no further call, no marketing email. */
async function recordOptOut(q: Queryable, c: Config, call: Call, lead: { id: string; email: string }) {
  await calls.update(q, call.id, { opted_out: true, agent_outcome: 'opted_out' })
  await q.query("update leads set call_status = 'stopped', call_outcome = 'opted_out', updated_at = now() where id = $1", [lead.id])
  await q.query(`update jobs set status = 'skipped', last_error = 'opted out by phone', updated_at = now() where kind in ('call.attempt', 'lead.recovery') and payload->>'leadId' = $1 and status in ('pending', 'retry')`, [lead.id])
  await optOut(q, c, call, lead)
}
