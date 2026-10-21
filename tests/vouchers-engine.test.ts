/**
 * The pricing engine with personal vouchers and gifts (config/vouchers.ts): fixed values in bani, one voucher per
 * order, only on its product, NEUROS Amber 2+1 + 30 lei per paid pair (3 pairs at 315 lei = 570 lei), gifts at 0 lei.
 */
import { describe, expect, it } from 'vitest'
import { AMBER_PAIR_DISCOUNT, VOUCHER_VALUE } from '@/config/vouchers'
import { PAIR_ID, priceLines, savedBy, type PricedLine, type PromoCodeRule } from '@/lib/promotions'

const CALM = 638000
const FOCUS = 322500
const AMBER = 31500
const BOOK = 12000

let n = 0
const line = (productId: string, quantity: number, unitAmount: number, variantId?: string): PricedLine => ({ key: `${productId}:${variantId ?? ''}:${n++}`, productId, variantId, quantity, unitAmount })
const calm = (q: number) => line('balance-wave', q, CALM)
const focus = (q: number) => line('brainlink-pro', q, FOCUS)
const amber = (q: number, variantId = 'cat-eye-negru', price = AMBER) => line('ochelari-biohack', q, price, variantId)
const book = (q: number) => line('carte-diana', q, BOOK)

const voucher = (productId: keyof typeof VOUCHER_VALUE): PromoCodeRule => ({
  code: 'BTV' + productId.slice(0, 4).toUpperCase(),
  kind: 'fixed',
  value: VOUCHER_VALUE[productId],
  products: [productId],
  minOrderMinor: 0,
  label: 'Voucher',
  ...(productId === 'ochelari-biohack' && { perPaidUnit: { maxUnits: AMBER_PAIR_DISCOUNT.maxPairs } }),
})
const gift = (productId: string): PromoCodeRule => ({ code: 'BTGIFT', kind: 'fixed', value: 0, products: [productId], minOrderMinor: 0, freeUnits: 1, label: 'Cadou' })

function check(r: ReturnType<typeof priceLines>) {
  expect(Object.values(r.lineDiscounts).reduce((s, x) => s + x, 0)).toBe(r.discountMinor)
  expect(r.totalMinor).toBe(r.subtotalMinor - r.discountMinor)
  for (const v of Object.values(r.lineDiscounts)) expect(Number.isInteger(v) && v >= 0).toBe(true)
  return r
}

describe('NEUROS Amber 2+1 with the Amber voucher: 30 lei per paid pair, never on the free pair', () => {
  // quantity → [free pairs, paid pairs that get 30 lei (max 2), total]
  it.each([
    [1, 0, 1, AMBER - 3000],
    [2, 0, 2, 2 * AMBER - 6000],
    [3, 1, 2, 57000],
    [4, 1, 2, 4 * AMBER - AMBER - 6000],
    [5, 1, 2, 5 * AMBER - AMBER - 6000],
    [6, 2, 2, 6 * AMBER - 2 * AMBER - 6000],
    [7, 2, 2, 7 * AMBER - 2 * AMBER - 6000],
  ])('%i pairs', (q, free, pairs, total) => {
    const r = check(priceLines([amber(q)], undefined, voucher('ochelari-biohack')))
    expect(savedBy(r.promotions, 'amber-2-plus-1')).toBe(free * AMBER)
    expect(r.code).toEqual({ code: 'BTVOCHE', amountMinor: pairs * 3000 })
    expect(r.totalMinor).toBe(total)
  })

  it('the example: 315 + 315 + 0 − 30 − 30 = 570 lei', () => {
    expect(priceLines([amber(3)], undefined, voucher('ochelari-biohack')).totalMinor).toBe(57000)
  })

  it('mixed frames count together; the cheapest is free (same price today: any)', () => {
    const r = check(priceLines([amber(1, 'cat-eye-negru'), amber(1, 'patrat-maro'), amber(1, 'subtire-negru')], undefined, voucher('ochelari-biohack')))
    expect(r.totalMinor).toBe(57000)
  })

  it('frames at different prices: the cheapest pair is the free one, 30 lei on each of the two paid', () => {
    const r = check(priceLines([amber(1, 'cat-eye-negru', 40000), amber(2, 'patrat-maro', 31500)], undefined, voucher('ochelari-biohack')))
    expect(savedBy(r.promotions, 'amber-2-plus-1')).toBe(31500)
    expect(r.totalMinor).toBe(40000 + 31500 - 6000)
  })

  it('without a voucher the 2+1 alone applies (default audience: voucher)', () => {
    expect(AMBER_PAIR_DISCOUNT.audience).toBe('voucher')
    expect(priceLines([amber(3)]).totalMinor).toBe(2 * AMBER)
  })

  it("audience 'all': every order gets it automatically, and an Amber voucher adds nothing more (never twice)", () => {
    const all = { ...AMBER_PAIR_DISCOUNT, audience: 'all' as const }
    const auto = check(priceLines([amber(3)], undefined, null, undefined, all))
    expect(savedBy(auto.promotions, PAIR_ID)).toBe(6000)
    expect(auto.totalMinor).toBe(57000)
    const both = check(priceLines([amber(3)], undefined, voucher('ochelari-biohack'), undefined, all))
    expect(both.totalMinor).toBe(57000)
    expect(both.code?.problem).toBe('not_better')
  })

  it('a paid pair never goes below zero', () => {
    const r = check(priceLines([amber(1, 'x', 2000)], undefined, voucher('ochelari-biohack')))
    expect(r.totalMinor).toBe(0)
    expect(r.code?.amountMinor).toBe(2000)
  })
})

describe('Calm and Focus vouchers: a fixed value, only on their product', () => {
  it('Calm 640 lei', () => {
    const r = check(priceLines([calm(1)], undefined, voucher('balance-wave')))
    expect(r.totalMinor).toBe(CALM - 64000)
  })
  it('Focus 325 lei', () => {
    expect(check(priceLines([focus(1)], undefined, voucher('brainlink-pro'))).totalMinor).toBe(FOCUS - 32500)
  })
  it('once per order, whatever the quantity (2 Calm: the 10% offer + 640 lei)', () => {
    const r = check(priceLines([calm(2)], undefined, voucher('balance-wave')))
    expect(r.code?.amountMinor).toBe(64000)
    expect(r.totalMinor).toBe(2 * CALM - 127600 - 64000)
  })
  it('a voucher for a product not in the cart is refused', () => {
    expect(priceLines([focus(1)], undefined, voucher('balance-wave')).code?.problem).toBe('no_products')
  })
})

describe('mixed carts: one individual voucher, on its product only; the Amber 2+1 stays', () => {
  const cart = () => [calm(1), focus(1), amber(3)]
  it.each([
    ['Calm voucher', voucher('balance-wave'), 64000, 'balance-wave'],
    ['Focus voucher', voucher('brainlink-pro'), 32500, 'brainlink-pro'],
    ['Amber voucher', voucher('ochelari-biohack'), 6000, 'ochelari-biohack'],
  ] as const)('%s', (_, v, amount, product) => {
    const lines = cart()
    const r = check(priceLines(lines, undefined, v))
    expect(r.code?.amountMinor).toBe(amount)
    expect(savedBy(r.promotions, 'amber-2-plus-1')).toBe(AMBER)
    // The voucher's share sits on its own product's line only.
    for (const l of lines) expect(!!r.lineCodeDiscounts[l.key]).toBe(l.productId === product)
  })
  it('Calm + book: the voucher never touches the book', () => {
    const lines = [calm(1), book(1)]
    const r = check(priceLines(lines, undefined, voucher('balance-wave')))
    expect(r.lineDiscounts[lines[1].key]).toBeUndefined()
  })
})

describe('gifts: the product at 0 lei, a real line', () => {
  it('a gift book costs nothing', () => {
    const r = check(priceLines([book(1)], undefined, gift('carte-diana')))
    expect(r.totalMinor).toBe(0)
    expect(r.code?.amountMinor).toBe(BOOK)
  })
  it('a gift Amber pair costs nothing; with another paid pair only one is free', () => {
    expect(check(priceLines([amber(1)], undefined, gift('ochelari-biohack'))).totalMinor).toBe(0)
    expect(check(priceLines([amber(2)], undefined, gift('ochelari-biohack'))).totalMinor).toBe(AMBER)
  })
  it('a gift for a product not in the cart is refused', () => {
    expect(priceLines([calm(1)], undefined, gift('carte-diana')).code?.problem).toBe('no_products')
  })
})
