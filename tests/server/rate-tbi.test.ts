/**
 * "Cumpără în rate prin tbi bank" (/api/rate-tbi): the store's prices (Calm ladder, Focus Black Friday, Amber 2+2,
 * 10%/20% for 2/3 pieces), the indicative instalment, validation, spam and repeat protection, the job that sends the
 * request to GoHighLevel (contact, fields, tags, note, 24-hour task, a new card) and its retry when GHL is down.
 * The store's price rules, GoHighLevel and Meta are stubbed; the database is an in-memory Postgres.
 */
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => void fn() }))

const { freshDb } = await import('./helpers')
const { POST, OPTIONS } = await import('@/app/api/rate-tbi/route')
const { runDueJobs } = await import('@/server/jobs/runner')
const { resetTbiPrices } = await import('@/server/tbi-prices')
const { resetLeadsPipelineCache } = await import('@/server/integrations/ghl')
const { normalizeRoMobile, lei } = await import('@/lib/rate-tbi')
const { lineTotal, monthlyRate, quote, instalment, allowedPeriods, longestPeriod, TBI_TERMS } = await import('@/lib/tbi')

// 5 Nov 2026 12:00 in Bucharest: Calm is at the 4.890 step, Amber 2+2 is on, Focus Black Friday starts on the 6th.
const NOW = Date.parse('2026-11-05T10:00:00Z')
const T = (iso: string) => Date.parse(iso) / 1000
const RULES = {
  products: {
    calm: {
      title: 'NEUROS Calm',
      price: 638000,
      ladder: {
        utc_offset: '+0200',
        reduceri_cantitate: { 2: 10, 3: 20 },
        etape: [
          { de_la: '2026-11-04 00:00', pana_la: '2026-11-05 23:59', pret: 4890 },
          { de_la: '2026-11-06 00:00', pana_la: '2026-11-12 23:59', pret: 3900 },
        ],
        bf_2plus: { min: 2, pct: 20 },
      },
    },
    focus: { title: 'NEUROS Focus', price: 322500, tiers: true, bf: { unit: 272500, from: T('2026-11-05T22:00:00Z'), to: T('2026-11-17T22:00:00Z') } },
    amber: { title: 'NEUROS Amber', price: 31500, deals: [{ buy: 2, get: 2, from: T('2026-11-01T22:00:00Z'), to: T('2026-11-30T22:00:00Z') }] },
  },
}

let db: Awaited<ReturnType<typeof freshDb>>
let calls: { url: string; method: string; body: Record<string, unknown> | null }[]
let pricesUp: boolean
let ghlUp: boolean
let ip = 0
beforeEach(async () => {
  db = await freshDb()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  resetTbiPrices()
  resetLeadsPipelineCache()
  calls = []
  pricesUp = true
  ghlUp = true
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    const body = init.body ? JSON.parse(String(init.body)) : null
    calls.push({ url, method: init.method ?? 'GET', body })
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } })
    if (url.includes('view=tbi-data')) return pricesUp ? json(RULES) : json({ message: 'down' }, 503)
    if (!ghlUp) return json({ message: 'unavailable' }, 503)
    if (url.endsWith('/contacts/search')) return json({ contacts: [] })
    if (url.endsWith('/contacts/upsert')) return json({ contact: { id: 'c-new' } })
    if (/\/contacts\/c-new\/(tags|notes|tasks)$/.test(url) || (init.method === 'PUT' && url.endsWith('/contacts/c-new'))) return json({ ok: true })
    if (url.includes('/opportunities/pipelines')) return json({ pipelines: [{ id: 'pipe-tbi', name: 'Rate TBI', stages: [{ id: 'st-new', name: 'Cerere nouă' }] }] })
    if (url.endsWith('/opportunities/') && init.method === 'POST') return json({ opportunity: { id: `opp-${calls.length}` } })
    return json({ message: `unexpected ${url}` }, 400)
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const good = (o: Record<string, unknown> = {}) => ({
  name: 'Ana Maria Pop',
  phone: '0722 123 456',
  email: 'Ana.Pop@Example.com',
  items: [{ handle: 'calm', qty: 1 }, { handle: 'amber', qty: 2 }],
  period: 24,
  advance: 0,
  consent: true,
  total: 5520,
  page: '/products/calm',
  utm: { source: 'meta', medium: 'paid', campaign: 'BF' },
  eventId: 'tbi-1234567890',
  startedAt: NOW - 20_000,
  website: '',
  ...o,
})
const req = (body: unknown, origin = 'https://biohack-tech.ro') =>
  new NextRequest('https://biohack-tech.vercel.app/api/rate-tbi', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, 'x-forwarded-for': `10.7.0.${++ip}`, 'user-agent': 'test' },
    body: JSON.stringify(body),
  })
const ghlCalls = () => calls.filter((c) => c.url.startsWith('https://services.leadconnectorhq.com'))

it('prices a basket the way the store does: Calm ladder, Focus Black Friday, Amber 2+2, 10%/20%', () => {
  expect([1, 2, 3].map((q) => lineTotal(RULES, 'calm', q, NOW))).toEqual([4890, 7824, 11736])
  // Calm after the ladder: 10% at 2, 20% at 3 on the full price.
  expect(lineTotal(RULES, 'calm', 2, Date.parse('2026-12-02T10:00:00Z'))).toBe(11484)
  expect([1, 2, 3].map((q) => lineTotal(RULES, 'focus', q, NOW))).toEqual([3225, 5805, 7740])
  const bf = Date.parse('2026-11-08T10:00:00Z')
  expect([1, 2, 3].map((q) => lineTotal(RULES, 'focus', q, bf))).toEqual([2725, 5450, 7740])
  expect([1, 2, 3, 4, 8].map((q) => lineTotal(RULES, 'amber', q, NOW))).toEqual([315, 630, 945, 630, 1260])
  expect(quote(RULES, [{ handle: 'calm', qty: 1 }, { handle: 'amber', qty: 2 }], NOW)?.total).toBe(5520)
})

it("matches tbi bank's representative example: 2.000 lei, 24 months, 21%, fee 170 lei, insurance → 124,62 lei a month", () => {
  const ex = instalment(2000, 24)
  expect(Math.abs(ex.exact - 124.62)).toBeLessThanOrEqual(0.05)
  expect(Math.abs(ex.exact * 24 - 2990.88)).toBeLessThanOrEqual(1.2)
  expect([ex.monthly, ex.total]).toEqual([125, 3000])
  // Without the fee and insurance it is the plain annuity.
  expect(monthlyRate(2000, 24, { ...TBI_TERMS, includeCosts: false })).toBe(103)
  expect(monthlyRate(0, 24)).toBe(0)
  // The longest period by amount: under 1.000 lei 12 months, 1.000–2.999 lei 36, from 3.000 lei 60.
  expect([999, 1000, 2999, 3000].map((a) => longestPeriod(a))).toEqual([12, 36, 36, 60])
  expect(allowedPeriods(315)).toEqual([6, 12])
  expect(longestPeriod(150)).toBeNull()
  expect(['0722 123 456', '+40 722-123-456', '0040722123456'].map(normalizeRoMobile)).toEqual(Array(3).fill('+40722123456'))
  expect([lei(6240), lei(3227.5)]).toEqual(['6.240', '3.227,50'])
})

it('values the basket on the server, stores the request and sends it to GoHighLevel with a new card', async () => {
  // The page claims a lower total: the server keeps the store's 5.520.
  const res = await POST(req(good({ total: 4000 })))
  expect([res.status, await res.json()]).toEqual([200, { ok: true, total: 5520, monthly: monthlyRate(5520, 24), period: 24 }])
  expect(res.headers.get('access-control-allow-origin')).toBe('https://biohack-tech.ro')
  await runDueJobs()
  const g = ghlCalls()
  const fields = g.find((c) => c.method === 'PUT' && c.url.endsWith('/contacts/c-new'))!
  expect(fields.body).toEqual({
    customFields: [
      { key: 'bt_tbi_produs', field_value: 'NEUROS Calm x1, NEUROS Amber x2' },
      { key: 'bt_tbi_cantitate', field_value: '3' },
      { key: 'bt_tbi_valoare', field_value: '5.520' },
      { key: 'bt_tbi_perioada', field_value: '24 luni' },
      { key: 'bt_tbi_avans', field_value: '0' },
      { key: 'bt_tbi_rata', field_value: lei(monthlyRate(5520, 24)) },
      { key: 'bt_tbi_total_plata', field_value: lei(monthlyRate(5520, 24) * 24) },
      { key: 'bt_tbi_whatsapp', field_value: 'https://wa.me/40722123456' },
      { key: 'bt_tbi_link', field_value: '' },
    ],
  })
  const added = g.find((c) => c.method === 'POST' && c.url.endsWith('/tags'))!
  expect(added.body).toEqual({ tags: ['rate-tbi', 'rate-tbi-cerere', 'rate-tbi-calm', 'rate-tbi-amber', 'bt-site-ro'] })
  // The fields are written before the tag that starts the workflow.
  expect(g.indexOf(fields)).toBeLessThan(g.indexOf(added))
  const note = String(g.find((c) => c.url.endsWith('/notes'))!.body!.body)
  expect(note).toContain('NEUROS Calm × 1: 4.890 lei/buc., subtotal 4.890 lei')
  expect(note).toContain('NEUROS Amber × 2: 315 lei/buc., subtotal 630 lei')
  expect(note).toContain('Total comandă: 5.520 lei')
  expect(note).toContain(`Rată estimată: ${lei(monthlyRate(5520, 24))} lei/lună, total de plată ${lei(monthlyRate(5520, 24) * 24)} lei`)
  expect(note).toContain('comision de analiză 170 lei și asigurare 0,532%/lună incluse')
  expect(note).toContain('WhatsApp: https://wa.me/40722123456')
  // Everything goes to Mario Sirbu (GHL user NbulDKs8dFmZAscEj2ej).
  expect(g.find((c) => c.url.endsWith('/contacts/upsert'))!.body).toMatchObject({ assignedTo: 'NbulDKs8dFmZAscEj2ej' })
  expect(note).toContain('source=meta')
  expect(g.find((c) => c.url.endsWith('/tasks'))!.body).toMatchObject({
    title: 'Sună Ana Maria Pop – cerere rate tbi (5.520 lei)',
    completed: false,
    dueDate: new Date(NOW + 24 * 3_600_000).toISOString(),
    assignedTo: 'NbulDKs8dFmZAscEj2ej',
  })
  expect(g.find((c) => c.url.endsWith('/opportunities/'))!.body).toMatchObject({
    name: 'Ana Maria Pop – Calm x1 + Amber x2 – 5.520 lei',
    pipelineId: 'pipe-tbi',
    pipelineStageId: 'st-new',
    monetaryValue: 5520,
    contactId: 'c-new',
    assignedTo: 'NbulDKs8dFmZAscEj2ej',
  })
  // No search for an existing card: every request is its own card.
  expect(g.some((c) => c.url.includes('/opportunities/search'))).toBe(false)
})

it('uses the longest period tbi allows for the amount when the customer asked for more', async () => {
  const res = await POST(req(good({ phone: '0747 555 666', email: 'g@example.com', items: [{ handle: 'amber', qty: 2 }], period: 60, total: 630 })))
  expect(await res.json()).toMatchObject({ ok: true, total: 630, period: 12, monthly: monthlyRate(630, 12) })
  await runDueJobs()
  const g = ghlCalls()
  expect(g.find((c) => c.method === 'PUT' && c.url.endsWith('/contacts/c-new'))!.body!.customFields).toContainEqual({ key: 'bt_tbi_perioada', field_value: '12 luni' })
  expect(String(g.find((c) => c.url.endsWith('/notes'))!.body!.body)).toContain('Perioada: 12 luni (a cerut 60; pentru suma asta tbi dă maximum 12)')
})

it('ignores the same basket from the same person within 10 minutes, and takes another basket', async () => {
  expect((await POST(req(good()))).status).toBe(200)
  expect(await (await POST(req(good()))).json()).toMatchObject({ ok: true, repeat: true })
  await runDueJobs()
  expect(ghlCalls().filter((c) => c.url.endsWith('/opportunities/'))).toHaveLength(1)
  expect(await (await POST(req(good({ items: [{ handle: 'focus', qty: 1 }] })))).json()).not.toHaveProperty('repeat')
})

it('keeps the request and retries it when GoHighLevel does not answer', async () => {
  ghlUp = false
  expect((await POST(req(good({ phone: '0733 000 111', email: 'b@example.com' })))).status).toBe(200)
  await runDueJobs()
  expect((await db.query("select status, attempts from jobs where kind = 'rate_tbi.submit'")).rows[0]).toMatchObject({ status: 'retry', attempts: 1 })
  ghlUp = true
  await db.query("update jobs set run_at = now() - interval '1 minute' where kind = 'rate_tbi.submit'")
  await runDueJobs()
  expect((await db.query("select status from jobs where kind = 'rate_tbi.submit'")).rows[0]).toMatchObject({ status: 'done' })
  expect(ghlCalls().some((c) => c.url.endsWith('/opportunities/'))).toBe(true)
})

it("uses the page's total only when the store's prices cannot be read and the total is believable", async () => {
  pricesUp = false
  expect(await (await POST(req(good({ phone: '0744 555 666', email: 'c@example.com', total: 5520 })))).json()).toMatchObject({ ok: true, total: 5520 })
  expect((await POST(req(good({ phone: '0744 555 667', email: 'd@example.com', total: 100 })))).status).toBe(422)
})

it('refuses invalid fields with the field names, and asks for no CNP or ID', async () => {
  const res = await POST(req(good({ phone: '0212345678', email: 'x', consent: false, name: 'A', items: [], period: 7 })))
  expect(res.status).toBe(422)
  expect(Object.keys((await res.json()).fields).sort()).toEqual(['consent', 'email', 'items', 'name', 'period', 'phone'])
  expect((await POST(req(good({ items: [{ handle: 'calm', qty: 11 }] })))).status).toBe(422)
  expect((await POST(req(good({ items: [{ handle: 'calm', qty: 1 }, { handle: 'calm', qty: 1 }] })))).status).toBe(422)
})

it('drops bots silently (honeypot, too fast) and limits requests per phone', async () => {
  expect(await (await POST(req(good({ website: 'http://spam' })))).json()).toEqual({ ok: true })
  expect(await (await POST(req(good({ startedAt: NOW })))).json()).toEqual({ ok: true })
  expect((await db.query('select count(*)::int n from jobs')).rows[0].n).toBe(0)
  for (const qty of [1, 2, 3]) expect((await POST(req(good({ phone: '0745 555 666', email: 'e@example.com', items: [{ handle: 'focus', qty }] })))).status).toBe(200)
  expect((await POST(req(good({ phone: '0745 555 666', email: 'e@example.com', items: [{ handle: 'focus', qty: 4 }] })))).status).toBe(429)
})

it('accepts the first version of the form (one product and its value)', async () => {
  const res = await POST(req({ ...good({ phone: '0746 555 666', email: 'f@example.com' }), items: undefined, product: 'focus', qty: 2, value: 5805 }))
  expect(await res.json()).toMatchObject({ ok: true, total: 5805 })
})

it('answers CORS only for the store', () => {
  expect(OPTIONS(req({}, 'https://biohack-tech.ro')).headers.get('access-control-allow-origin')).toBe('https://biohack-tech.ro')
  expect(OPTIONS(req({}, 'https://evil.example')).headers.get('access-control-allow-origin')).toBeNull()
})
