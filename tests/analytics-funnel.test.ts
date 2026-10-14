/** Meta funnel events: only with marketing consent and a running pixel; Lead is standard, the rest custom; stable ids. */
import { beforeEach, expect, it, vi } from 'vitest'

let marketing = false
let loaded = false
vi.mock('@/lib/consent/store', () => ({ consentStore: { allows: (c: string) => c === 'marketing' && marketing } }))
vi.mock('@/lib/consent/vendors', () => ({ isLoaded: () => loaded }))
const { trackFunnel, track, itemOf } = await import('@/lib/analytics')
const { getProduct } = await import('@/content/catalog')

const fbq = vi.fn()
beforeEach(() => {
  fbq.mockClear()
  marketing = false
  loaded = false
  vi.stubGlobal('window', { fbq })
})

it('sends nothing without marketing consent or without the pixel, and queues nothing for later', () => {
  trackFunnel('Lead', { product: 'balance-wave' }, 'lead-1')
  loaded = true
  trackFunnel('Lead', { product: 'balance-wave' }, 'lead-1')
  marketing = true
  loaded = false
  trackFunnel('Lead', { product: 'balance-wave' }, 'lead-1')
  expect(fbq).not.toHaveBeenCalled()
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

it('AddToCart and Purchase map to the standard Meta events; Purchase carries the order number as event id', () => {
  marketing = loaded = true
  const p = getProduct('balance-wave')!
  track('add_to_cart', { value: p.price!, items: [itemOf(p)] })
  track('purchase', { value: p.price!, items: [itemOf(p)], transaction_id: 'BHT-20261014-0001' })
  expect(fbq.mock.calls.map((c) => [c[1], c[3]])).toEqual([
    ['AddToCart', undefined],
    ['Purchase', { eventID: 'BHT-20261014-0001' }],
  ])
})
