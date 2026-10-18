/**
 * Phase 2: the application owns its email. Customer emails and the team's notifications (orders@) go out
 * through our own SMTP mailbox as Biohack Tech <contact@biohack-tech.ro>, from the outbox, independent of
 * GoHighLevel and FGO. Delayed reminders and alerts are rechecked against the order before sending.
 * SMTP is a fake nodemailer transport; FGO and GoHighLevel are stubbed at the HTTP boundary; the database
 * is an embedded PostgreSQL (PGlite).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_PRICES } from '../fixtures'

vi.mock('@/config/prices', () => ({ PRICES_RON: { ...TEST_PRICES, 'balance-wave': 638000 } }))
vi.mock('next/server', () => ({ after: (fn: () => unknown) => void fn() }))

type Sent = { from: string; to: string; subject: string; text: string; html: string; messageId: string }
let sent: Sent[]
let attempts: Sent[]
let smtpMode: 'ok' | 'down' | 'lost' | 'reject'
vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: async (m: Sent) => {
        attempts.push(m)
        if (smtpMode === 'down') throw Object.assign(new Error('connect ECONNREFUSED 188.241.116.202:465'), { code: 'ECONNREFUSED' })
        if (smtpMode === 'reject') throw Object.assign(new Error('550 No such user here'), { code: 'EENVELOPE', responseCode: 550 })
        sent.push(m)
        // The server accepted the message, then the connection dropped before we read its answer.
        if (smtpMode === 'lost') throw Object.assign(new Error('Timeout'), { code: 'ETIMEDOUT' })
        return { messageId: m.messageId, response: '250 OK id=1', accepted: [m.to], rejected: [] }
      },
    }),
  },
}))

const { freshDb, person, lines, TEST_ENV } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { orders } = await import('@/server/orders/repository')
const { jobs } = await import('@/server/jobs/outbox')
const { runDueJobs } = await import('@/server/jobs/runner')
const { STAGES } = await import('@/server/integrations/ghl')

const ENV = {
  ...TEST_ENV,
  EMAIL_TRANSPORT: 'smtp',
  SMTP_HOST: 'mail.biohack-tech.test',
  SMTP_USER: 'contact@biohack-tech.ro',
  SMTP_PASSWORD: 'not-a-real-password',
  EMAIL_FROM: 'contact@biohack-tech.ro',
  NOTIFY_EMAIL: 'orders@biohack-tech.ro',
}
const SITE = TEST_ENV.NEXT_PUBLIC_SITE_URL

let db: Awaited<ReturnType<typeof freshDb>>
let mode: { ghl: 'ok' | 'down'; fgo: 'ok' | 'down' }
let calls: { url: string; method: string }[]

function fakeApis() {
  calls = []
  let invoiceNo = 100
  let opp = 0
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    calls.push({ url, method: init.method ?? 'GET' })
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } })
    if (url.includes('/factura/')) {
      if (mode.fgo === 'down') return json({ message: 'unavailable' }, 503)
      if (url.includes('/factura/emitere')) return json({ Success: true, Factura: { Serie: 'BT', Numar: String(++invoiceNo), Link: 'https://fgo/f.pdf' } })
      return json({ Success: true, Factura: { Serie: 'BT', Numar: String(++invoiceNo) } })
    }
    if (url.includes('leadconnectorhq.com')) {
      if (mode.ghl === 'down') return json({ message: 'Service Unavailable' }, 503)
      if (url.includes('/contacts/search')) return json({ contacts: [] })
      if (url.includes('/contacts/upsert')) return json({ contact: { id: 'contact-1' } })
      if (url.includes('/tags')) return json({ tags: [] })
      if (url.includes('/opportunities/pipelines')) return json({ pipelines: [{ id: 'pipe1', stages: Object.values(STAGES).map((n, i) => ({ id: `stage-${i}`, name: n })) }] })
      if (url.includes('/opportunities/search')) return json({ opportunities: [] })
      if (url.endsWith('/opportunities/') && init.method === 'POST') return json({ opportunity: { id: `opp-${++opp}` } }, 201)
      if (url.includes('/opportunities/')) return json({ opportunity: {} })
      if (url.includes('/conversations/messages')) return json({ emailMessageId: 'ghl-should-not-be-used' })
    }
    return json({ message: 'not mocked' }, 404)
  })
}

beforeEach(async () => {
  db = await freshDb(ENV)
  sent = []
  attempts = []
  smtpMode = 'ok'
  mode = { ghl: 'ok', fgo: 'ok' }
  fakeApis()
})
afterEach(() => vi.unstubAllGlobals())

/** Make every waiting job due now (time passing), then run the queue. */
async function runNow() {
  await db.query("update jobs set run_at = now() where status in ('pending','retry')")
  await runDueJobs()
}
/** Only jobs due now, without moving time forward. */
const runDue = () => runDueJobs()
const toCustomer = () => sent.filter((m) => m.to === person.email).map((m) => m.subject)
const toTeam = () => sent.filter((m) => m.to === 'orders@biohack-tech.ro')
const teamSubjects = () => toTeam().map((m) => m.subject)
const jobOf = async (orderId: string, key: string) => (await jobs.forOrder(db, orderId)).find((j) => j.dedupeKey.startsWith(key))!

const card = async (attemptId: string, productId = 'balance-wave') => {
  const { order } = await svc.placeOrder({ lines: lines([{ productId, quantity: 1 }]), form: person, attemptId })
  await svc.confirmPayment(order.id, 'stripe.webhook', { amountMinor: order.totalMinor, currency: 'ron' })
  return (await orders.byId(db, order.id))!
}
const place = async (method: 'transfer' | 'cod', attemptId: string) =>
  (await svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: { ...person, paymentMethod: method }, attemptId })).order

describe('SMTP transport: the Biohack Tech sender, never GoHighLevel', () => {
  it('a card order: customer emails from Biohack Tech <contact@biohack-tech.ro>, nothing through GHL conversations', async () => {
    const o = await card('c1')
    await runDue()
    await runDue() // the invoice email is queued by the invoice job
    expect(toCustomer()).toEqual([`Comanda ta Biohack Tech #${o.orderNumber}`, `Factura pentru comanda #${o.orderNumber}`])
    for (const m of sent) expect(m.from).toBe('Biohack Tech <contact@biohack-tech.ro>')
    expect(calls.filter((c) => c.url.includes('/conversations/messages'))).toHaveLength(0)
    expect((await orders.events(db, o.id)).filter((e) => e.type === 'email.sent').map((e) => String(e.data.ref))).toEqual([expect.stringMatching(/^smtp:<\w{32}@biohack-tech\.ro>$/), expect.stringMatching(/^smtp:/)])
  })

  it('emails do not wait for GoHighLevel: with GHL down the customer and the team still hear, the CRM retries alone', async () => {
    mode.ghl = 'down'
    const o = await card('c2')
    await runDue()
    expect(toCustomer()).toContain(`Comanda ta Biohack Tech #${o.orderNumber}`)
    expect(teamSubjects()).toEqual([`Comanda ${o.orderNumber}: comandă nouă plătită cu cardul`])
    expect((await jobOf(o.id, 'ghl.sync')).status).toBe('retry')
    expect((await orders.byId(db, o.id))!.invoiceStatus).toBe('issued')
  })

  it('SMTP down: the order, the invoice and the CRM are unaffected; the emails retry and go out once SMTP is back', async () => {
    smtpMode = 'down'
    const o = await card('c3')
    await runDue()
    expect(sent).toEqual([])
    expect((await orders.byId(db, o.id))!).toMatchObject({ paymentStatus: 'paid', invoiceStatus: 'issued', ghlOpportunityId: 'opp-1' })
    expect((await jobOf(o.id, 'email:order_confirmed')).status).toBe('retry')
    smtpMode = 'ok'
    await runNow()
    await runNow()
    expect(toCustomer().filter((s) => s === `Comanda ta Biohack Tech #${o.orderNumber}`)).toHaveLength(1)
    expect(teamSubjects().filter((s) => s.includes('comandă nouă plătită'))).toHaveLength(1)
  })

  it('a response lost after the server accepted: retried with the same Message-ID (at-least-once, deduplicable)', async () => {
    smtpMode = 'lost'
    const o = await card('c4')
    await runDue()
    smtpMode = 'ok'
    await runNow()
    const confirmations = sent.filter((m) => m.subject === `Comanda ta Biohack Tech #${o.orderNumber}`)
    expect(confirmations).toHaveLength(2)
    expect(new Set(confirmations.map((m) => m.messageId)).size).toBe(1)
    expect((await jobOf(o.id, 'email:order_confirmed')).status).toBe('done')
  })

  it('a recipient the server refuses (550) stops at once, visible, and the team is told', async () => {
    smtpMode = 'reject'
    const o = await place('cod', 'r1')
    await runDue()
    const j = await jobOf(o.id, 'email:cod_confirmed')
    expect([j.status, j.attempts]).toEqual(['failed', 1])
    expect(j.lastError).toContain('550')
    smtpMode = 'ok'
    await runDue()
    expect(teamSubjects()).toContain(`Comanda ${o.orderNumber}: o integrare a eșuat definitiv`)
  })

  it('the same job run twice at once delivers once', async () => {
    const o = await place('cod', 'd1')
    await Promise.all([runDueJobs(), runDueJobs()])
    await runDue()
    expect(toCustomer()).toEqual([`Comanda ta Biohack Tech #${o.orderNumber}: plata la livrare`])
    expect(teamSubjects()).toEqual([`Comanda ${o.orderNumber}: comandă nouă cu plata la livrare`])
  })
})

describe('team notifications (orders@)', () => {
  it('a paid card order: order number, status, products, the action and the /admin link; no customer contact data', async () => {
    const o = await card('n1')
    await runDue()
    const [n] = toTeam()
    expect(n.subject).toBe(`Comanda ${o.orderNumber}: comandă nouă plătită cu cardul`)
    expect(n.from).toBe('Biohack Tech <contact@biohack-tech.ro>')
    expect(n.text).toContain('Stare comandă: De pregătit')
    expect(n.text).toContain('Card · Plătită')
    expect(n.text).toContain(`1 x ${o.items[0].productName}`)
    expect(n.text).toContain('Pregătește coletul')
    expect(n.text).toContain(`${SITE}/admin/orders/${o.id}`)
    for (const secret of [person.email, person.phone, person.address, person.lastName]) {
      expect(n.text).not.toContain(secret)
      expect(n.html).not.toContain(secret)
    }
  })

  it('a bank transfer: one note when placed, a different one when the money is confirmed; repeats change nothing', async () => {
    const o = await place('transfer', 't1')
    await runDue()
    expect(teamSubjects()).toEqual([`Comanda ${o.orderNumber}: comandă nouă, așteaptă transferul`])
    await svc.confirmPayment(o.id, 'admin')
    await svc.confirmPayment(o.id, 'admin')
    await runDue()
    await runDue()
    expect(teamSubjects()).toEqual([`Comanda ${o.orderNumber}: comandă nouă, așteaptă transferul`, `Comanda ${o.orderNumber}: transferul a fost confirmat`])
  })

  it('cash on delivery: one note; the courier settlement later is not news for the warehouse', async () => {
    const o = await place('cod', 'cod1')
    await runDue()
    await svc.markShipped(o.id, 'admin', { courier: 'Fan Courier', trackingNumber: 'AWB1' })
    await svc.confirmPayment(o.id, 'admin', { amountMinor: o.totalMinor, currency: 'RON', reference: 'BORD-1' })
    await runDue()
    expect(teamSubjects()).toEqual([`Comanda ${o.orderNumber}: comandă nouă cu plata la livrare`])
  })

  it('a paid post-purchase order names its parent', async () => {
    const parent = await card('u1')
    await db.query("update orders set upsell_status = 'offered' where id = $1", [parent.id])
    const { order: child } = await svc.placeUpsellOrder((await orders.byId(db, parent.id))!, lines([{ productId: 'brainlink-pro', quantity: 1 }])[0])
    await svc.confirmPayment(child.id, 'stripe.webhook', { amountMinor: child.totalMinor, currency: 'ron' })
    await runDue()
    const n = toTeam().find((m) => m.subject === `Comanda ${child.orderNumber}: produs adăugat după plată`)!
    expect(n.text).toContain(`Comanda principală: ${parent.orderNumber}`)
    expect(n.text).toContain(`împreună cu comanda ${parent.orderNumber}`)
    expect(teamSubjects().filter((s) => s.includes('comandă nouă plătită'))).toEqual([`Comanda ${parent.orderNumber}: comandă nouă plătită cu cardul`])
  })

  it('two orders of the same customer: each notification carries its own order', async () => {
    const a = await card('m1')
    const b = await card('m2', 'brainlink-pro')
    await runDue()
    const subjects = teamSubjects()
    expect(subjects).toContain(`Comanda ${a.orderNumber}: comandă nouă plătită cu cardul`)
    expect(subjects).toContain(`Comanda ${b.orderNumber}: comandă nouă plătită cu cardul`)
    expect(toTeam().find((m) => m.subject.includes(b.orderNumber))!.text).toContain(b.items[0].productName)
    expect(toTeam().find((m) => m.subject.includes(b.orderNumber))!.text).not.toContain(a.items[0].productName)
  })

  it('a paid order cancelled: refund to do; with an invoice and no automatic credit note: storno to do', async () => {
    const o = await card('x1')
    await runDue()
    await svc.cancelOrder(o.id, 'admin', 'stoc epuizat')
    await runDue()
    expect(teamSubjects()).toEqual(
      expect.arrayContaining([`Comanda ${o.orderNumber}: anulată după plată, de rambursat`, `Comanda ${o.orderNumber}: factura trebuie stornată în FGO`]),
    )
    expect(toTeam().find((m) => m.subject.includes('de rambursat'))!.text).toContain('Stripe')
    // The refund done in Stripe arrives: no repeat of either note.
    await svc.recordRefund(o.id, 'stripe.webhook', o.totalMinor)
    await runDue()
    expect(teamSubjects().filter((s) => s.includes('de rambursat'))).toHaveLength(1)
    expect(teamSubjects().filter((s) => s.includes('stornată'))).toHaveLength(1)
    expect(toCustomer()).toContain(`Rambursare pentru comanda #${o.orderNumber}`)
  })

  it('an unpaid transfer cancelled: no refund note, no storno note', async () => {
    const o = await place('transfer', 'x2')
    await svc.cancelOrder(o.id, 'admin', 'clientul a renunțat')
    await runNow()
    expect(teamSubjects()).toEqual([])
  })

  it('a return received on a paid order: refund to do, once', async () => {
    const o = await card('ret1')
    await svc.markShipped(o.id, 'admin', { courier: 'Fan Courier', trackingNumber: 'AWB2' })
    await svc.markDelivered(o.id, 'admin')
    await svc.markReturnRequested(o.id, 'admin')
    await svc.markReturnReceived(o.id, 'admin')
    await svc.markReturnReceived(o.id, 'admin')
    await runDue()
    expect(teamSubjects().filter((s) => s === `Comanda ${o.orderNumber}: retur primit, de rambursat`)).toHaveLength(1)
  })

  it('FGO down for good: the invoice job stops after its retries and the team is told once', async () => {
    mode.fgo = 'down'
    const o = await card('f1')
    for (let i = 0; i < 10; i++) await runNow()
    expect((await jobOf(o.id, 'fgo.invoice')).status).toBe('failed')
    const alerts = toTeam().filter((m) => m.subject === `Comanda ${o.orderNumber}: o integrare a eșuat definitiv`)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].text).toContain('Emiterea facturii în FGO')
    // The customer still got the confirmation; only the invoice email is missing.
    expect(toCustomer()).toEqual([`Comanda ta Biohack Tech #${o.orderNumber}`])
  }, 30_000)
})

describe('delayed steps: rechecked against the order right before sending', () => {
  it('transfer still unpaid: reminder to the customer after 2 days, note to the team after 5', async () => {
    const o = await place('transfer', 'd2')
    await runDue()
    expect(toCustomer()).toEqual([`Comanda #${o.orderNumber}: datele pentru transfer`])
    const reminder = await jobOf(o.id, 'email:transfer_reminder')
    const overdue = await jobOf(o.id, 'notify:transfer_overdue')
    expect(Math.round((reminder.runAt.getTime() - o.createdAt.getTime()) / 86_400_000)).toBe(2)
    expect(Math.round((overdue.runAt.getTime() - o.createdAt.getTime()) / 86_400_000)).toBe(5)
    await runNow()
    expect(toCustomer()).toEqual([`Comanda #${o.orderNumber}: datele pentru transfer`, `Reamintire: comanda ${o.orderNumber} așteaptă plata`])
    const r = sent.find((m) => m.subject.startsWith('Reamintire'))!
    expect(r.text).toContain(`${SITE}/comanda/${o.publicToken}`)
    expect(r.text).toContain('790 lei')
    expect(teamSubjects()).toContain(`Comanda ${o.orderNumber}: transferul nu a ajuns de 5 zile`)
  })

  it('transfer paid before the reminder: no reminder, no overdue note', async () => {
    const o = await place('transfer', 'd3')
    await svc.confirmPayment(o.id, 'admin')
    await runNow()
    expect(toCustomer()).not.toContain(`Reamintire: comanda ${o.orderNumber} așteaptă plata`)
    expect(teamSubjects().some((s) => s.includes('nu a ajuns'))).toBe(false)
    expect((await jobOf(o.id, 'email:transfer_reminder')).status).toBe('skipped')
  })

  it('transfer cancelled before the reminder: nothing obsolete goes out', async () => {
    const o = await place('transfer', 'd4')
    await runDue()
    await svc.cancelOrder(o.id, 'admin', 'clientul a renunțat')
    await runNow()
    expect(toCustomer()).toEqual([`Comanda #${o.orderNumber}: datele pentru transfer`, `Comanda #${o.orderNumber} a fost anulată`])
    expect(teamSubjects()).toEqual([`Comanda ${o.orderNumber}: comandă nouă, așteaptă transferul`])
  })

  it('preparation: note after 2 days only if still not shipped (card and cash on delivery)', async () => {
    const slow = await card('p1')
    const fast = await card('p2', 'brainlink-pro')
    const cod = await place('cod', 'p3')
    const cancelled = await place('cod', 'p4')
    expect(Math.round(((await jobOf(slow.id, 'notify:prep_overdue')).runAt.getTime() - Date.now()) / 86_400_000)).toBe(2)
    await svc.markProcessing(slow.id, 'admin')
    await svc.markShipped(fast.id, 'admin', { courier: 'Fan Courier', trackingNumber: 'AWB3' })
    await svc.cancelOrder(cancelled.id, 'admin', 'refuzată')
    await runNow()
    const overdue = teamSubjects().filter((s) => s.includes('nu este încă la curier'))
    expect(overdue.sort()).toEqual([`Comanda ${cod.orderNumber}: nu este încă la curier după 2 zile`, `Comanda ${slow.orderNumber}: nu este încă la curier după 2 zile`].sort())
  })

  it('shipping: note after 5 days only if still not delivered', async () => {
    const late = await card('s1')
    const ok = await card('s2', 'brainlink-pro')
    for (const o of [late, ok]) await svc.markShipped(o.id, 'admin', { courier: 'Fan Courier', trackingNumber: `AWB-${o.orderNumber}` })
    expect(Math.round(((await jobOf(late.id, 'notify:delivery_overdue')).runAt.getTime() - Date.now()) / 86_400_000)).toBe(5)
    await svc.markDelivered(ok.id, 'admin')
    await runNow()
    const overdue = toTeam().filter((m) => m.subject.includes('nelivrată'))
    expect(overdue.map((m) => m.subject)).toEqual([`Comanda ${late.orderNumber}: expediată de 5 zile, nelivrată`])
    expect(overdue[0].text).toContain(`AWB-${late.orderNumber}`)
  })

  it('cash on delivery: a note 10 days after delivery only while the courier money is not recorded', async () => {
    const unpaid = await place('cod', 'c1')
    const settled = await place('cod', 'c2')
    for (const o of [unpaid, settled]) {
      await svc.markShipped(o.id, 'admin', { courier: 'Fan Courier', trackingNumber: `AWB-${o.orderNumber}` })
      await svc.markDelivered(o.id, 'admin')
    }
    expect(Math.round(((await jobOf(unpaid.id, 'notify:cod_uncollected')).runAt.getTime() - Date.now()) / 86_400_000)).toBe(10)
    await svc.confirmPayment(settled.id, 'admin')
    await runNow()
    const notes = toTeam().filter((m) => m.subject.includes('banii neîncasați'))
    expect(notes.map((m) => m.subject)).toEqual([`Comanda ${unpaid.orderNumber}: livrată ramburs de 10 zile, banii neîncasați`])
    expect(notes[0].text).toContain(`AWB-${unpaid.orderNumber}`)
  })

  it('after delivery: the service email the next day; not for a refunded or returned order, not for an added product', async () => {
    const happy = await card('a1')
    const refunded = await card('a2', 'brainlink-pro')
    for (const o of [happy, refunded]) {
      await svc.markShipped(o.id, 'admin', { courier: 'Fan Courier', trackingNumber: `AWB-${o.orderNumber}` })
      await svc.markDelivered(o.id, 'admin')
    }
    expect(Math.round(((await jobOf(happy.id, 'email:delivery_followup')).runAt.getTime() - Date.now()) / 86_400_000)).toBe(1)
    await svc.recordRefund(refunded.id, 'stripe.webhook', refunded.totalMinor)
    await runNow()
    expect(sent.filter((m) => m.subject.includes('a ajuns. Te ajutăm la început')).map((m) => m.subject)).toEqual([`Comanda ${happy.orderNumber} a ajuns. Te ajutăm la început`])
    const p1 = sent.find((m) => m.subject.includes('a ajuns'))!
    // Service, not marketing: no unsubscribe link, no review request, the support line only once.
    expect(p1.text).not.toMatch(/dezabon|recenzie|părere/i)
    expect(p1.text.match(/\+40 767 978 707/g)).toHaveLength(2)
  })

  it('DELIVERY_FOLLOWUP=off: no service email after delivery', async () => {
    db = await freshDb({ ...ENV, DELIVERY_FOLLOWUP: 'off' })
    const o = await card('a3')
    await svc.markShipped(o.id, 'admin', { courier: 'Fan Courier', trackingNumber: 'AWB4' })
    await svc.markDelivered(o.id, 'admin')
    await runNow()
    expect(sent.some((m) => m.subject.includes('a ajuns'))).toBe(false)
  })
})

describe('configuration', () => {
  it('without NOTIFY_EMAIL no team notifications are queued; customer emails are unchanged', async () => {
    db = await freshDb(Object.fromEntries(Object.entries(ENV).filter(([k]) => k !== 'NOTIFY_EMAIL')))
    const o = await place('transfer', 'cfg1')
    expect((await jobs.forOrder(db, o.id)).some((j) => j.kind === 'notify.send')).toBe(false)
    await runDue()
    expect(toCustomer()).toEqual([`Comanda #${o.orderNumber}: datele pentru transfer`])
  })

  it('with the GHL transport nothing new is queued: no team notes, no reminder, no follow-up (GHL would send them as NEUROS)', async () => {
    db = await freshDb({ ...TEST_ENV, NOTIFY_EMAIL: 'orders@biohack-tech.ro' })
    const cod = await place('cod', 'cfg2')
    const transfer = await place('transfer', 'cfg3')
    await svc.markShipped(cod.id, 'admin', { courier: 'Fan Courier', trackingNumber: 'AWB9' })
    await svc.markDelivered(cod.id, 'admin')
    const all = [...(await jobs.forOrder(db, cod.id)), ...(await jobs.forOrder(db, transfer.id))]
    expect(all.some((j) => j.kind === 'notify.send')).toBe(false)
    expect(all.filter((j) => j.kind === 'email.send').map((j) => j.payload.template).sort()).toEqual(['cod_confirmed', 'order_shipped', 'transfer_instructions'])
  })

  it('EMAIL_TRANSPORT=smtp without credentials is reported and sends nothing', async () => {
    const { loadConfig, resetConfig } = await import('@/server/config')
    vi.stubEnv('SMTP_PASSWORD', '')
    resetConfig()
    const { config, issues } = loadConfig()
    expect(config.email.smtp).toBeNull()
    expect(issues.some((i) => i.area === 'email' && i.level === 'error')).toBe(true)
  })
})
