/**
 * The one recommendation engine (cart, checkout, post-payment), the NEUROS Amber 2+1 picker logic,
 * the all-or-nothing cart add, entry sources and the consent gate of the new analytics events.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { amberModels, amberTotals, pairsToLines } from '@/lib/amber-pairs'
import { recommend } from '@/lib/recommend'
import { upsellFor } from '@/lib/upsell'
import { sanitizeAttribution } from '@/lib/attribution'

const L = (productId: string, quantity = 1, variantId?: string) => ({ productId, variantId, quantity })
const ids = (r: { productId: string }[]) => r.map((x) => x.productId)

describe('recommendations: one engine, deterministic', () => {
  it('post-purchase keeps the agreed map: Calm → Amber, Focus → Amber, Amber → Calm, NEUROS Flow → Amber; never NEUROS Flow', () => {
    expect([['balance-wave'], ['brainlink-pro'], ['ochelari-biohack'], ['brain-flow']].map((p) => upsellFor(p)?.productId)).toEqual(['ochelari-biohack', 'ochelari-biohack', 'balance-wave', 'ochelari-biohack'])
    expect(upsellFor(['balance-wave', 'ochelari-biohack'])?.productId).toBe('brainlink-pro')
    for (const set of [['balance-wave'], ['brainlink-pro'], ['ochelari-biohack'], ['balance-wave', 'brainlink-pro', 'ochelari-biohack']]) expect(upsellFor(set)?.productId).not.toBe('brain-flow')
  })

  it('never suggests what is already in the cart (without a promotion reason)', () => {
    const r = recommend([L('balance-wave')], 'cart')
    expect(ids(r)).not.toContain('balance-wave')
    expect(ids(r)).toEqual(['ochelari-biohack', 'brainlink-pro'])
    expect(ids(recommend([L('balance-wave'), L('brainlink-pro'), L('ochelari-biohack', 1, 'cat-eye-bej')], 'checkout'))).not.toContain('ochelari-biohack')
  })

  it('a nearby promotion comes first: the next Amber pair, then the third product for 20%', () => {
    const r = recommend([L('balance-wave'), L('brainlink-pro'), L('ochelari-biohack', 2, 'cat-eye-bej')], 'cart')
    expect(r.map((x) => [x.productId, x.kind, x.add, x.slots])).toEqual([
      ['ochelari-biohack', 'complete_offer', 'amber_pairs', 1],
      ['balance-wave', 'complete_offer', 'direct', undefined],
      ['brainlink-pro', 'complete_offer', 'direct', undefined],
    ])
  })

  it('20% one away: eligible products, not-in-cart first, NEUROS Flow last and only with its configuration picker', () => {
    const r = recommend([L('balance-wave'), L('brainlink-pro')], 'cart')
    expect(r.map((x) => [x.productId, x.add])).toEqual([
      ['balance-wave', 'direct'],
      ['brainlink-pro', 'direct'],
      ['brain-flow', 'variant'],
    ])
    expect(recommend([L('balance-wave'), L('brain-flow', 1, '4-zone')], 'cart')[0]).toMatchObject({ productId: 'brainlink-pro', kind: 'complete_offer' })
  })

  it('Amber is offered as a 3-pair 2+1 set when there is none; no promotions after payment', () => {
    expect(recommend([L('brainlink-pro')], 'checkout')[0]).toMatchObject({ productId: 'ochelari-biohack', add: 'amber_pairs', slots: 3 })
    expect(recommend([L('ochelari-biohack', 2, 'cat-eye-bej')], 'post_purchase').map((x) => x.kind)).not.toContain('complete_offer')
  })

  it('checkout shows at most two, post-payment one', () => {
    expect(recommend([L('balance-wave'), L('brainlink-pro'), L('ochelari-biohack', 2, 'cat-eye-bej')], 'checkout')).toHaveLength(2)
    expect(recommend([L('balance-wave')], 'post_purchase')).toHaveLength(1)
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
    expect(src.match(/<Link href=\{productHref\(p\)\} aria-label=\{`\$\{p\.name\}: vezi produsul`\}/g)?.length).toBe(2)
  })
  it('product page: the offer sits under the price and trust row; Amber opens the pair picker in place', () => {
    const hero = read('src/components/product/ProductHero.tsx')
    expect(hero.indexOf('Garanție')).toBeLessThan(hero.indexOf('<ProductOffer'))
    expect(hero.indexOf('<ProductOffer')).toBeLessThan(hero.indexOf('<AddToCartButton'))
    expect(read('src/components/offers/ProductOffer.tsx')).toContain("openAmber('product_page', 3)")
    expect(read('src/components/home/Offers.tsx')).toContain('AmberOfferButton')
  })
  it('checkout: the suggestion module is the only product surface, before the payment decision', () => {
    const v = read('src/app/(checkout)/checkout/CheckoutView.tsx')
    expect(v.indexOf('<Suggestions placement="checkout"')).toBeGreaterThan(v.indexOf('<Totals'))
    expect(v.indexOf('<Suggestions placement="checkout"')).toBeLessThan(v.indexOf('f-acceptedTerms'))
  })
})
