/**
 * The promotion engine on the real catalog prices: the quantity discount counted per product (10% for 2,
 * 20% for 3+ units of the same Calm, Focus or NEUROS Flow), NEUROS Amber 2+1 gratis, stacking on separate
 * products, rounding in whole bani.
 */
import { describe, expect, it } from 'vitest'
import { resolveOrderLines } from '@/lib/orders/resolve'
import { allocate, percentOf, priceLines, promotionHints, promotionProgress, savedBy } from '@/lib/promotions'

const CALM = 638000
const FOCUS = 79000
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
const promo = (r: ReturnType<typeof order>, id: string) => savedBy(r.promotions, id)

describe('10% for 2, 20% for 3+ units of the same product', () => {
  it.each([
    ['1 Calm', [calm(1)], 0],
    ['2 Calm: 10%', [calm(2)], percentOf(2 * CALM, 10)],
    ['1 Calm + 1 Focus: different products never add up', [calm(1), focus(1)], 0],
    ['3 Calm', [calm(3)], percentOf(3 * CALM, 20)],
    ['4 Calm', [calm(4)], percentOf(4 * CALM, 20)],
    ['2 Calm + 1 Focus: 10% on the 2 Calm only', [calm(2), focus(1)], percentOf(2 * CALM, 10)],
    ['3 Calm + 1 Focus: 20% on the Calm only, Focus at full price', [calm(3), focus(1)], percentOf(3 * CALM, 20)],
    ['3 Calm + 2 Focus: 20% on Calm, 10% on Focus', [calm(3), focus(2)], percentOf(3 * CALM, 20) + percentOf(2 * FOCUS, 10)],
    ['1 Calm + 1 Focus + 1 NEUROS Flow 4 zone: nothing', [calm(1), focus(1), bf('4-zone')], 0],
    ['3 NEUROS Flow, one of each configuration: one product', [bf('1-zona'), bf('4-zone'), bf('13-zone')], percentOf(BF['1-zona'] + BF['4-zone'] + BF['13-zone'], 20)],
    ['2 Calm + 1 Amber: Amber does not count (10%, not 20%)', [calm(2), amber(1)], percentOf(2 * CALM, 10)],
    ['3 Amber: never triggers the 20%', [amber(3)], 0],
  ])('%s', (_, lines, expected) => {
    expect(promo(order(...(lines as L[])), 'trei-produse-20')).toBe(expected)
  })

  it('exact amounts: 3 Calm pay 15.312 lei instead of 19.140 lei', () => {
    const r = order(calm(3))
    expect([r.subtotal, r.discount, r.total]).toEqual([1914000, 382800, 1531200])
  })

  it('the order names the tier and the product, one entry per product', () => {
    expect(order(calm(2)).promotions.map((p) => [p.id, p.label])).toEqual([['trei-produse-20:balance-wave', '10% la 2 bucăți NEUROS Calm']])
    expect(order(calm(3)).promotions.map((p) => p.label)).toEqual(['20% la 3 bucăți NEUROS Calm'])
    expect(order(calm(3), focus(2)).promotions.map((p) => p.label)).toEqual(['20% la 3 bucăți NEUROS Calm', '10% la 2 bucăți NEUROS Focus'])
  })

  it('each line carries its own product group, and only discounted lines', () => {
    const r = order(calm(3), focus(1))
    expect(r.lines.find((l) => l.productId === 'balance-wave')!.promotionId).toBe('trei-produse-20:balance-wave')
    expect(r.lines.find((l) => l.productId === 'brainlink-pro')!.discountMinor).toBe(0)
    expect(r.total).toBe(3 * CALM - percentOf(3 * CALM, 20) + FOCUS)
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

  it('2 Calm + 1 Focus + 3 Amber: 10% on the Calm, Focus at full price, one Amber free', () => {
    const r = order(calm(2), focus(1), amber(3))
    expect(r.total).toBe(2 * CALM - percentOf(2 * CALM, 10) + FOCUS + 2 * AMBER)
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
      { key: 'a', productId: 'brain-flow', quantity: 1, unitAmount: 333 },
      { key: 'b', productId: 'brain-flow', quantity: 1, unitAmount: 333 },
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
    expect(h(calm(1))).toEqual(['trei-produse-20:balance-wave'])
    expect(promotionHints([calm(2)])[0].text).toBe('Mai adaugă încă un NEUROS Calm și primești 20% reducere la toate trei.')
    expect(h(calm(1), focus(1))).toEqual(['trei-produse-20:balance-wave', 'trei-produse-20:brainlink-pro'])
    expect(h(calm(3))).toEqual([])
    expect(h(amber(1))).toEqual([])
    expect(h(amber(2))).toEqual(['amber-2-plus-1'])
    expect(h(amber(3))).toEqual([])
    expect(h(amber(5))).toEqual(['amber-2-plus-1'])
  })
})

describe('progress towards the offers', () => {
  const prog = (...l: L[]) =>
    promotionProgress(order(...l).lines.map((x) => ({ key: x.key, productId: x.productId, quantity: x.quantity, unitAmount: x.unitAmount }))).map((p) => [p.id, p.state, p.missing, p.active])
  it('bundle: far at 1, 10% active and close to 20% at 2, 20% active from 3', () => {
    expect(prog(calm(1))).toEqual([['trei-produse-20:balance-wave', 'far', 2, false]])
    expect(prog(calm(2))).toEqual([['trei-produse-20:balance-wave', 'close', 1, true]])
    expect(prog(calm(3))).toEqual([['trei-produse-20:balance-wave', 'active', 0, true]])
    expect(prog(calm(2), focus(1))).toEqual([
      ['trei-produse-20:balance-wave', 'close', 1, true],
      ['trei-produse-20:brainlink-pro', 'far', 2, false],
    ])
  })
  it('Amber 2+1: far at 1, close at 2, active at 3, active and close again at 5', () => {
    expect(prog(amber(1))).toEqual([['amber-2-plus-1', 'far', 2, false]])
    expect(prog(amber(2))).toEqual([['amber-2-plus-1', 'close', 1, false]])
    expect(prog(amber(3))).toEqual([['amber-2-plus-1', 'active', 0, true]])
    expect(prog(amber(5))).toEqual([['amber-2-plus-1', 'close', 1, true]])
  })
  it('only promotions the cart touches', () => {
    expect(prog(focus(1)).map((p) => p[0])).toEqual(['trei-produse-20:brainlink-pro'])
  })
})

describe('NEUROS Amber mix and match (2+1 across frames)', () => {
  const lines = (r: ReturnType<typeof order>) => r.lines.map((l) => [l.variantId, l.quantity, l.discountMinor])

  it('A: one frame, no promotion', () => {
    const r = order(amber(1, 'cat-eye-negru'))
    expect([r.total, r.discount]).toEqual([AMBER, 0])
  })

  it('B: two different frames, no promotion', () => {
    const r = order(amber(1, 'cat-eye-negru'), amber(1, 'cat-eye-bej'))
    expect([r.total, r.discount]).toEqual([2 * AMBER, 0])
  })

  it('C: three different frames: one pair free, every frame stays its own line, none at 0 lei', () => {
    const r = order(amber(1, 'cat-eye-negru'), amber(1, 'cat-eye-bej'), amber(1, 'patrat-negru'))
    expect([r.subtotal, r.discount, r.total]).toEqual([3 * AMBER, AMBER, 2 * AMBER])
    expect(lines(r)).toEqual([
      ['cat-eye-negru', 1, 10500],
      ['cat-eye-bej', 1, 10500],
      ['patrat-negru', 1, 10500],
    ])
    for (const l of r.lines) expect(l.promotionId).toBe('amber-2-plus-1')
  })

  it('D: frame A × 2 + frame B × 1: one pair free, split by line value', () => {
    const r = order(amber(2, 'patrat-maro'), amber(1, 'cat-eye-bej'))
    expect(r.total).toBe(2 * AMBER)
    expect(lines(r)).toEqual([
      ['patrat-maro', 2, 21000],
      ['cat-eye-bej', 1, 10500],
    ])
  })

  it('E: three of the same frame', () => {
    const r = order(amber(3, 'cat-eye-bej'))
    expect(lines(r)).toEqual([['cat-eye-bej', 3, AMBER]])
  })

  it('F/G: removing the third pair removes the offer; adding it back restores it', () => {
    expect(order(amber(1, 'cat-eye-negru'), amber(1, 'cat-eye-bej')).discount).toBe(0)
    expect(order(amber(1, 'cat-eye-negru'), amber(1, 'cat-eye-bej'), amber(1, 'patrat-maro')).discount).toBe(AMBER)
  })

  it('if frames ever cost differently, the free units are still the cheapest ones', () => {
    const p = priceLines([
      { key: 'a', productId: 'ochelari-biohack', quantity: 1, unitAmount: 40000 },
      { key: 'b', productId: 'ochelari-biohack', quantity: 1, unitAmount: 30000 },
      { key: 'c', productId: 'ochelari-biohack', quantity: 1, unitAmount: 35000 },
    ])
    expect(p.discountMinor).toBe(30000)
    expect(Object.values(p.lineDiscounts).reduce((s, x) => s + x, 0)).toBe(30000)
    const six = priceLines([
      { key: 'a', productId: 'ochelari-biohack', quantity: 4, unitAmount: 40000 },
      { key: 'b', productId: 'ochelari-biohack', quantity: 2, unitAmount: 30000 },
    ])
    expect(six.discountMinor).toBe(60000) // two free: the two cheapest units
  })
})
