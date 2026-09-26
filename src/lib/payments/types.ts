import type { OrderForm } from '@/lib/checkout'
import type { OrderLine } from '@/lib/orders/resolve'

export type { OrderLine }

export type CheckoutRequest = {
  lines: OrderLine[]
  order: OrderForm
  successUrl: string
  cancelUrl: string
  /** Same key for the same submission, so a double click opens one payment session. */
  idempotencyKey: string
}

export type CheckoutStatus = {
  status: 'paid' | 'unpaid' | 'expired'
  email?: string
  /** Amount paid, in bani. */
  total?: number
  lineKeys: string[]
}

/**
 * The only surface the rest of the app knows about. Swapping Stripe for another
 * processor means writing one more implementation of this interface.
 */
export interface PaymentProvider {
  readonly id: string
  createCheckout(req: CheckoutRequest): Promise<{ redirectUrl: string; reference: string }>
  getCheckout(reference: string): Promise<CheckoutStatus | null>
}

export class PaymentError extends Error {}
