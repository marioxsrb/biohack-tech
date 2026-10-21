/**
 * Allowed state changes, in one place. Anything not listed is refused, so a replayed
 * webhook or a double click can never move an order backwards or twice.
 */
import type { Order, OrderStatus, PaymentStatus } from './model'

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
  awaiting_collection: ['paid'],
  paid: ['partially_refunded', 'refunded'],
  partially_refunded: ['partially_refunded', 'refunded'],
  refunded: [],
  cancelled: [],
}

export const canMoveOrder = (from: OrderStatus, to: OrderStatus) => ORDER_FLOW[from].includes(to)
export const canMovePayment = (from: PaymentStatus, to: PaymentStatus) => PAYMENT_FLOW[from].includes(to)

/** Payment states in which the order counts as paid for fulfilment and invoicing. */
export const isPaid = (p: PaymentStatus) => p === 'paid' || p === 'partially_refunded'

/** A cash-on-delivery order whose money the courier has not settled yet. */
export const awaitsCollection = (o: Pick<Order, 'paymentMethod' | 'paymentStatus'>) =>
  o.paymentMethod === 'cash_on_delivery' && o.paymentStatus === 'awaiting_collection'

/** A business order (cash on delivery or transfer) that a person has not confirmed yet. */
export const awaitsTeam = (o: { teamConfirmation?: Order['teamConfirmation'] }) => o.teamConfirmation === 'awaiting'

/** An order the checkout's risk check flagged ("Necesită verificare") that a person has not cleared yet. */
export const awaitsReview = (o: { riskReview?: Order['riskReview'] }) => o.riskReview === 'pending'

/**
 * The order may be prepared and shipped: paid, or cash on delivery (the courier collects at the door), and, for a
 * business order paid by cash on delivery or transfer, confirmed by a person first; an order flagged by the risk
 * check, cleared by a person first.
 */
export const canFulfil = (o: Pick<Order, 'paymentMethod' | 'paymentStatus'> & { teamConfirmation?: Order['teamConfirmation']; riskReview?: Order['riskReview'] }) =>
  (isPaid(o.paymentStatus) || awaitsCollection(o)) && !awaitsTeam(o) && !awaitsReview(o)

/**
 * The customer has the product and owes or has paid for it: what a withdrawal and a return need.
 * Cash on delivery counts from delivery, even before the courier's settlement is recorded.
 */
export const isPurchased = (o: Pick<Order, 'paymentMethod' | 'paymentStatus' | 'status'>) => isPaid(o.paymentStatus) || (awaitsCollection(o) && o.status === 'delivered')

/** Cancellation: before shipping for every order; after shipping only a cash-on-delivery parcel refused at the door. */
export const canCancel = (o: Pick<Order, 'status' | 'paymentMethod' | 'paymentStatus'>) =>
  canMoveOrder(o.status, 'cancelled') || (o.status === 'shipped' && awaitsCollection(o))
