/**
 * "Cumpără în rate prin TBI Bank" (/api/rate-tbi): validation (Romanian mobile, value plausible for the product),
 * spam (honeypot, minimum time, per-IP and per-phone limits), CORS for the Shopify store only, GoHighLevel
 * (contact by email, tags, note, task), the workflow webhook and the Meta Lead only with consent.
 * GoHighLevel, the webhook and Meta are stubbed.
 */
import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'

let cfg: { hook: string | null; meta: boolean }
vi.mock('@/server/config', () => ({
  getConfig: () => ({
    ghl: { token: 'pit-neuros', locationId: 'loc-neuros', pipelineId: 'p', apiBase: 'https://ghl.test' },
    metaCapi: cfg.meta ? { pixelId: '967887562483664', accessToken: 'tok', testEventCode: null, requireConsent: true } : null,
    rateTbi: { hook: cfg.hook },
  }),
}))
const { POST, OPTIONS } = await import('@/app/api/rate-tbi/route')
const { normalizeRoMobile, plausibleValue, lei } = await import('@/lib/rate-tbi')

let calls: { url: string; method: string; body: Record<string, unknown> | null }[]
let ip = 0
beforeEach(() => {
  cfg = { hook: 'https://services.leadconnectorhq.com/hooks/loc/webhook-trigger/abc', meta: true }
  calls = []
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    const body = init.body ? JSON.parse(String(init.body)) : null
    calls.push({ url, method: init.method ?? 'GET', body })
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } })
    if (url.endsWith('/contacts/search')) return json({ contacts: [] })
    if (url.endsWith('/contacts/upsert')) return json({ contact: { id: 'c-new' } })
    if (/\/contacts\/c-new\/(tags|notes|tasks)$/.test(url)) return json({ ok: true })
    if (url.startsWith('https://services.leadconnectorhq.com/hooks/')) return json({ status: 'Success' })
    if (url.startsWith('https://graph.facebook.com/')) return json({ events_received: 2 })
    return json({ message: `unexpected ${url}` }, 400)
  })
})

const good = (o: Record<string, unknown> = {}) => ({
  name: 'Ana Maria Pop',
  phone: '0722 123 456',
  email: 'Ana.Pop@Example.com',
  product: 'calm',
  qty: 2,
  city: 'Cluj-Napoca',
  consent: true,
  value: 6240,
  page: '/products/calm',
  utm: { source: 'meta', medium: 'paid', campaign: 'ABO_Calm_BF' },
  eventId: 'tbi-1234567890',
  marketing: true,
  startedAt: Date.now() - 20_000,
  website: '',
  ...o,
})
const req = (body: unknown, origin = 'https://biohack-tech.ro') =>
  new NextRequest('https://biohack-tech.vercel.app/api/rate-tbi', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, 'x-forwarded-for': `10.7.0.${++ip}`, 'user-agent': 'test' },
    body: JSON.stringify(body),
  })

it('normalises Romanian mobile numbers and refuses the rest', () => {
  expect(['0722 123 456', '+40 722-123-456', '0040722123456', '40722123456', '722123456'].map(normalizeRoMobile)).toEqual(Array(5).fill('+40722123456'))
  expect(['0212345678', '07221234', '+33612345678', ''].map(normalizeRoMobile)).toEqual([null, null, null, null])
})

it('accepts only a value that is a real price for that product and quantity', () => {
  expect(plausibleValue('calm', 2, 6240)).toBe(true)
  expect(plausibleValue('calm', 1, 6380)).toBe(true)
  expect(plausibleValue('calm', 1, 7000)).toBe(false)
  expect(plausibleValue('focus', 3, 100)).toBe(false)
  expect([lei(6240), lei(3227.5), lei(315)]).toEqual(['6.240', '3.227,50', '315'])
})

it('saves the request in GoHighLevel (contact by email, tags, note, task), calls the workflow and sends the Lead', async () => {
  const res = await POST(req(good()))
  expect([res.status, await res.json()]).toEqual([200, { ok: true }])
  expect(res.headers.get('access-control-allow-origin')).toBe('https://biohack-tech.ro')
  const ghlCalls = calls.filter((c) => c.url.startsWith('https://ghl.test'))
  expect(ghlCalls[0].body).toMatchObject({ filters: [{ field: 'email', operator: 'eq', value: 'ana.pop@example.com' }] })
  expect(ghlCalls.find((c) => c.url.endsWith('/contacts/upsert'))!.body).toMatchObject({ email: 'ana.pop@example.com', firstName: 'Ana', lastName: 'Maria Pop', phone: '+40722123456' })
  expect(ghlCalls.find((c) => c.url.endsWith('/tags'))!.body).toEqual({ tags: ['rate-tbi', 'rate-tbi-calm', 'bt-site-ro'] })
  const note = String(ghlCalls.find((c) => c.url.endsWith('/notes'))!.body!.body)
  expect(note).toContain('NEUROS Calm × 2')
  expect(note).toContain('6.240 lei')
  expect(note).toContain('source=meta')
  expect(ghlCalls.find((c) => c.url.endsWith('/tasks'))!.body).toMatchObject({ title: 'Generează Link 2 Pay – 6.240 lei', completed: false })
  const hook = calls.find((c) => c.url.includes('/hooks/'))!
  expect(hook.body).toMatchObject({ contact_id: 'c-new', first_name: 'Ana', produs: 'NEUROS Calm', cantitate: 2, valoare: '6.240', utm_source: 'meta' })
  const meta = calls.find((c) => c.url.startsWith('https://graph.facebook.com/'))!
  const events = meta.body!.data as { event_name: string; event_id: string; custom_data: { value: number; currency: string } }[]
  expect(events.map((e) => [e.event_name, e.event_id])).toEqual([['Lead', 'tbi-1234567890'], ['RateTBIRequest', 'tbi-1234567890-r']])
  expect(events[0].custom_data).toMatchObject({ value: 6240, currency: 'RON' })
  expect(JSON.stringify(meta.body)).not.toContain('ana.pop@example.com')
})

it('sends no Meta event without marketing consent, and still works without the workflow webhook', async () => {
  cfg.hook = null
  expect((await POST(req(good({ marketing: false, phone: '0733 000 111', email: 'b@example.com' })))).status).toBe(200)
  expect(calls.some((c) => c.url.startsWith('https://graph.facebook.com/'))).toBe(false)
  expect(calls.some((c) => c.url.includes('/hooks/'))).toBe(false)
  expect(calls.some((c) => c.url.endsWith('/tasks'))).toBe(true)
})

it('refuses invalid fields with the field names, and asks for no CNP or ID', async () => {
  const res = await POST(req(good({ phone: '0212345678', email: 'x', consent: false, value: 99, name: 'A', city: '' })))
  expect(res.status).toBe(422)
  expect(Object.keys((await res.json()).fields).sort()).toEqual(['city', 'consent', 'email', 'name', 'phone', 'value'])
  expect(calls).toHaveLength(0)
})

it('drops bots silently (honeypot, too fast) and limits repeats per phone', async () => {
  expect(await (await POST(req(good({ website: 'http://spam' })))).json()).toEqual({ ok: true })
  expect(await (await POST(req(good({ startedAt: Date.now() })))).json()).toEqual({ ok: true })
  expect(calls).toHaveLength(0)
  const one = good({ phone: '0744 555 666', email: 'c@example.com' })
  for (let i = 0; i < 3; i++) expect((await POST(req(one))).status).toBe(200)
  expect((await POST(req(one))).status).toBe(429)
})

it('answers CORS only for the store', () => {
  expect(OPTIONS(req({}, 'https://biohack-tech.ro')).headers.get('access-control-allow-origin')).toBe('https://biohack-tech.ro')
  expect(OPTIONS(req({}, 'https://evil.example')).headers.get('access-control-allow-origin')).toBeNull()
})
