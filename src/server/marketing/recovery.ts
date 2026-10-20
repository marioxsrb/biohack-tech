/**
 * Checkout recovery. An unpaid card order becomes `abandoned` on its own schedule; whether anyone may
 * email the customer about it is a separate question, answered only here.
 *
 * A recovery email is commercial communication. It needs the address's email marketing consent
 * (Legea 506/2004 art. 12(1)); an unfinished checkout is not a sale, so the existing-customer
 * exception does not cover it. Without consent the order is still marked abandoned and visible in
 * the CRM, but no email is allowed. The decision is re-checked at every CRM sync, so a later
 * withdrawal, payment or cancellation removes the permission.
 */
import 'server-only'
import { randomBytes } from 'node:crypto'
import { getDb } from '@/server/db'
import type { Order } from '@/server/orders/model'
import { orders } from '@/server/orders/repository'
import { isPaid } from '@/server/orders/state'
import type { ConsentState } from './consent'
import { leadRecoveryCart } from '@/server/leads'

/** How long a recovery link works after the order is marked abandoned. */
export const RECOVERY_LINK_DAYS = 7

export type RecoveryReason =
  | 'marketing_consent'
  | 'not_card'
  | 'not_abandoned'
  | 'paid'
  | 'no_marketing_consent'
  | 'consent_withdrawn'
  | 'link_expired'
  | 'no_link'

export type RecoveryDecision = { eligible: boolean; reason: RecoveryReason }

type RecoveryOrder = Pick<Order, 'paymentMethod' | 'paymentStatus' | 'status' | 'recoveryToken' | 'recoveryExpiresAt'>

/**
 * May a checkout recovery email go out for this order now? Pure: the caller loads the order and the
 * address's current consent. `requireLink` is off only while deciding, before the link exists.
 */
export function canSendAbandonedCheckoutEmail(o: RecoveryOrder, consent: ConsentState | null, now = new Date(), requireLink = true): RecoveryDecision {
  const no = (reason: RecoveryReason) => ({ eligible: false, reason })
  if (o.paymentMethod !== 'card') return no('not_card')
  if (isPaid(o.paymentStatus) || o.paymentStatus === 'refunded') return no('paid')
  if (o.status !== 'abandoned') return no('not_abandoned')
  if (!consent) return no('no_marketing_consent')
  if (!consent.granted) return no('consent_withdrawn')
  if (requireLink) {
    if (!o.recoveryToken || !o.recoveryExpiresAt) return no('no_link')
    if (o.recoveryExpiresAt.getTime() <= now.getTime()) return no('link_expired')
  }
  return { eligible: true, reason: 'marketing_consent' }
}

export const newRecoveryToken = () => randomBytes(24).toString('base64url')
export const recoveryExpiry = (from = new Date()) => new Date(from.getTime() + RECOVERY_LINK_DAYS * 86_400_000)

/**
 * The products a recovery link puts back in the cart, or null when the link is unknown, expired, or the
 * order is no longer an unpaid abandoned card order. Nothing else about the order leaves the server.
 */
export async function recoveryCart(token: string, now = new Date()) {
  if (!/^[\w-]{20,64}$/.test(token)) return null
  const db = await getDb()
  const o = await orders.byRecoveryToken(db, token)
  // A lead's recovery link (checkout contact step): its own selection, only what is still sold.
  if (!o) return (await leadRecoveryCart(db, token))?.cart ?? null
  if (o.status !== 'abandoned' || o.paymentMethod !== 'card' || isPaid(o.paymentStatus)) return null
  if (!o.recoveryExpiresAt || o.recoveryExpiresAt.getTime() <= now.getTime()) return null
  return o.items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? undefined, quantity: i.quantity }))
}
