/**
 * The promotion engine on the real catalog prices: 20% for 3+ eligible units (Calm, Focus, NEUROS Flow),
 * NEUROS Amber 2+1 gratis, stacking on separate products, rounding in whole bani.
 */
import { describe, expect, it } from 'vitest'
import { resolveOrderLines } from '@/lib/orders/resolve'
import { allocate, percentOf, priceLines, promotionHints } from '@/lib/promotions'

const CALM = 638000
const FOCUS = 249000
const AMBER = 31500
const BF = { '1-zona': 1290000, '4-zone': 1490000, '13-zone': 1390000 }

type L = { productId: string; variantId?: string; quantity: number }
const calm = (quantity: number): L => ({ productId: 'balance-wave', quantity })
const focus = (quantity: number): L => ({ productId: 'brainlink-pro', quantity })
const amber = (quantity: number, variantId = 'cat-eye-negru'): L => ({ productId: 'ochelari-biohack', variantId, quantity })
const bf = (variantId: keyof typeof BF, quantity = 1): L => ({ productId: 'brain-flow', variantId, quantity })

function order(...lines: L[]) {
  const r = resolveOrderLines(lines)
  if (!r.ok) throw new Error(r.reason)
  const lineSum = r.lines.reduce((s, l) => s + l.discountMinor, 0)
  expect(lineSum).toBe(r.discount) // the split always adds up
  expect(r.total).toBe(r.subtotal - r.discount)
  return r
}
const promo = (r: ReturnType<typeof order>, id: string) => r.promotions.find((p) => p.id === id)?.amountMinor ?? 0

describe('20% for 3+ eligible units', () => {
  it.each([
    ['1 Calm', [calm(1)], 0],
    ['2 Calm', [calm(2)], 0],
    ['3 Calm', [calm(3)], percentOf(3 * CALM, 20)],
    ['4 Calm', [calm(4)], percentOf(4 * CALM, 20)],
    ['2 Calm + 1 Focus', [calm(2), focus(1)], percentOf(2 * CALM + FOCUS, 20)],
    ['1 Calm + 1 Focus + 1 NEUROS Flow 4 zone', [calm(1), focus(1), bf('4-zone')], percentOf(CALM + FOCUS + BF['4-zone'], 20)],
    ['3 NEUROS Flow, one of each configuration', [bf('1-zona'), bf('4-zone'), bf('13-zone')], percentOf(BF['1-zona'] + BF['4-zone'] + BF['13-zone'], 20)],
    ['2 Calm + 1 Amber: Amber does not count', [calm(2), amber(1)], 0],
    ['3 Amber: never triggers the 20%', [amber(3)], 0],
  ])('%s', (_, lines, expected) => {
    expect(promo(order(...(lines as L[])), 'trei-produse-20')).toBe(expected)
  })

  it('exact amounts: 3 Calm pay 15.312 lei instead of 19.140 lei', () => {
    const r = order(calm(3))
    expect([r.subtotal, r.discount, r.total]).toEqual([1914000, 382800, 1531200])
  })

  it('never discounts Amber, even next to 3 eligible units', () => {
    const r = order(calm(3), amber(1))
    expect(r.lines.find((l) => l.productId === 'ochelari-biohack')!.discountMinor).toBe(0)
    expect(r.total).toBe(3 * CALM - percentOf(3 * CALM, 20) + AMBER)
  })
})

describe('NEUROS Amber 2+1 gratis', () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 2],
    [4, 3],
    [5, 4],
    [6, 4],
    [9, 6],
  ])('%i pairs → pays %i', (n, paid) => {
    const r = order(amber(n))
    expect(r.total).toBe(paid * AMBER)
  })

  it('counts across frames', () => {
    const r = order(amber(1, 'cat-eye-negru'), amber(1, 'cat-eye-bej'), amber(1, 'patrat-maro'))
    expect(r.total).toBe(2 * AMBER)
    expect(promo(r, 'amber-2-plus-1')).toBe(AMBER)
  })
})

describe('stacking on separate products', () => {
  it('3 Calm + 3 Amber: 20% on Calm, one Amber free', () => {
    const r = order(calm(3), amber(3))
    expect(promo(r, 'trei-produse-20')).toBe(percentOf(3 * CALM, 20))
    expect(promo(r, 'amber-2-plus-1')).toBe(AMBER)
    expect(r.total).toBe(3 * CALM - percentOf(3 * CALM, 20) + 2 * AMBER)
  })

  it('2 Calm + 1 Focus + 3 Amber: 20% on Calm and Focus, one Amber free', () => {
    const r = order(calm(2), focus(1), amber(3))
    const eligible = 2 * CALM + FOCUS
    expect(r.total).toBe(eligible - percentOf(eligible, 20) + 2 * AMBER)
    for (const l of r.lines) if (l.productId === 'ochelari-biohack') expect(l.promotionId).toBe('amber-2-plus-1')
  })

  it('ignores anything the browser says about prices or discounts', () => {
    const r = order({ ...calm(3), unitAmount: 1, discountMinor: 999999, promotionId: 'x' } as L)
    expect(r.total).toBe(1531200)
  })
})

describe('integer money', () => {
  it('percent rounds half up in whole bani; allocation always sums exactly', () => {
    expect(percentOf(1001, 20)).toBe(200) // 200.2
    expect(percentOf(1003, 20)).toBe(201) // 200.6
    expect(percentOf(1, 50)).toBe(1) // 0.5 → 1
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33])
    expect(allocate(7, [3, 3])).toEqual([4, 3])
    expect(allocate(0, [5])).toEqual([0])
    const odd = priceLines([
      { key: 'a', productId: 'balance-wave', quantity: 1, unitAmount: 333 },
      { key: 'b', productId: 'brainlink-pro', quantity: 1, unitAmount: 333 },
      { key: 'c', productId: 'brain-flow', quantity: 1, unitAmount: 334 },
    ])
    expect(odd.discountMinor).toBe(200)
    expect(Object.values(odd.lineDiscounts).reduce((s, x) => s + x, 0)).toBe(200)
    expect(Object.values(odd.lineDiscounts).every(Number.isInteger)).toBe(true)
  })
})

describe('hints', () => {
  const h = (...l: L[]) => promotionHints(l).map((x) => x.id)
  it('says what is missing, only when something is close', () => {
    expect(h()).toEqual([])
    expect(h(calm(1))).toEqual(['trei-produse-20'])
    expect(promotionHints([calm(2)])[0].text).toContain('Mai adaugă un produs')
    expect(h(calm(3))).toEqual([])
    expect(h(amber(1))).toEqual([])
    expect(h(amber(2))).toEqual(['amber-2-plus-1'])
    expect(h(amber(3))).toEqual([])
    expect(h(amber(5))).toEqual(['amber-2-plus-1'])
  })
})
