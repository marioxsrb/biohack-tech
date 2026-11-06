/**
 * TBI Fusion Pay in the "Cumpără în rate" flow: /api/rate-tbi registers the application (RegisterApplication,
 * encrypted) and answers with TBI's URL; the job puts the URL in bt_tbi_link and the card on "Link trimis" with
 * tbi_order_id / tbi_token; /api/tbi/status (encrypted updates) moves the card: 1 → "Aprobat", 0 / 3 → "Respins /
 * Renunțat" (2, sent right after registering, only fills last_status). TBI down, a missing category or webhook secret: the old manual flow.
 * TBI, the store's prices and GoHighLevel are stubbed; the database is an in-memory Postgres.
 */
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => void fn() }))

const { freshDb, TEST_ENV } = await import('./helpers')
const { POST: RATE } = await import('@/app/api/rate-tbi/route')
const { POST: STATUS } = await import('@/app/api/tbi/status/route')
const { GET: CALC } = await import('@/app/api/tbi/calculations/route')
const { GET: ADMIN_STATUS } = await import('@/app/api/admin/tbi/status/route')
const { runDueJobs } = await import('@/server/jobs/runner')
const { resetTbiPrices } = await import('@/server/tbi-prices')
const { resetLeadsPipelineCache } = await import('@/server/integrations/ghl')
const { resetTbiSchemes } = await import('@/lib/tbi/client')
const { tbiDecryptJson, tbiEncrypt } = await import('@/lib/tbi/cryptor')

const NOW = Date.parse('2026-11-06T10:00:00Z')
const KEY = 'unit-test-encryption-key'
const SECRET = 'hook-secret-123'
const TBI_ENV = { ...TEST_ENV, TBI_RESELLER_CODE: 'unit-reseller', TBI_RESELLER_KEY: 'unit-key', TBI_ENCRYPTION_KEY: KEY, TBI_STATUS_WEBHOOK_SECRET: SECRET, TBI_DEFAULT_CATEGORY_ID: '7' }
const RULES = {
  products: {
    calm: { title: 'NEUROS Calm', price: 638000, ladder: { utc_offset: '+0200', etape: [{ de_la: '2026-11-06 00:00', pana_la: '2026-11-12 23:59', pret: 3900 }], bf_2plus: { min: 2, pct: 20 } } },
    focus: { title: 'NEUROS Focus', price: 322500, tiers: true },
    amber: { title: 'NEUROS Amber', price: 31500, deals: [{ buy: 2, get: 2, from: Date.parse('2026-11-01T22:00:00Z') / 1000, to: Date.parse('2026-11-30T22:00:00Z') / 1000 }] },
  },
}
const SCHEMES = [
  { scheme_id: 2, promo_code: 0, ftos_product: '3DECOM29CL', name: 'Promo 0', period: 6, analysis_fee: 95, insurance: 0.2, nir: 29, installment_factor: 0.183216848282904, total_due_factor: 1.09930108969742, amount_min: 1000.01, amount_max: 4000 },
  { scheme_id: 57, promo_code: 2, ftos_product: '3DECOM24CL', name: 'Promo 2', period: 6, analysis_fee: 95, insurance: 0.2, nir: 24, installment_factor: 0.180668122083225, total_due_factor: 1.08400873249935, amount_min: 4000.01, amount_max: 10000 },
]
const STAGES = ['Cerere nouă', 'Link trimis', 'Cerere completată la TBI', 'Aprobat', 'Livrat / Finalizat', 'Respins / Renunțat']

let db: Awaited<ReturnType<typeof freshDb>>
let calls: { url: string; method: string; body: Record<string, unknown> | null }[]
let tbiUp: boolean
let earlyStatus = false
let earlyAnswer = 0
let ip = 0
let who = 0
const setup = async (env: Record<string, string> = TBI_ENV) => {
  db = await freshDb(env)
}
beforeEach(async () => {
  await setup()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  resetTbiPrices()
  resetLeadsPipelineCache()
  resetTbiSchemes()
  calls = []
  tbiUp = true
  earlyStatus = false
  // The phone / email rate limit lives in memory across tests: every test is another customer.
  who++
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    const body = init.body ? JSON.parse(String(init.body)) : null
    calls.push({ url, method: init.method ?? 'GET', body })
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } })
    if (url.includes('view=tbi-data')) return json(RULES)
    if (url.startsWith('https://ro.tbi-uat.online/api/')) {
      if (!tbiUp) return json({ message: 'down' }, 503)
      if (url.endsWith('/GetCalculations')) return json(SCHEMES)
      if (url.endsWith('/RegisterApplication')) {
        // TBI posts its first status (2) before RegisterApplication answers, as on PROD.
        if (earlyStatus) {
          const orderid = String(tbiDecryptJson<Record<string, unknown>>(String(body!.data), KEY).orderid)
          earlyAnswer = (await STATUS(statusReq({ command: 'update_status', order_id: orderid, status: 2, message: 'Comanda in derulare TBI' }))).status
        }
        return json({ error: 0, order_id: 77, token: 'tok-77', url: 'https://tbi.example/journey/77' })
      }
      if (url.endsWith('/GetApplicationStatus')) return json({ error: 0, store_order_id: 'x', status: 'Comanda in derulare TBI', status_chain: [] })
    }
    if (url.endsWith('/contacts/search')) return json({ contacts: [] })
    if (url.endsWith('/contacts/upsert')) return json({ contact: { id: 'c-new' } })
    if (/\/contacts\/c-new\/(tags|notes|tasks)$/.test(url) || (init.method === 'PUT' && url.endsWith('/contacts/c-new'))) return json({ ok: true })
    if (url.includes('/opportunities/pipelines')) return json({ pipelines: [{ id: 'pipe-tbi', name: 'Rate TBI', stages: STAGES.map((n, i) => ({ id: `st-${i}`, name: n })) }] })
    if (url.includes('/customFields?model=opportunity')) return json({ customFields: ['tbi_order_id', 'tbi_token', 'last_status', 'contract_number'].map((k) => ({ id: `cf-${k}`, fieldKey: `opportunity.${k}`, name: k })) })
    if (url.endsWith('/opportunities/') && init.method === 'POST') return json({ opportunity: { id: 'opp-1' } })
    if (url.endsWith('/opportunities/opp-1') && init.method === 'PUT') return json({ ok: true })
    return json({ message: `unexpected ${url}` }, 400)
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const good = (o: Record<string, unknown> = {}) => ({
  name: 'Mario Sirbu',
  phone: `07711108${String(who).padStart(2, '0')}`,
  email: `test${who}@biohack-tech.ro`,
  items: [{ handle: 'calm', qty: 1 }, { handle: 'amber', qty: 2 }],
  period: 24,
  advance: 0,
  consent: true,
  total: 4530,
  page: '/products/calm',
  utm: {},
  eventId: 'tbi-1234567890',
  startedAt: NOW - 20_000,
  website: '',
  ...o,
})
const rateReq = (body: unknown) =>
  new NextRequest('https://biohack-tech.vercel.app/api/rate-tbi', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://biohack-tech.ro', 'x-forwarded-for': `10.8.0.${++ip}`, 'user-agent': 'test' },
    body: JSON.stringify(body),
  })
const statusReq = (payload: unknown, s = SECRET, raw?: string) =>
  new NextRequest(`https://biohack-tech.vercel.app/api/tbi/status?s=${encodeURIComponent(s)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: raw ?? JSON.stringify({ data: tbiEncrypt(JSON.stringify(payload), KEY) }),
  })
/** The route starts the job in the background (kickJobs): wait until no job is pending or running. */
const settle = async () => {
  for (let i = 0; i < 100; i++) {
    await runDueJobs()
    const open = (await db.query<{ n: number }>(`select count(*)::int as n from jobs where status in ('pending', 'running', 'retry')`)).rows[0].n
    if (!open) return
    await new Promise((r) => setTimeout(r, 20))
  }
  throw new Error('jobs did not settle')
}
const oppPuts = () => calls.filter((c) => c.method === 'PUT' && c.url.endsWith('/opportunities/opp-1')).map((c) => c.body!)
const notes = () => calls.filter((c) => c.url.endsWith('/contacts/c-new/notes')).map((c) => String(c.body!.body))

it('registers the basket at TBI (encrypted), answers with the URL and saves the application', async () => {
  const res = await RATE(rateReq(good()))
  const body = await res.json()
  expect(res.status).toBe(200)
  expect(body).toMatchObject({ ok: true, total: 4530, tbiUrl: 'https://tbi.example/journey/77' })
  const reg = calls.find((c) => c.url.endsWith('/RegisterApplication'))!
  expect(reg.body).toMatchObject({ reseller_code: 'unit-reseller', reseller_key: 'unit-key' })
  const app = tbiDecryptJson<Record<string, unknown>>(String(reg.body!.data), KEY)
  expect(app).toMatchObject({
    firstname: 'Mario',
    lastname: 'Sirbu',
    email: `test${who}@biohack-tech.ro`,
    phone: `07711108${String(who).padStart(2, '0')}`,
    items: [
      { name: 'NEUROS Calm', qty: 1, price: 3900, sku: 'calm', category: 7 },
      { name: 'NEUROS Amber', qty: 2, price: 315, sku: 'amber', category: 7 },
    ],
  })
  expect(String(app.orderid)).toMatch(/^BTR-20261106-[0-9a-f]{6}$/)
  expect(app.statusURL).toBe(`https://biohack-tech.vercel.app/api/tbi/status?s=${SECRET}`)
  expect(String(app.successRedirectURL)).toMatch(/\/api\/tbi\/result\?r=ok&o=BTR-/)
  for (const i of app.items as { imagelink: string }[]) expect(i.imagelink).toMatch(/^https:\/\/cdn\.shopify\.com\//)
  const row = (await db.query<{ tbi_order_id: number; token: string; url: string; amount: string }>('select * from tbi_applications')).rows
  expect(row).toHaveLength(1)
  expect(row[0]).toMatchObject({ tbi_order_id: 77, token: 'tok-77', url: 'https://tbi.example/journey/77' })
  expect(Number(row[0].amount)).toBe(4530)
})

it('the job puts the link in bt_tbi_link, marks it sent and moves the card to "Link trimis" with TBI ids', async () => {
  await RATE(rateReq(good()))
  await settle()
  const fields = calls.find((c) => c.method === 'PUT' && c.url.endsWith('/contacts/c-new'))!.body!.customFields as { key: string; field_value: string }[]
  expect(fields.find((f) => f.key === 'bt_tbi_link')?.field_value).toBe('https://tbi.example/journey/77')
  const tags = calls.filter((c) => c.method === 'POST' && c.url.endsWith('/contacts/c-new/tags')).flatMap((c) => c.body!.tags as string[])
  expect(tags).toContain('rate-tbi-link-trimis')
  expect(oppPuts()).toContainEqual({ pipelineId: 'pipe-tbi', pipelineStageId: 'st-1', customFields: [{ id: 'cf-tbi_order_id', field_value: '77' }, { id: 'cf-tbi_token', field_value: 'tok-77' }] })
  expect(notes()[0]).toMatch(/TBI: cererea e înregistrată \(comanda BTR-.*TBI 77, mediu de TEST\)/)
  const row = (await db.query<{ contact_id: string; opportunity_id: string }>('select * from tbi_applications')).rows[0]
  expect(row).toMatchObject({ contact_id: 'c-new', opportunity_id: 'opp-1' })
})

it('status updates move the card: 2 in progress (no move), 1 approved (contract), 3 rejected; both field spellings', async () => {
  await RATE(rateReq(good()))
  await settle()
  const ref = (await db.query<{ order_ref: string }>('select order_ref from tbi_applications')).rows[0].order_ref
  // The documentation's encrypted example: snake_case, numeric status.
  expect((await STATUS(statusReq({ command: 'update_status', order_id: ref, status: 2, message: 'Comanda in derulare TBI', motive: '', contract_id: '' }))).status).toBe(200)
  // 2 comes right after RegisterApplication: the card stays on "Link trimis", only last_status changes.
  expect(oppPuts().at(-1)).toEqual({ customFields: [{ id: 'cf-last_status', field_value: '2 Comanda in derulare TBI' }] })
  // The documentation's table: OrderId / Status / ContractNumber.
  expect((await STATUS(statusReq({ command: 'update_status', OrderId: ref, Status: '1', Message: 'Plata TBI acceptata', Motive: '', ContractNumber: '20266032281' }))).status).toBe(200)
  expect(oppPuts().at(-1)).toMatchObject({ pipelineStageId: 'st-3', status: 'open', customFields: [{ id: 'cf-last_status', field_value: '1 Plata TBI acceptata' }, { id: 'cf-contract_number', field_value: '20266032281' }] })
  expect(notes().at(-1)).toMatch(/TBI · Aprobat de TBI[\s\S]*Contract: 20266032281/)
  await STATUS(statusReq({ command: 'update_status', OrderId: ref, Status: '3', Message: 'Comanda anulata TBI', Motive: 'Venit insuficient', Contract_id: '' }))
  expect(oppPuts().at(-1)).toMatchObject({ pipelineStageId: 'st-5', status: 'lost' })
  expect(notes().at(-1)).toMatch(/Motiv: Venit insuficient/)
  const row = (await db.query<{ status_code: number; contract_number: string; events: unknown[] }>('select * from tbi_applications')).rows[0]
  expect(row).toMatchObject({ status_code: 3, contract_number: '20266032281' })
  expect(row.events).toHaveLength(4)
})

it('the status TBI sends while RegisterApplication answers is kept; the card stays on Link trimis', async () => {
  earlyStatus = true
  await RATE(rateReq(good()))
  await settle()
  expect(earlyAnswer).toBe(200)
  const row = (await db.query<{ status_code: number; url: string; tbi_order_id: number; events: { kind: string }[] }>('select * from tbi_applications')).rows[0]
  expect(row).toMatchObject({ status_code: 2, url: 'https://tbi.example/journey/77', tbi_order_id: 77 })
  expect(row.events.map((e) => e.kind)).toEqual(['registered', 'status'])
  expect(oppPuts().map((p) => p.pipelineStageId).filter(Boolean)).toEqual(['st-1'])
})

it('a status that arrives before the card is applied when the job creates it', async () => {
  await RATE(rateReq(good()))
  const ref = (await db.query<{ order_ref: string }>('select order_ref from tbi_applications')).rows[0].order_ref
  expect((await STATUS(statusReq({ command: 'update_status', OrderId: ref, Status: 0, Message: 'Comanda anulata TBI' }))).status).toBe(200)
  expect(oppPuts()).toHaveLength(0)
  await settle()
  expect(oppPuts().at(-1)).toMatchObject({ pipelineStageId: 'st-5', status: 'abandoned' })
})

it('rejects a wrong secret or undecryptable data and accepts an unknown order with 200', async () => {
  expect((await STATUS(statusReq({ command: 'update_status', OrderId: 'x' }, 'wrong'))).status).toBe(401)
  expect((await STATUS(statusReq(null, SECRET, JSON.stringify({ data: tbiEncrypt('{"a":1}', 'other-key') })))).status).toBe(400)
  expect((await STATUS(statusReq(null, SECRET, '{}'))).status).toBe(400)
  expect((await STATUS(statusReq({ command: 'update_status', OrderId: 'BTR-unknown', Status: 1 }))).status).toBe(200)
  // Form-encoded body works too.
  const form = `data=${encodeURIComponent(tbiEncrypt(JSON.stringify({ command: 'update_status', OrderId: 'BTR-unknown', Status: 2 }), KEY))}`
  expect((await STATUS(statusReq(null, SECRET, form))).status).toBe(200)
})

it('TBI down: no link, the request goes on the manual way (link cleared, card on "Cerere nouă")', async () => {
  tbiUp = false
  const body = await (await RATE(rateReq(good()))).json()
  expect(body.tbiUrl).toBeUndefined()
  await settle()
  const fields = calls.find((c) => c.method === 'PUT' && c.url.endsWith('/contacts/c-new'))!.body!.customFields as { key: string; field_value: string }[]
  expect(fields.find((f) => f.key === 'bt_tbi_link')?.field_value).toBe('')
  expect(oppPuts()).toHaveLength(0)
  const rows = (await db.query<{ url: string | null; events: { kind: string }[] }>('select * from tbi_applications')).rows
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ url: null, events: [{ kind: 'register_failed' }] })
})

it('without the category id (or the webhook secret) nothing is sent to TBI', async () => {
  const { TBI_DEFAULT_CATEGORY_ID: _c, ...noCategory } = TBI_ENV
  void _c
  await setup(noCategory)
  expect((await (await RATE(rateReq(good()))).json()).tbiUrl).toBeUndefined()
  const { TBI_STATUS_WEBHOOK_SECRET: _s, ...noSecret } = TBI_ENV
  void _s
  await setup(noSecret)
  expect((await (await RATE(rateReq(good({ email: 'alt@biohack-tech.ro' })))).json()).tbiUrl).toBeUndefined()
  expect(calls.some((c) => c.url.endsWith('/RegisterApplication'))).toBe(false)
  expect((await STATUS(statusReq({ OrderId: 'x' }))).status).toBe(503)
})

it('a repeated request within 10 minutes gets the same TBI link, not a second application', async () => {
  const first = await (await RATE(rateReq(good()))).json()
  const again = await (await RATE(rateReq(good({ eventId: 'tbi-0987654321' })))).json()
  expect(again).toMatchObject({ repeat: true, tbiUrl: first.tbiUrl })
  expect(calls.filter((c) => c.url.endsWith('/RegisterApplication'))).toHaveLength(1)
})

it('calculations: TBI schemes cached a day, with (amount + analysis_fee) × installment_factor', async () => {
  const get = (q = '') => CALC(new NextRequest(`https://biohack-tech.vercel.app/api/tbi/calculations${q}`, { headers: { origin: 'https://biohack-tech.ro' } }))
  const b = await (await get('?amount=3900')).json()
  expect(b).toMatchObject({ ok: true, env: 'uat', stale: false, amount: 3900 })
  expect(b.quotes).toEqual([{ schemeId: 2, name: 'Promo 0', ftosProduct: '3DECOM29CL', period: 6, nir: 29, analysisFee: 95, monthly: 731.95, total: 4391.71 }])
  // The store's simulator asks only for the quotes.
  const lite = await (await get('?amount=3900&only=quotes')).json()
  expect(lite).toEqual({ ok: true, env: 'uat', stale: false, amount: 3900, quotes: b.quotes })
  await get('?amount=5000')
  expect(calls.filter((c) => c.url.endsWith('/GetCalculations'))).toHaveLength(1)
  // A day later TBI is down: the last list is served as stale.
  vi.setSystemTime(NOW + 25 * 3_600_000)
  tbiUp = false
  expect(await (await get()).json()).toMatchObject({ ok: true, stale: true })
})

it('admin status: only with the secret; the saved application and TBI\'s status, never the token', async () => {
  vi.stubEnv('TBI_ADMIN_SECRET', 'a'.repeat(40))
  await RATE(rateReq(good()))
  await settle()
  const ref = (await db.query<{ order_ref: string }>('select order_ref from tbi_applications')).rows[0].order_ref
  const get = (q: string, auth?: string) => ADMIN_STATUS(new NextRequest(`https://biohack-tech.vercel.app/api/admin/tbi/status${q}`, { headers: auth ? { authorization: auth } : {} }))
  expect((await get(`?ref=${ref}`)).status).toBe(401)
  expect((await get(`?ref=${ref}`, 'Bearer wrong')).status).toBe(401)
  const res = await get('?ref=77', `Bearer ${'a'.repeat(40)}`)
  expect(res.status).toBe(200)
  const body = await res.json()
  expect(body.saved).toMatchObject({ orderRef: ref, tbiOrderId: 77 })
  expect(body.tbi).toMatchObject({ status: 'Comanda in derulare TBI' })
  expect(JSON.stringify(body)).not.toContain('tok-77')
  expect((await get('?ref=BTR-20990101-abcdef', `Bearer ${'a'.repeat(40)}`)).status).toBe(404)
})
