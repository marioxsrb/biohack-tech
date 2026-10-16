/**
 * Server Purchase: queued once when an order is paid, skipped when META_CAPI_ACCESS_TOKEN is absent,
 * value in lei with the same event id the pixel uses.
 */
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: () => {} }))

const { freshDb, lines, person, TEST_ENV } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { orders } = await import('@/server/orders/repository')
const { jobs } = await import('@/server/jobs/outbox')
const { getConfig } = await import('@/server/config')
const { metaPurchaseBody, sendMetaPurchase } = await import('@/server/integrations/meta')
const { POST: checkout } = await import('@/app/api/checkout/route')

const hash = (s: string) => createHash('sha256').update(s).digest('hex')
const kinds = async (db: Awaited<ReturnType<typeof freshDb>>, id: string) => (await jobs.forOrder(db, id)).map((j) => j.kind)

afterEach(() => vi.unstubAllGlobals())

describe('Conversions API', () => {
  it('does not queue a Purchase when the token is absent', async () => {
    const db = await freshDb()
    const { order } = await svc.placeOrder({ lines: lines([{ productId: 'balance-wave', quantity: 1 }]), form: { ...person, paymentMethod: 'transfer' }, attemptId: 'meta-off' })
    await svc.confirmPayment(order.id, 'admin')
    expect(await kinds(db, order.id)).not.toContain('meta.purchase')
  })

  it('stores the browser signals, then sends one Purchase in lei with the order number as event id', async () => {
    const db = await freshDb({ ...TEST_ENV, META_CAPI_ACCESS_TOKEN: 'EAAB-test-token', META_CAPI_TEST_EVENT_CODE: 'TEST12345' })
    const res = await checkout(
      new Request('https://calm.biohack-tech.ro/api/checkout', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0 MetaTest',
          'x-forwarded-for': '203.0.113.9',
          'x-forwarded-host': 'calm.biohack-tech.ro',
          cookie: '_fbp=fb.1.1700000000000.1234567890; _fbc=fb.1.1700000000000.IwAR0abcdefghij',
        },
        body: JSON.stringify({
          lines: [{ productId: 'balance-wave', quantity: 1 }],
          order: { ...person, paymentMethod: 'transfer' },
          acceptedTerms: true,
          attemptId: 'meta-on',
          attribution: { lp: 'calm', lp_host: 'calm.biohack-tech.ro', utm_source: 'facebook', fbclid: 'IwAR0abcdefghij', meta: { ip: '198.51.100.1', ua: 'spoofed' } },
        }),
      }) as never,
    )
    expect(res.status).toBe(200)
    const order = (await orders.byToken(db, (await res.json()).token))!
    // The body's meta object is dropped; the cookies and this request are what was stored.
    expect(order.attribution?.meta).toEqual({
      fbp: 'fb.1.1700000000000.1234567890',
      fbc: 'fb.1.1700000000000.IwAR0abcdefghij',
      ip: '203.0.113.9',
      ua: 'Mozilla/5.0 MetaTest',
      host: 'calm.biohack-tech.ro',
    })
    expect(order.attribution?.fbclid).toBe('IwAR0abcdefghij')

    const paid = (await svc.confirmPayment(order.id, 'admin')).order!
    await svc.confirmPayment(order.id, 'admin')
    expect((await kinds(db, order.id)).filter((k) => k === 'meta.purchase')).toEqual(['meta.purchase'])

    const body = metaPurchaseBody(paid, 'https://test.biohack-tech.ro', 'TEST12345')!
    expect(body.test_event_code).toBe('TEST12345')
    expect(body.data[0]).toMatchObject({
      event_name: 'Purchase',
      event_id: paid.orderNumber,
      action_source: 'website',
      event_source_url: `https://calm.biohack-tech.ro/comanda/${paid.publicToken}`,
      custom_data: {
        currency: 'RON',
        value: 6380,
        content_ids: ['balance-wave'],
        contents: [{ id: 'balance-wave', quantity: 1, item_price: 6380 }],
        num_items: 1,
        order_id: paid.orderNumber,
      },
    })
    expect(body.data[0].custom_data.value).not.toBe(paid.totalMinor)
    const user = body.data[0].user_data
    expect(user).toMatchObject({
      em: [hash('ana@exemplu.ro')],
      ph: [hash('40722123456')],
      fbp: 'fb.1.1700000000000.1234567890',
      fbc: 'fb.1.1700000000000.IwAR0abcdefghij',
      client_ip_address: '203.0.113.9',
      client_user_agent: 'Mozilla/5.0 MetaTest',
    })
    const raw = JSON.stringify(body)
    expect(raw).not.toContain('ana@exemplu.ro')
    expect(raw).not.toContain('0722123456')
    expect(raw).not.toContain('EAAB')

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toContain('https://graph.facebook.com/v21.0/967887562483664/events')
      expect(String(url)).toContain('access_token=EAAB-test-token')
      expect(JSON.parse(String(init?.body)).data[0].event_id).toBe(paid.orderNumber)
      return new Response(JSON.stringify({ events_received: 1 }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    expect(await sendMetaPurchase(getConfig().metaCapi!, paid, 'https://test.biohack-tech.ro')).toBe('events_received=1')
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
