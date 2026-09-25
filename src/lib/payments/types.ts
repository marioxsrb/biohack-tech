import type { Customer } from '@/lib/checkout'
import type { Currency, Money } from '@/lib/money'

export type OrderLine = {
  /** Cart line key, so paid lines can be removed from the cart afterwards. */
  key: string
  name: string
  description?: string
  quantity: number
  unitAmount: number
}

export type CheckoutRequest = {
  currency: Currency
  lines: OrderLine[]
  customer: Customer
  successUrl: string
  cancelUrl: string
}

export type CheckoutStatus = {
  status: 'paid' | 'unpaid' | 'expired'
  email?: string
  total?: Money
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
