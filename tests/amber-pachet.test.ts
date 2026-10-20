import { describe, expect, it } from 'vitest'

import { resolveOrderLines } from '@/lib/orders/resolve'
import { priceLines } from '@/lib/promotions'

const A = 'ochelari-biohack'
const line = (variantId: string, quantity = 1) => ({ productId: A, variantId, quantity })
const totals = (raw: ReturnType<typeof line>[]) => {
  const r = resolveOrderLines(raw)
  if (!r.ok) throw new Error(r.reason)
  return { subtotal: r.subtotal, discount: r.discount, total: r.total, promotions: r.promotions.map((p) => p.id) }
}

describe('NEUROS Amber pachet (yellow + red of one frame): 20% off, shown as a reduction', () => {
  it('one pachet: 630 lei listed, −126 lei, 504 lei to pay', () => {
    expect(totals([line('cat-eye-negru-pachet')])).toEqual({ subtotal: 63000, discount: 12600, total: 50400, promotions: ['amber-pachet-20:ochelari-biohack'] })
  })

  it('every frame has its pachet at the same price', () => {
    for (const f of ['cat-eye-negru', 'cat-eye-bej', 'patrat-negru', 'patrat-maro', 'subtire-negru']) expect(totals([line(`${f}-pachet`)]).total).toBe(50400)
  })

  it('three pachete are 20% off each, never also 2+1 (one unit is never discounted twice)', () => {
    expect(totals([line('patrat-maro-pachet', 3)])).toEqual({ subtotal: 189000, discount: 37800, total: 151200, promotions: ['amber-pachet-20:ochelari-biohack'] })
  })

  it('single pairs keep 2+1, and a pachet next to them does not count towards it', () => {
    // 3 single pairs (one free) + 1 pachet (20%): 945 − 315 + 630 − 126.
    const r = totals([line('cat-eye-negru'), line('cat-eye-bej-rosu'), line('subtire-negru'), line('subtire-negru-pachet')])
    expect(r).toEqual({ subtotal: 157500, discount: 44100, total: 113400, promotions: ['amber-2-plus-1', 'amber-pachet-20:ochelari-biohack'] })
    // 2 single pairs + 1 pachet: no free pair (the pachet is not the third unit).
    expect(totals([line('cat-eye-negru'), line('cat-eye-negru-rosu'), line('cat-eye-negru-pachet')]).discount).toBe(12600)
  })

  it('the browser engine gives the same numbers when it is given the variant', () => {
    const r = priceLines([{ key: 'a', productId: A, variantId: 'subtire-negru-pachet', quantity: 2, unitAmount: 63000 }])
    expect([r.subtotalMinor, r.discountMinor, r.totalMinor]).toEqual([126000, 25200, 100800])
  })
})
