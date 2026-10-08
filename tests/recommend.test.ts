/**
 * The one recommendation engine (cart, checkout, post-payment), the NEUROS Amber 2+1 picker logic,
 * the all-or-nothing cart add, entry sources and the consent gate of the new analytics events.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { amberModels, amberTotals, pairsToLines } from '@/lib/amber-pairs'
import { recommend } from '@/lib/recommend'
import { upsellsFor } from '@/lib/upsell'
import { sanitizeAttribution } from '@/lib/attribution'

const L = (productId: string, quantity = 1, variantId?: string) => ({ productId, variantId, quantity })
const ids = (r: { productId: string }[]) => r.map((x) => x.productId)

describe('recommendations: one engine, deterministic', () => {
  // The final matrix, the same for cart, checkout and after payment (complementary products only).
  // The products offered (a 20% row whose image is a product already there offers the picker, not that product).
  const cross = (set: string[], placement: 'cart' | 'checkout' | 'post_purchase') => ids(recommend(set.map((p) => L(p, 1, p === 'brain-flow' ? '4-zone' : p === 'ochelari-biohack' ? 'cat-eye-bej' : undefined)), placement).filter((r) => !set.includes(r.productId)))
  const [CALM, FOCUS, AMBER, FLOW] = ['balance-wave', 'brainlink-pro', 'ochelari-biohack', 'brain-flow']
  it.each([
    [[CALM], [AMBER, FOCUS]],
    [[FLOW], [CALM, FOCUS]],
    [[FOCUS], [AMBER, CALM]],
    [[AMBER], [CALM, FOCUS]],
    [[CALM, AMBER], [FOCUS]],
    [[CALM, FOCUS], [AMBER]],
    [[FLOW, CALM], [FOCUS]],
    [[FLOW, FOCUS], [CALM]],
    [[CALM, FOCUS, AMBER], []],
  ])('matrix %j → %j, in the cart, in checkout and after payment', (set, expected) => {
    for (const placement of ['cart', 'post_purchase'] as const) expect(cross(set, placement)).toEqual(expected)
    // Checkout shows two; a promotion row may take a place, the complements keep their order.
    const checkout = recommend(set.map((p) => L(p, 1, p === FLOW ? '4-zone' : p === AMBER ? 'cat-eye-bej' : undefined)), 'checkout')
    expect(checkout.length).toBeLessThanOrEqual(2)
    expect(expected.slice(0, 2 - checkout.filter((r) => r.kind === 'complete_offer').length).every((id) => checkout.some((r) => r.productId === id))).toBe(true)
    expect(ids(checkout)).not.toContain(FLOW)
    // Never a duplicate, never a product already there as a plain complement, never NEUROS Flow.
    const cart = recommend(set.map((p) => L(p)), 'cart')
    expect(new Set(ids(cart)).size).toBe(cart.length)
    for (const r of cart.filter((x) => x.kind === 'cross_sell')) expect(set).not.toContain(r.productId)
  })

  it('post-payment: up to two choices, never a promotion completion, never NEUROS Flow', () => {
    expect([[CALM], [FLOW], [FOCUS], [AMBER]].map((p) => upsellsFor(p).map((x) => x.productId))).toEqual([
      [AMBER, FOCUS],
      [CALM, FOCUS],
      [AMBER, CALM],
      [CALM, FOCUS],
    ])
    expect(upsellsFor([CALM, FOCUS]).map((x) => x.productId)).toEqual([AMBER])
    expect(upsellsFor([CALM, FOCUS, AMBER])).toEqual([])
    expect(recommend([L(CALM), L(FOCUS)], 'post_purchase').map((x) => x.kind)).not.toContain('complete_offer')
  })

  it('never suggests what is already in the cart (without a promotion reason)', () => {
    const r = recommend([L('balance-wave')], 'cart')
    expect(ids(r)).not.toContain('balance-wave')
    expect(ids(r)).toEqual(['ochelari-biohack', 'brainlink-pro'])
    expect(ids(recommend([L('balance-wave'), L('brainlink-pro'), L('ochelari-biohack', 1, 'cat-eye-bej')], 'checkout'))).not.toContain('ochelari-biohack')
  })

  it('a nearby promotion comes first: the next Amber pair, then one row for the 20% (the 3-product picker)', () => {
    const r = recommend([L('balance-wave'), L('brainlink-pro'), L('ochelari-biohack', 2, 'cat-eye-bej')], 'cart')
    expect(r.slice(0, 2).map((x) => [x.productId, x.kind, x.add, x.slots])).toEqual([
      ['ochelari-biohack', 'complete_offer', 'amber_pairs', 1],
      ['balance-wave', 'complete_offer', 'bundle', 1],
    ])
  })

  it('20% one away: a single suggestion that opens the picker for the missing product (never three product rows)', () => {
    const r = recommend([L('balance-wave'), L('brainlink-pro')], 'cart')
    expect(r.filter((x) => x.kind === 'complete_offer')).toEqual([expect.objectContaining({ add: 'bundle', slots: 1, promotionId: 'trei-produse-20' })])
    // With NEUROS Flow the matrix product (Focus) is the missing one: offered directly, as the completion.
    expect(recommend([L('balance-wave'), L('brain-flow', 1, '4-zone')], 'cart')[0]).toMatchObject({ productId: 'brainlink-pro', kind: 'complete_offer', add: 'direct' })
  })

  it('Amber beyond the first 2+1: suggested again only when the next free pair is one pair away (5, 8...), never at 3, 4, 6, 7', () => {
    const amberAt = (n: number) => recommend([L('ochelari-biohack', n, 'cat-eye-bej')], 'cart').find((x) => x.productId === 'ochelari-biohack')
    for (const n of [3, 4, 6, 7, 9]) expect(amberAt(n)).toBeUndefined()
    for (const n of [2, 5, 8]) expect(amberAt(n)).toMatchObject({ kind: 'complete_offer', slots: 1 })
  })

  it('Amber is offered as a 3-pair 2+1 set when there is none; no promotions after payment', () => {
    expect(recommend([L('brainlink-pro')], 'checkout')[0]).toMatchObject({ productId: 'ochelari-biohack', add: 'amber_pairs', slots: 3 })
    expect(recommend([L('ochelari-biohack', 2, 'cat-eye-bej')], 'post_purchase').map((x) => x.kind)).not.toContain('complete_offer')
  })

  it('promotion first, complements as the fallback: Calm + Focus → the 20% picker, then NEUROS Amber', () => {
    expect(recommend([L('balance-wave'), L('brainlink-pro')], 'checkout').map((x) => [x.kind, x.add, x.productId])).toEqual([
      ['complete_offer', 'bundle', 'balance-wave'],
      ['cross_sell', 'amber_pairs', 'ochelari-biohack'],
    ])
    // NEUROS Flow + Calm: the product the matrix suggests (Focus) is also the one that completes the 20%: one row, added directly.
    expect(recommend([L('brain-flow', 1, '4-zone'), L('balance-wave')], 'cart').map((x) => [x.kind, x.add, x.productId])).toEqual([['complete_offer', 'direct', 'brainlink-pro']])
    expect(recommend([L('brain-flow', 1, '4-zone'), L('brainlink-pro')], 'checkout').map((x) => [x.kind, x.add, x.productId])).toEqual([['complete_offer', 'direct', 'balance-wave']])
    // Nothing left to complement: the 20% picker only.
    expect(recommend([L('balance-wave'), L('brainlink-pro'), L('ochelari-biohack', 1, 'cat-eye-bej')], 'cart').map((x) => [x.kind, x.add])).toEqual([['complete_offer', 'bundle']])
  })

  it('checkout shows at most two, post-payment two choices', () => {
    expect(recommend([L('balance-wave'), L('brainlink-pro'), L('ochelari-biohack', 2, 'cat-eye-bej')], 'checkout')).toHaveLength(2)
    expect(recommend([L('balance-wave')], 'post_purchase')).toHaveLength(2)
  })
})

describe('NEUROS Amber 2+1 picker', () => {
  it('offers only frames that exist: cat eye (negru, bej), unisex pătrat (negru, maro)', () => {
    expect(amberModels().map((m) => [m.id, m.colours.map((c) => c.variantId)])).toEqual([
      ['cat-eye', ['cat-eye-negru', 'cat-eye-bej']],
      ['patrat', ['patrat-negru', 'patrat-maro']],
    ])
  })

  it('three different frames stay three lines; two identical merge; three identical are one line × 3', () => {
    expect(pairsToLines(['cat-eye-negru', 'cat-eye-bej', 'patrat-maro'])?.map((l) => [l.variantId, l.quantity])).toEqual([
      ['cat-eye-negru', 1],
      ['cat-eye-bej', 1],
      ['patrat-maro', 1],
    ])
    expect(pairsToLines(['patrat-negru', 'patrat-negru', 'cat-eye-bej'])?.map((l) => [l.variantId, l.quantity])).toEqual([
      ['patrat-negru', 2],
      ['cat-eye-bej', 1],
    ])
    expect(pairsToLines(['cat-eye-bej', 'cat-eye-bej', 'cat-eye-bej'])).toEqual([{ productId: 'ochelari-biohack', variantId: 'cat-eye-bej', quantity: 3 }])
  })

  it('incomplete or invented picks add nothing', () => {
    expect(pairsToLines(['cat-eye-negru', null, 'patrat-maro'])).toBeNull()
    expect(pairsToLines(['cat-eye-maro', 'cat-eye-bej', 'patrat-maro'])).toBeNull()
  })

  it('totals come from the promotion engine, including pairs already in the cart', () => {
    expect(amberTotals([], ['cat-eye-negru', 'cat-eye-bej', 'patrat-maro'])).toMatchObject({ subtotalMinor: 94500, discountMinor: 31500, totalMinor: 63000 })
    expect(amberTotals([{ variantId: 'cat-eye-bej', quantity: 2 }], ['patrat-negru'])).toMatchObject({ subtotalMinor: 94500, discountMinor: 31500, totalMinor: 63000, units: 3 })
  })
})

describe('cart: all-or-nothing add and entry sources', () => {
  let storage: Map<string, string>
  beforeEach(() => {
    vi.unstubAllGlobals()
    storage = new Map()
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v) }, addEventListener() {}, removeEventListener() {} })
  })
  const store = async () => {
    vi.resetModules()
    return (await import('@/components/cart/cart-store')).cartStore
  }

  it('adds the three pairs in one step, keeps other lines and their first source', async () => {
    const s = await store()
    s.add('balance-wave', undefined, 1, 'landing')
    expect(s.addMany(pairsToLines(['cat-eye-negru', 'cat-eye-bej', 'patrat-maro'])!, 'checkout_cross_sell')).toBe(true)
    expect(s.getSnapshot().map((l) => [l.productId, l.variantId, l.quantity, l.source])).toEqual([
      ['balance-wave', undefined, 1, 'landing'],
      ['ochelari-biohack', 'cat-eye-negru', 1, 'checkout_cross_sell'],
      ['ochelari-biohack', 'cat-eye-bej', 1, 'checkout_cross_sell'],
      ['ochelari-biohack', 'patrat-maro', 1, 'checkout_cross_sell'],
    ])
  })

  it('one invalid pick → nothing is added', async () => {
    const s = await store()
    expect(s.addMany([{ productId: 'ochelari-biohack', variantId: 'cat-eye-negru' }, { productId: 'ochelari-biohack', variantId: 'nu-exista' }], 'amber_configurator')).toBe(false)
    expect(s.getSnapshot()).toEqual([])
  })

  it('a suggestion added later never replaces the order acquisition (entry = the first line)', () => {
    // The checkout sends `entry` from the first line; campaign parameters come from the URL, untouched.
    const a = sanitizeAttribution({ lp: 'calm', lp_host: 'calm.biohack-tech.ro', utm_campaign: 'toamna', entry: 'landing' }, 'biohack-tech.ro', 'biohack-tech.ro')
    expect(a).toMatchObject({ landing: 'calm', utm: { utm_campaign: 'toamna' }, entry: 'landing' })
    expect(sanitizeAttribution({ entry: 'checkout_cross_sell' }, 'biohack-tech.ro')).toEqual({ entry: 'checkout_cross_sell' })
  })
})

describe('analytics: suggestion events only with consent', () => {
  it('sends nothing without analytics consent and a running GA4', async () => {
    vi.resetModules()
    const gtag = vi.fn()
    vi.stubGlobal('window', { gtag, localStorage: { getItem: () => null, setItem() {} } })
    const { trackUi } = await import('@/lib/analytics')
    trackUi('add_cross_sell', { placement: 'checkout', product_id: 'ochelari-biohack' })
    trackUi('open_amber_bundle_configurator', { placement: 'homepage' })
    expect(gtag).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe('pages', () => {
  const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')
  it('homepage shelf: the product image is a link to the product page', () => {
    const src = read('src/components/home/Discover.tsx')
    expect(src.match(/<Link href=\{productHref\(p\)\} aria-label=\{view\(p\.name\)\}/g)?.length).toBe(2)
  })
  it('product page: price, quantity, bundle offers, then the order buttons, contact and trust row; Amber opens the pair picker', () => {
    const hero = read('src/components/product/ProductHero.tsx')
    const at = (s: string) => hero.indexOf(s)
    expect(at('<SocialProof')).toBeLessThan(at('<h1'))
    expect(at('<h1')).toBeLessThan(at('<Highlights'))
    expect(at('<Highlights')).toBeLessThan(at('<PriceBlock'))
    expect(at('<PriceBlock')).toBeLessThan(at('product.options?.map'))
    expect(at('product.options?.map')).toBeLessThan(at('<QuantityStepper'))
    expect(at('<QuantityStepper')).toBeLessThan(at('<BundleOffer'))
    expect(at('<BundleOffer')).toBeLessThan(at('<BuyNowButton'))
    expect(at('<BuyNowButton')).toBeLessThan(at('<ContactOrder'))
    expect(at('<ContactOrder')).toBeLessThan(at('<AddToCartButton'))
    expect(at('<AddToCartButton')).toBeLessThan(at('<TrustRow'))
    const box = read('src/components/product/BuyBox.tsx')
    expect(box).toContain("openAmber('product_page', 3)")
    // The rows use the cart's own engine on this product; choosing one sets the quantity, it adds nothing by itself.
    expect(box).toContain("priceLines([{ key: 'x', productId, quantity: n, unitAmount: unit }])")
    expect(box).toContain('onClick={() => onQuantity(n)}')
  })
  it('checkout: the suggestion module is the only product surface, before the payment decision', () => {
    const v = read('src/app/[lang]/(checkout)/checkout/CheckoutView.tsx')
    expect(v.indexOf('<Suggestions placement="checkout"')).toBeGreaterThan(v.indexOf('<Totals'))
    expect(v.indexOf('<Suggestions placement="checkout"')).toBeLessThan(v.indexOf('f-acceptedTerms'))
  })
})
