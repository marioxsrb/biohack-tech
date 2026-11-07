/**
 * Shopify Flow → GHL (/api/webhooks/shopify-flow): abandoned checkouts write the cart fields then re-add
 * bt-abandon-shopify; signups add shopify_newsletter once (and shopify_popup-bf-2026 from the BF popup). Secret,
 * unusable bodies and GHL failures. GoHighLevel is stubbed.
 */
import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { cartLabel, parseFlowEvent } from '@/server/marketing/shopify-flow'

const SECRET = 's'.repeat(40)
let secret: string | null
vi.mock('@/server/config', () => ({
  getConfig: () => ({ shopifyFlow: { secret }, ghl: { token: 'pit', locationId: 'loc-bt', pipelineId: '', apiBase: 'https://ghl.test' } }),
}))
const { POST } = await import('@/app/api/webhooks/shopify-flow/route')

let calls: { url: string; method: string; body: Record<string, unknown> | null }[]
let contacts: { id: string; tags: string[] }[]
let ghlDown: boolean

beforeEach(() => {
  secret = SECRET
  calls = []
  contacts = [{ id: 'c1', tags: ['bt-bf26'] }]
  ghlDown = false
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    const body = init.body ? JSON.parse(String(init.body)) : null
    calls.push({ url, method: init.method ?? 'GET', body })
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } })
    if (ghlDown) return json({ message: 'down' }, 503)
    if (url.endsWith('/contacts/search')) return json({ contacts })
    if (url.endsWith('/contacts/search/duplicate') || url.includes('/contacts/search/duplicate?')) return json({ contact: contacts[0] ?? null })
    if (url.endsWith('/contacts/upsert')) return json({ contact: { id: 'c-new' } })
    if (/\/contacts\/c(1|-new)$/.test(url) && init.method === 'PUT') return json({ contact: {} })
    if (/\/contacts\/c(1|-new)\/tags$/.test(url)) return json({ tags: [] })
    return json({ message: `unexpected ${init.method} ${url}` }, 400)
  })
})

const req = (body: unknown, s: string | null = SECRET) =>
  new NextRequest('https://biohack-tech.vercel.app/api/webhooks/shopify-flow', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(s && { 'x-bt-secret': s }) },
    body: JSON.stringify(body),
  })
const abandoned = { type: 'abandoned', email: ' Ana@Example.COM ', firstName: 'Ana', lastName: 'Pop', checkoutUrl: 'https://biohack-tech.ro/checkouts/cn/abc/recover?key=1', items: 'NEUROS Calm x1, NEUROS Amber, cadou la Calm x1' }

it('abandoned checkout: cart fields first, then bt-abandon-shopify removed and added again (restarts S01)', async () => {
  const res = await POST(req(abandoned))
  expect([res.status, await res.json()]).toEqual([200, { ok: true, action: 'abandoned' }])
  const fields = calls.find((c) => c.method === 'PUT' && Array.isArray(c.body?.customFields))!
  expect(fields.body!.customFields).toEqual([
    { key: 'bt_checkout_url', field_value: 'https://biohack-tech.ro/checkouts/cn/abc/recover?key=1' },
    { key: 'bt_cart_items', field_value: 'NEUROS Calm x1, NEUROS Amber x1, cadou la Calm x1' },
    { key: 'bt_product_name', field_value: 'NEUROS Calm' },
  ])
  const tagCalls = calls.filter((c) => c.url.endsWith('/tags')).map((c) => [c.method, c.body!.tags])
  expect(tagCalls).toEqual([['DELETE', ['bt-abandon-shopify']], ['POST', ['bt-abandon-shopify']]])
  expect(calls.indexOf(fields)).toBeLessThan(calls.findIndex((c) => c.url.endsWith('/tags')))
  expect(calls[0].body).toMatchObject({ filters: [{ field: 'email', operator: 'eq', value: 'ana@example.com' }] })
})

it('signup: shopify_newsletter (and the BF popup tag) once; an address that already has it only gets the popup tag', async () => {
  const r1 = await POST(req({ type: 'subscribed', email: 'nou@example.com', tags: 'newsletter, popup-bf-2026' }))
  expect(await r1.json()).toEqual({ ok: true, action: 'subscribed' })
  expect(calls.filter((c) => c.url.endsWith('/tags')).map((c) => [c.method, c.body!.tags])).toEqual([['POST', ['shopify_newsletter', 'shopify_popup-bf-2026']]])
  calls = []
  contacts = [{ id: 'c1', tags: ['shopify_newsletter'] }]
  const r2 = await POST(req({ type: 'subscribed', email: 'nou@example.com', tags: 'newsletter' }))
  expect(await r2.json()).toEqual({ ok: true, action: 'already_subscribed' })
  expect(calls.filter((c) => c.url.endsWith('/tags'))).toHaveLength(0)
})

it('secret, unusable bodies and GHL failures', async () => {
  expect((await POST(req(abandoned, null))).status).toBe(401)
  expect((await POST(req(abandoned, 'x'.repeat(40)))).status).toBe(401)
  expect(await (await POST(req({ type: 'abandoned', email: 'a@b.ro', checkoutUrl: 'javascript:1' }))).json()).toEqual({ skipped: 'unusable' })
  expect(await (await POST(req({ type: 'other', email: 'a@b.ro' }))).json()).toEqual({ skipped: 'unusable' })
  expect(await (await POST(req({ type: 'subscribed', email: 'nu-e-email' }))).json()).toEqual({ skipped: 'unusable' })
  ghlDown = true
  expect((await POST(req(abandoned))).status).toBe(502)
  secret = null
  expect((await POST(req(abandoned))).status).toBe(404)
})

it('parses the items however Flow sends them', () => {
  expect(parseFlowEvent({ type: 'abandoned', email: 'a@b.ro', checkoutUrl: 'https://x.ro/c', items: [{ title: 'NEUROS Focus', quantity: 2 }] })).toMatchObject({ items: [{ title: 'NEUROS Focus', qty: 2 }] })
  expect(cartLabel([{ title: 'NEUROS Calm', qty: 1 }, { title: 'NEUROS Amber', qty: 2 }])).toBe('NEUROS Calm x1, NEUROS Amber x2')
})
