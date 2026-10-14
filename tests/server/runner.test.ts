import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_PRICES } from '../fixtures'

vi.mock('@/config/prices', () => ({ PRICES_RON: { ...TEST_PRICES, 'balance-wave': 638000 } }))
vi.mock('next/server', () => ({ after: (fn: () => unknown) => void fn() }))

const { freshDb, person, company, lines } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { orders } = await import('@/server/orders/repository')
const { jobs } = await import('@/server/jobs/outbox')
const { runDueJobs } = await import('@/server/jobs/runner')
const { STAGES } = await import('@/server/integrations/ghl')

type Call = { url: string; method: string; body: Record<string, unknown> | null }
let calls: Call[]
let fgoMode: 'ok' | 'timeout' | 'reject'
let db: Awaited<ReturnType<typeof freshDb>>

function fakeApis() {
  calls = []
  let invoiceNo = 100
  const opps = new Map<string, string>()
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    const body = init.body ? JSON.parse(String(init.body)) : null
    calls.push({ url, method: init.method ?? 'GET', body })
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } })
    if (url.includes('/factura/emitere')) {
      if (fgoMode === 'timeout') return json({ Success: false, Message: 'Timpul maxim pentru emiterea unei facturi a expirat. Factura nu a fost emisa si este necesar sa reincercati. [3]' })
      if (fgoMode === 'reject') return json({ Success: false, Message: 'Codul unic nu este valid' })
      return json({ Success: true, Factura: { Serie: 'BT', Numar: String(++invoiceNo), Link: 'https://fgo/f.pdf' } })
    }
    if (url.includes('/contacts/search')) return json({ contacts: [] })
    if (url.includes('/contacts/upsert')) return json({ contact: { id: 'contact-1' }, new: false })
    if (url.includes('/tags')) return json({ tags: body?.tags })
    if (url.includes('/opportunities/pipelines')) return json({ pipelines: [{ id: 'pipe1', stages: Object.values(STAGES).map((n, i) => ({ id: `stage-${i}`, name: n })) }] })
    if (url.includes('/opportunities/search')) {
      const q = new URL(url).searchParams.get('q')!
      return json({ opportunities: opps.has(q) ? [{ id: opps.get(q), name: `${q} · x` }] : [] })
    }
    if (url.endsWith('/opportunities/') && init.method === 'POST') {
      const id = `opp-${opps.size + 1}`
      opps.set(String(body!.name).split(' · ')[0], id)
      return json({ opportunity: { id } }, 201)
    }
    if (url.includes('/opportunities/') && init.method === 'PUT') return json({ opportunity: {} })
    if (url.includes('/conversations/messages')) return json({ messageId: 'm1', emailMessageId: 'e1' })
    return json({ message: 'not mocked' }, 404)
  })
}

const count = (part: string, method?: string) => calls.filter((c) => c.url.includes(part) && (!method || c.method === method)).length

beforeEach(async () => {
  db = await freshDb()
  fgoMode = 'ok'
  fakeApis()
})
afterEach(() => vi.unstubAllGlobals())

describe('downstream integrations', () => {
  it('card order paid twice (webhook retry): one invoice, one opportunity, one confirmation email', async () => {
    const { order } = await svc.placeOrder({ lines: lines([{ productId: 'balance-wave', quantity: 1 }]), form: person, attemptId: 'attempt-1' })
    await svc.confirmPayment(order.id, 'stripe.webhook', { amountMinor: 638000, currency: 'ron' })
    await svc.confirmPayment(order.id, 'stripe.webhook', { amountMinor: 638000, currency: 'ron' })
    await runDueJobs()
    await runDueJobs()
    expect(count('/factura/emitere')).toBe(1)
    expect(count('/opportunities/', 'POST')).toBe(1)
    // order confirmation + invoice, each exactly once
    expect(calls.filter((c) => c.url.includes('/conversations/messages')).map((c) => c.body!.subject)).toEqual([expect.stringContaining('Comanda ta Biohack Tech'), expect.stringContaining('Factura pentru comanda')])
    const o = (await orders.byId(db, order.id))!
    expect(o).toMatchObject({ invoiceStatus: 'issued', fgoInvoiceNumber: '101', ghlContactId: 'contact-1', ghlOpportunityId: 'opp-1' })
    const email = calls.find((c) => c.url.includes('/conversations/messages'))!.body!
    expect(email).toMatchObject({ type: 'Email', contactId: 'contact-1', subject: `Comanda ta Biohack Tech #${o.orderNumber}` })
    const opp = calls.find((c) => c.url.endsWith('/opportunities/'))!.body!
    expect(opp).toMatchObject({ pipelineId: 'pipe1', pipelineStageId: 'stage-2', status: 'won', monetaryValue: 6380, contactId: 'contact-1' })
  })

  it('company bank transfer: instructions + CRM now, invoice only after the payment is confirmed', async () => {
    const { order } = await svc.placeOrder({ lines: lines([{ productId: 'ochelari-biohack', variantId: 'patrat-negru', quantity: 1 }]), form: { ...company, paymentMethod: 'transfer' }, attemptId: 'attempt-1' })
    await runDueJobs()
    expect(count('/factura/emitere')).toBe(0)
    expect(calls.find((c) => c.url.includes('/conversations/messages'))!.body!.subject).toBe(`Comanda #${order.orderNumber}: datele pentru transfer`)
    expect(calls.find((c) => c.url.endsWith('/opportunities/'))!.body!.pipelineStageId).toBe('stage-0')
    await svc.confirmPayment(order.id, 'admin')
    await runDueJobs()
    expect(count('/factura/emitere')).toBe(1)
    expect(calls.find((c) => c.url.includes('/factura/emitere'))!.body!.Client).toMatchObject({ Tip: 'PJ', CodUnic: 'RO14399840' })
    expect(count('/opportunities/', 'POST')).toBe(1)
    expect(calls.filter((c) => c.method === 'PUT').at(-1)!.body!.pipelineStageId).toBe('stage-2')
  })

  it('an FGO outage never touches the payment: the invoice retries and succeeds later', async () => {
    const { order } = await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: person, attemptId: 'attempt-1' })
    fgoMode = 'timeout'
    await svc.confirmPayment(order.id, 'stripe.webhook')
    await runDueJobs()
    let o = (await orders.byId(db, order.id))!
    expect([o.paymentStatus, o.invoiceStatus]).toEqual(['paid', 'pending'])
    const retry = (await jobs.forOrder(db, order.id)).find((j) => j.kind === 'fgo.invoice')!
    expect(retry.status).toBe('retry')
    fgoMode = 'ok'
    await db.query("update jobs set run_at = now() where id = $1", [retry.id])
    await runDueJobs()
    o = (await orders.byId(db, order.id))!
    expect(o.invoiceStatus).toBe('issued')
    expect(count('/factura/emitere')).toBe(2)
  })

  it('an FGO rejection is not retried blindly: the order is flagged for a person', async () => {
    const { order } = await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: person, attemptId: 'attempt-1' })
    fgoMode = 'reject'
    await svc.confirmPayment(order.id, 'stripe.webhook')
    await runDueJobs()
    const o = (await orders.byId(db, order.id))!
    expect([o.paymentStatus, o.invoiceStatus]).toEqual(['paid', 'failed'])
    expect((await jobs.problems(db)).map((j) => j.kind)).toContain('fgo.invoice')
  })

  it('a paid order after an unpaid card attempt closes the attempt quietly (no recovery flow)', async () => {
    const first = await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: person, attemptId: 'attempt-1' })
    const second = await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: { ...person, notes: 'etaj 2' }, attemptId: 'attempt-2' })
    await svc.confirmPayment(second.order.id, 'stripe.webhook')
    await svc.markAbandonedIfUnpaid(first.order.id)
    expect((await orders.byId(db, first.order.id))!.status).toBe('cancelled')
    expect((await jobs.forOrder(db, first.order.id)).map((j) => j.kind).sort()).toEqual(['order.abandon_check', 'stripe.reconcile'])
  })
})
