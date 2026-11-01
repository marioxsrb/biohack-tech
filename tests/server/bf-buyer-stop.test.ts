/**
 * Black Friday 2026: a Shopify buyer leaves the Brain Event BF workflow (/api/webhooks/shopify-order).
 * Lookup by email only (lower-cased), never a create or an update, only contacts with the campaign tag,
 * only the one workflow; off, dry and live modes. GoHighLevel is stubbed.
 */
import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'

const BE = 'r7vVLgPNRqJaEPUCZdOt'
const WF = '2faa89c2-33ca-4614-a570-25d9ff228cbf'
let cfg: { mode: 'off' | 'dry' | 'live'; secret: string | null; location: string }
vi.mock('@/server/config', () => ({
  getConfig: () => ({
    bfBuyerStop: { mode: cfg.mode, secret: cfg.secret },
    ghlTagMirrors: [{ token: 'pit-brain', locationId: cfg.location, pipelineId: '', apiBase: 'https://ghl.test' }],
  }),
}))
const { POST } = await import('@/app/api/webhooks/shopify-order/route')

let calls: { url: string; method: string; body: Record<string, unknown> | null }[]
let contacts: { id: string; tags: string[] }[]
let ghlDown: boolean

beforeEach(() => {
  cfg = { mode: 'live', secret: 'flow-secret-for-tests', location: BE }
  calls = []
  contacts = [{ id: 'c1', tags: ['bt-bf26', 'webinar'] }]
  ghlDown = false
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    const body = init.body ? JSON.parse(String(init.body)) : null
    calls.push({ url, method: init.method ?? 'GET', body })
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } })
    if (ghlDown) return json({ message: 'down' }, 503)
    if (url.endsWith('/contacts/search')) return json({ contacts })
    if (init.method === 'DELETE' && url.includes('/workflow/')) return json({ succeded: true })
    return json({ message: 'unexpected call' }, 400)
  })
})

const req = (body: unknown, secret: string | null = 'flow-secret-for-tests') =>
  new NextRequest('https://biohack-tech.ro/api/webhooks/shopify-order', {
    method: 'POST',
    headers: secret ? { 'x-bt-secret': secret, 'content-type': 'application/json' } : { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

it('removes the tagged buyer from the Brain Event BF workflow only, looked up by the lower-cased email', async () => {
  const res = await POST(req({ email: '  Ana.Pop@Yahoo.COM ', order: '#1001' }))
  expect([res.status, await res.json()]).toEqual([200, { matched: 1, enrolled: 1, removed: 1, dryRun: false }])
  expect(calls[0].body).toMatchObject({ locationId: BE, filters: [{ field: 'email', operator: 'eq', value: 'ana.pop@yahoo.com' }] })
  expect(calls.map((c) => [c.method, c.url])).toEqual([
    ['POST', 'https://ghl.test/contacts/search'],
    ['DELETE', `https://ghl.test/contacts/c1/workflow/${WF}`],
  ])
})

it('never creates or updates a contact: an unknown address or a contact without the campaign tag is left alone', async () => {
  contacts = []
  expect(await (await POST(req({ email: 'nou@example.com' }))).json()).toEqual({ matched: 0, enrolled: 0, removed: 0, dryRun: false })
  contacts = [{ id: 'c2', tags: ['webinar'] }]
  expect(await (await POST(req({ email: 'vechi@example.com' }))).json()).toEqual({ matched: 1, enrolled: 0, removed: 0, dryRun: false })
  expect(calls.every((c) => c.url.endsWith('/contacts/search'))).toBe(true)
})

it('dry run looks up and reports, removes nothing', async () => {
  cfg.mode = 'dry'
  expect(await (await POST(req({ email: 'ana@example.com' }))).json()).toEqual({ matched: 1, enrolled: 1, removed: 0, dryRun: true })
  expect(calls.map((c) => c.method)).toEqual(['POST'])
})

it('is closed without the switch and the secret, and refuses a wrong secret', async () => {
  cfg.mode = 'off'
  expect((await POST(req({ email: 'ana@example.com' }))).status).toBe(404)
  cfg = { mode: 'live', secret: null, location: BE }
  expect((await POST(req({ email: 'ana@example.com' }))).status).toBe(404)
  cfg.secret = 'flow-secret-for-tests'
  expect((await POST(req({ email: 'ana@example.com' }, 'wrong')))).toHaveProperty('status', 401)
  expect((await POST(req({ email: 'ana@example.com' }, null)))).toHaveProperty('status', 401)
  expect(calls).toEqual([])
})

it('touches no other sub-account, skips an order without email, and asks Flow to retry when GHL fails', async () => {
  cfg.location = 'other-location'
  expect((await POST(req({ email: 'ana@example.com' }))).status).toBe(503)
  cfg.location = BE
  expect(await (await POST(req({ email: '' }))).json()).toEqual({ skipped: 'no email' })
  expect(calls).toEqual([])
  ghlDown = true
  expect((await POST(req({ email: 'ana@example.com' }))).status).toBe(502)
})
