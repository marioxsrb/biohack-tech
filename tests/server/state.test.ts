import { describe, expect, it } from 'vitest'
import { formatOrderNumber, ORDER_NUMBER_RE } from '@/server/orders/number'
import { canMoveOrder, canMovePayment, isPaid } from '@/server/orders/state'

describe('order numbers', () => {
  it('are BHT-day-sequence, zero padded to 4, in Romanian time', () => {
    expect(formatOrderNumber(7, new Date('2026-09-27T10:00:00Z'))).toBe('BHT-20260927-0007')
    // 31 Dec 23:30 UTC is already 1 January in Bucharest; 22:30 UTC on 28 Sep is 29 Sep (summer time).
    expect(formatOrderNumber(1, new Date('2026-12-31T23:30:00Z'))).toBe('BHT-20270101-0001')
    expect(formatOrderNumber(1, new Date('2026-09-28T22:30:00Z'))).toBe('BHT-20260929-0001')
    expect(formatOrderNumber(12345, new Date('2026-06-01T10:00:00Z'))).toBe('BHT-20260601-12345')
    expect(ORDER_NUMBER_RE.test('BHT-20260927-0007')).toBe(true)
    expect(ORDER_NUMBER_RE.test('BT-2026-000123')).toBe(false)
  })
  it('use only characters safe for Stripe, FGO, GHL and email subjects, and sort by day', () => {
    expect(formatOrderNumber(9999, new Date('2026-09-27T10:00:00Z'))).toMatch(/^[A-Z0-9-]+$/)
    const list = [formatOrderNumber(2, new Date('2026-10-01T10:00:00Z')), formatOrderNumber(9, new Date('2026-09-30T10:00:00Z')), formatOrderNumber(1, new Date('2026-10-01T10:00:00Z'))]
    expect([...list].sort()).toEqual(['BHT-20260930-0009', 'BHT-20261001-0001', 'BHT-20261001-0002'])
  })
  it('refuse invalid sequences', () => {
    expect(() => formatOrderNumber(0, new Date())).toThrow()
    expect(() => formatOrderNumber(1.5, new Date())).toThrow()
  })
})

describe('state machine', () => {
  it('moves orders forward only', () => {
    expect(canMoveOrder('pending', 'confirmed')).toBe(true)
    expect(canMoveOrder('abandoned', 'confirmed')).toBe(true)
    expect(canMoveOrder('confirmed', 'shipped')).toBe(true)
    expect(canMoveOrder('shipped', 'delivered')).toBe(true)
    expect(canMoveOrder('shipped', 'cancelled')).toBe(false)
    expect(canMoveOrder('delivered', 'pending')).toBe(false)
    expect(canMoveOrder('cancelled', 'confirmed')).toBe(false)
    expect(canMoveOrder('confirmed', 'confirmed')).toBe(false)
  })
  it('keeps payment and order states separate', () => {
    expect(canMovePayment('awaiting_transfer', 'paid')).toBe(true)
    expect(canMovePayment('awaiting_transfer', 'failed')).toBe(false)
    expect(canMovePayment('failed', 'paid')).toBe(true)
    expect(canMovePayment('paid', 'paid')).toBe(false)
    expect(canMovePayment('paid', 'refunded')).toBe(true)
    expect(canMovePayment('refunded', 'paid')).toBe(false)
    expect(isPaid('partially_refunded')).toBe(true)
    expect(isPaid('awaiting_transfer')).toBe(false)
  })
})
