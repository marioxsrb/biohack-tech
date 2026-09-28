/**
 * Allowed state changes, in one place. Anything not listed is refused, so a replayed
 * webhook or a double click can never move an order backwards or twice.
 */
import type { OrderStatus, PaymentStatus } from './model'

const ORDER_FLOW: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'abandoned', 'cancelled'],
  abandoned: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
}

const PAYMENT_FLOW: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ['paid', 'failed', 'cancelled'],
  failed: ['paid', 'pending', 'cancelled'],
  awaiting_transfer: ['paid'],
  paid: ['partially_refunded', 'refunded'],
  partially_refunded: ['partially_refunded', 'refunded'],
  refunded: [],
  cancelled: [],
}

export const canMoveOrder = (from: OrderStatus, to: OrderStatus) => ORDER_FLOW[from].includes(to)
export const canMovePayment = (from: PaymentStatus, to: PaymentStatus) => PAYMENT_FLOW[from].includes(to)

/** Payment states in which the order counts as paid for fulfilment and invoicing. */
export const isPaid = (p: PaymentStatus) => p === 'paid' || p === 'partially_refunded'
