import { describe, expect, it, vi } from 'vitest'
import { TEST_PRICES } from './fixtures'

vi.mock('@/config/prices', () => ({ PRICES_RON: TEST_PRICES }))
const { sanitize, lineKey } = await import('@/components/cart/cart-store')

describe('cart sanitize (what comes back from localStorage)', () => {
  it('keeps valid lines', () => {
    expect(sanitize([{ productId: 'brainlink-pro', quantity: 2 }])).toEqual([{ productId: 'brainlink-pro', variantId: undefined, quantity: 2 }])
  })
  it('drops unknown products and unknown variants', () => {
    expect(sanitize([{ productId: 'nu-exista', quantity: 1 }])).toEqual([])
    expect(sanitize([{ productId: 'ochelari-biohack', variantId: 'patrat-bej', quantity: 1 }])).toEqual([])
  })
  it('drops a product that needs a variant when none is given, and a variant on a product without any', () => {
    expect(sanitize([{ productId: 'ochelari-biohack', quantity: 1 }])).toEqual([])
    expect(sanitize([{ productId: 'brainlink-pro', variantId: 'x', quantity: 1 }])).toEqual([])
  })
  it('drops products without an approved price', () => {
    expect(sanitize([{ productId: 'balance-wave', quantity: 1 }])).toEqual([])
  })
  it('clamps quantities and merges duplicates', () => {
    const out = sanitize([
      { productId: 'brainlink-pro', quantity: 0 },
      { productId: 'brainlink-pro', quantity: 4.7 },
      { productId: 'ochelari-biohack', variantId: 'cat-eye-bej', quantity: 99 },
    ])
    expect(out).toEqual([
      { productId: 'brainlink-pro', variantId: undefined, quantity: 5 },
      { productId: 'ochelari-biohack', variantId: 'cat-eye-bej', quantity: 10 },
    ])
  })
  it('survives garbage', () => {
    expect(sanitize(null)).toEqual([])
    expect(sanitize('[]')).toEqual([])
    expect(sanitize([null, 1, 'x', { productId: 5 }])).toEqual([])
  })
  it('keys lines by product and variant', () => {
    expect(lineKey({ productId: 'ochelari-biohack', variantId: 'patrat-maro' })).toBe('ochelari-biohack:patrat-maro')
    expect(lineKey({ productId: 'brainlink-pro' })).toBe('brainlink-pro:')
  })
})
