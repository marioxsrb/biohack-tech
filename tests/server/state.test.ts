import { describe, expect, it } from 'vitest'
import { formatOrderNumber, ORDER_NUMBER_RE } from '@/server/orders/number'
import { canMoveOrder, canMovePayment, isPaid } from '@/server/orders/state'

describe('order numbers', () => {
  it('are BT-year-sequence, zero padded, in Romanian time', () => {
    expect(formatOrderNumber(123, new Date('2026-09-27T10:00:00Z'))).toBe('BT-2026-000123')
    // 31 Dec 23:30 UTC is already 1 January in Bucharest.
    expect(formatOrderNumber(1, new Date('2026-12-31T23:30:00Z'))).toBe('BT-2027-000001')
    expect(formatOrderNumber(1234567, new Date('2026-06-01T00:00:00Z'))).toBe('BT-2026-1234567')
    expect(ORDER_NUMBER_RE.test('BT-2026-000123')).toBe(true)
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
