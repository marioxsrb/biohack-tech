import 'server-only'
import { getBankDetails, getOrderWebhook } from '@/config/bank'
import type { PaymentMethod } from '@/lib/checkout'
import { createStripeProvider } from './stripe'
import type { PaymentProvider } from './types'

/**
 * Returns the configured card processor, or null when card payments are not set up.
 * With null, checkout shows card payment as "în curând"; no order is simulated.
 */
export function getPaymentProvider(): PaymentProvider | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (key && /^sk_(test|live)_/.test(key)) return createStripeProvider(key)
  return null
}

/** Which payment methods can actually complete an order right now. */
export function availablePaymentMethods(): Record<PaymentMethod, boolean> {
  return {
    card: getPaymentProvider() !== null,
    transfer: getBankDetails() !== null && getOrderWebhook() !== null,
  }
}

export * from './types'
