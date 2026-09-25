import { createStripeProvider } from './stripe'
import type { PaymentProvider } from './types'

/**
 * Returns the configured payment provider, or null when payments are not set up.
 * With null, checkout tells the buyer plainly that online payment isn't active yet;
 * no order is simulated.
 */
export function getPaymentProvider(): PaymentProvider | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (key && /^sk_(test|live)_/.test(key)) return createStripeProvider(key)
  return null
}

export * from './types'
