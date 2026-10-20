import { describe, expect, it, vi } from 'vitest'
import { TEST_PRICES } from './fixtures'

vi.mock('@/config/prices', () => ({ PRICES_RON: TEST_PRICES }))
const { resolveOrderLines } = await import('@/lib/orders/resolve')

describe('resolveOrderLines (server side)', () => {
  it('prices lines from the catalog and ignores anything else the browser sends', () => {
    const r = resolveOrderLines([
      { productId: 'brainlink-pro', quantity: 1, price: 1, name: 'Ieftin' },
      { productId: 'ochelari-biohack', variantId: 'patrat-maro', quantity: 2, unitAmount: 1 },
    ])
    expect(r).toEqual({
      ok: true,
      subtotal: 79000 + 2 * 19950,
      discount: 0,
      total: 79000 + 2 * 19950,
      promotions: [],
      lines: [
        { key: 'brainlink-pro:', productId: 'brainlink-pro', variantId: undefined, name: 'NEUROS Focus', description: undefined, quantity: 1, unitAmount: 79000, discountMinor: 0, promotionId: undefined },
        {
          key: 'ochelari-biohack:patrat-maro',
          productId: 'ochelari-biohack',
          variantId: 'patrat-maro',
          name: 'NEUROS Amber',
          description: 'Unisex pătrat · Maro · Galbene',
          quantity: 2,
          unitAmount: 19950,
          discountMinor: 0,
          promotionId: undefined,
        },
      ],
    })
  })
  it('merges duplicate lines', () => {
    const r = resolveOrderLines([
      { productId: 'brainlink-pro', quantity: 1 },
      { productId: 'brainlink-pro', quantity: 2 },
    ])
    expect(r.ok && r.lines[0].quantity).toBe(3)
  })
  it('rejects an empty cart', () => {
    expect(resolveOrderLines([])).toEqual({ ok: false, reason: 'EMPTY' })
    expect(resolveOrderLines(undefined)).toEqual({ ok: false, reason: 'EMPTY' })
  })
  it.each([
    [[{ productId: 'nu-exista', quantity: 1 }]],
    [[{ productId: 'balance-wave', quantity: 1 }]],
    [[{ productId: 'ochelari-biohack', quantity: 1 }]],
    [[{ productId: 'ochelari-biohack', variantId: 'cat-eye-maro', quantity: 1 }]],
    [[{ productId: 'brainlink-pro', quantity: 0 }]],
    [[{ productId: 'brainlink-pro', quantity: 1.5 }]],
    // Calm and Focus go up to 100 per line (business offer); every other product stays at 10.
    [[{ productId: 'brainlink-pro', quantity: 101 }]],
    [[{ productId: 'brainlink-pro', quantity: 60 }, { productId: 'brainlink-pro', quantity: 60 }]],
    [[{ productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 11 }]],
    [[{ productId: 'carte-diana', quantity: 6 }, { productId: 'carte-diana', quantity: 6 }]],
    [Array.from({ length: 21 }, () => ({ productId: 'brainlink-pro', quantity: 1 }))],
  ])('rejects an unknown, unpriced or out-of-range line (%#)', (lines) => {
    expect(resolveOrderLines(lines)).toEqual({ ok: false, reason: 'BAD_LINE' })
  })
})
