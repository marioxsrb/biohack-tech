import { describe, expect, it } from 'vitest'
import { formatLei, lineTotal, orderTotal } from '@/lib/money'

describe('formatLei', () => {
  it('formats whole lei with a dot for thousands', () => {
    expect(formatLei(249000)).toBe('2.490 lei')
    expect(formatLei(1210000)).toBe('12.100 lei')
    expect(formatLei(9900)).toBe('99 lei')
  })
  it('shows two decimals only when there are bani', () => {
    expect(formatLei(249050)).toBe('2.490,50 lei')
    expect(formatLei(5)).toBe('0,05 lei')
  })
  it('handles zero', () => {
    expect(formatLei(0)).toBe('0 lei')
  })
})

describe('totals', () => {
  it('multiplies and sums in integer bani', () => {
    expect(lineTotal(19950, 3)).toBe(59850)
    expect(orderTotal([{ unit: 249000, quantity: 1 }, { unit: 19950, quantity: 2 }])).toBe(288900)
  })
})
