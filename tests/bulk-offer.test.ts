/**
 * The business offer (19.10.2026): from 25 NEUROS Calm + NEUROS Focus units together, 40% off every Calm and Focus
 * unit. Amber and the book never count and keep their own price (Amber keeps 2+1). It replaces the quantity
 * discount and never adds up with a promo code (the better of the two applies). Pure engine, bani only.
 */
import { describe, expect, it } from 'vitest'
import { BULK_OFFER, isBulk } from '@/config/promotions'
import { bulkUnits, priceLines, promotionHints, type PricedLine } from '@/lib/promotions'
import { resolveOrderLines } from '@/lib/orders/resolve'

const CALM = 638000
const FOCUS = 333700
const AMBER = 31500
const BOOK = 12000
const line = (productId: string, quantity: number, unitAmount: number, key = productId): PricedLine => ({ key, productId, quantity, unitAmount })
const calm = (q: number) => line('balance-wave', q, CALM)
const focus = (q: number) => line('brainlink-pro', q, FOCUS)
const amber = (q: number) => line('ochelari-biohack', q, AMBER, 'ochelari-biohack:cat-eye-negru')
const book = (q: number) => line('carte-diana', q, BOOK)
const forty = (minor: number) => Math.floor((minor * 40 + 50) / 100)

describe('business offer: 40% from 25 Calm + Focus units', () => {
  it.each([
    ['25 Calm', [calm(25)]],
    ['25 Focus', [focus(25)]],
    ['15 Calm + 10 Focus', [calm(15), focus(10)]],
    ['20 Calm + 5 Focus', [calm(20), focus(5)]],
    ['40 Calm + 30 Focus', [calm(40), focus(30)]],
  ])('%s → 40% on every unit, one discount line', (_, lines) => {
    const p = priceLines(lines)
    const full = lines.reduce((s, l) => s + l.unitAmount * l.quantity, 0)
    expect(p.promotions).toEqual([{ id: BULK_OFFER.id, label: 'Reducere pentru companii (40%)', amountMinor: forty(full) }])
    expect(p.discountMinor).toBe(forty(full))
    expect(p.totalMinor).toBe(full - forty(full))
    // Split over the lines so an invoice adds up to the total.
    expect(Object.values(p.lineDiscounts).reduce((s, x) => s + x, 0)).toBe(p.discountMinor)
    expect(isBulk(p.promotions)).toBe(true)
  })

  it.each([
    ['24 Calm + 1 Amber', [calm(24), amber(1)]],
    ['20 Focus + 5 books', [focus(20), book(5)]],
    ['25 Amber', [amber(25)]],
    ['10 Calm + 10 Focus + 5 Amber', [calm(10), focus(10), amber(5)]],
    ['24 Calm', [calm(24)]],
  ])('%s → no business discount', (_, lines) => {
    const p = priceLines(lines)
    expect(isBulk(p.promotions)).toBe(false)
    expect(p.promotions.some((a) => a.id.startsWith('trei-produse-20')) || p.promotions.some((a) => a.id === 'amber-2-plus-1') || p.discountMinor === 0).toBe(true)
  })

  it('24 Calm still gets the normal 20% quantity discount; 25 jumps to 40%', () => {
    expect(priceLines([calm(24)]).discountMinor).toBe(Math.floor((24 * CALM * 20 + 50) / 100))
    expect(priceLines([calm(25)]).discountMinor).toBe(forty(25 * CALM))
  })

  it('Amber and the book next to 25+ units keep their own price (Amber keeps 2+1); only Calm/Focus get 40%', () => {
    const p = priceLines([calm(20), focus(5), amber(3), book(2)])
    const eligible = 20 * CALM + 5 * FOCUS
    expect(p.promotions.map((a) => [a.id, a.amountMinor])).toEqual([
      [BULK_OFFER.id, forty(eligible)],
      ['amber-2-plus-1', AMBER],
    ])
    expect(p.lineDiscounts['carte-diana']).toBeUndefined()
    expect(p.subtotalMinor).toBe(eligible + 3 * AMBER + 2 * BOOK)
    expect(p.totalMinor).toBe(eligible - forty(eligible) + 2 * AMBER + 2 * BOOK)
  })

  it('never stacks with a promo code: a 10% code is refused (the 40% is better)', () => {
    const p = priceLines([calm(25)], undefined, { code: 'LONGEVITY10', kind: 'percent', value: 10, products: null, minOrderMinor: 0 })
    expect(p.discountMinor).toBe(forty(25 * CALM))
    expect(p.code).toEqual({ code: 'LONGEVITY10', amountMinor: 0, problem: 'not_better' })
    expect(p.promotions.some((a) => a.id.startsWith('cod:'))).toBe(false)
  })

  it('an exceptional code worth more than 40% wins alone, without the business discount (the best, never both)', () => {
    const p = priceLines([calm(25)], undefined, { code: 'MARE50', kind: 'percent', value: 50, products: null, minOrderMinor: 0 })
    expect(isBulk(p.promotions)).toBe(false)
    expect(p.promotions.map((a) => a.id)).toEqual(['cod:MARE50'])
  })

  it('no hint about the quantity discount once the business offer applies', () => {
    expect(promotionHints([{ productId: 'balance-wave', quantity: 25 }])).toEqual([])
    expect(bulkUnits([calm(20), focus(5), amber(9)])).toBe(25)
  })

  it('the server resolves 25+ Calm/Focus units (up to 100 per line) and prices the 40% itself; other products stay at 10', () => {
    const r = resolveOrderLines([{ productId: 'balance-wave', quantity: 15 }, { productId: 'brainlink-pro', quantity: 10 }])
    expect(r.ok && r.promotions.map((a) => a.id)).toEqual([BULK_OFFER.id])
    expect(r.ok && r.discount).toBe(forty(15 * CALM + 10 * FOCUS))
    expect(resolveOrderLines([{ productId: 'balance-wave', quantity: 101 }])).toEqual({ ok: false, reason: 'BAD_LINE' })
    expect(resolveOrderLines([{ productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 11 }])).toEqual({ ok: false, reason: 'BAD_LINE' })
  })
})
