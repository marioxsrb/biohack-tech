/** Meta funnel events: only with marketing consent and a running pixel; Lead is standard, the rest custom; stable ids. */
import { beforeEach, expect, it, vi } from 'vitest'

let marketing = false
let loaded = false
vi.mock('@/lib/consent/store', () => ({ consentStore: { allows: (c: string) => c === 'marketing' && marketing } }))
// The real start-up order: events wait for the pixel only when it is allowed and configured.
let pending: (() => void)[] = []
vi.mock('@/lib/consent/vendors', () => ({ isConfigured: () => true, whenLoaded: (_id: string, fn: () => void) => (loaded ? fn() : pending.push(fn)) }))
const start = () => {
  loaded = true
  pending.splice(0).forEach((f) => f())
}
const { trackFunnel, track, itemOf } = await import('@/lib/analytics')
const { getProduct } = await import('@/content/catalog')

const fbq = vi.fn()
beforeEach(() => {
  fbq.mockClear()
  marketing = false
  loaded = false
  pending = []
  vi.stubGlobal('window', { fbq })
})

it('sends nothing without marketing consent, and queues nothing for later', () => {
  trackFunnel('Lead', { product: 'balance-wave' }, 'lead-1')
  track('view_item', { value: 1, items: [] })
  start()
  trackFunnel('Lead', { product: 'balance-wave' }, 'lead-1')
  expect(fbq).not.toHaveBeenCalled()
  expect(pending).toEqual([])
})

it('with consent, a page’s first event (sent before the consent manager starts the pixel) arrives once, after PageView', () => {
  marketing = true
  const p = getProduct('balance-wave')!
  track('view_item', { value: p.price!, items: [itemOf(p)] })
  expect(fbq).not.toHaveBeenCalled()
  start()
  start()
  expect(fbq.mock.calls.map((c) => c[1])).toEqual(['ViewContent'])
})

it('Lead is a standard event with the lead id as event id; the others are custom; no personal data', () => {
  marketing = loaded = true
  trackFunnel('Lead', { product: 'balance-wave', funnel: 'gated_price' }, 'lead-1')
  trackFunnel('PriceRevealed', { product: 'balance-wave', funnel: 'gated_price' }, 'reveal-lead-1')
  trackFunnel('OrderPlaced', { value: 31500, payment: 'cod', funnel: 'visible_price' }, 'placed-BHT-1')
  expect(fbq.mock.calls).toEqual([
    ['track', 'Lead', { content_ids: ['balance-wave'], content_type: 'product', funnel: 'gated_price' }, { eventID: 'lead-1' }],
    ['trackCustom', 'PriceRevealed', { content_ids: ['balance-wave'], content_type: 'product', funnel: 'gated_price' }, { eventID: 'reveal-lead-1' }],
    ['trackCustom', 'OrderPlaced', { funnel: 'visible_price', currency: 'RON', value: 315, payment_method: 'cod' }, { eventID: 'placed-BHT-1' }],
  ])
  expect(JSON.stringify(fbq.mock.calls)).not.toMatch(/@|07\d{8}/)
})

it('AddToCart and Purchase map to the standard Meta events; Purchase is lei, with contents and the order number as event id', () => {
  marketing = loaded = true
  const p = getProduct('balance-wave')!
  const item = itemOf(p)
  track('add_to_cart', { value: p.price!, items: [item] })
  track('purchase', { value: p.price!, items: [item], transaction_id: 'BHT-20261014-0001' })
  expect(fbq.mock.calls.map((c) => [c[1], c[3]])).toEqual([
    ['AddToCart', undefined],
    ['Purchase', { eventID: 'BHT-20261014-0001' }],
  ])
  // 638000 bani is 6.380 lei, never the minor-unit figure Meta would treat as the order value.
  expect(fbq.mock.calls[1][2]).toEqual({
    currency: 'RON',
    value: 6380,
    content_type: 'product',
    content_ids: ['balance-wave'],
    contents: [{ id: 'balance-wave', quantity: 1, item_price: 6380 }],
    content_name: 'NEUROS Calm',
    num_items: 1,
  })
  expect(item.price).toBe(6380)
})
