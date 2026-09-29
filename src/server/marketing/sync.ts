/**
 * What GoHighLevel must know about an address's marketing status, computed from our database at every
 * sync: consent (Da/Nu), the recovery link while a recovery email is allowed, and the unsubscribe link.
 * GHL workflows only act on these values; they never decide eligibility themselves.
 */
import 'server-only'
import type { Queryable } from '@/server/db'
import type { MarketingFields } from '@/server/integrations/ghl'
import { orders } from '@/server/orders/repository'
import { marketing } from './consent'
import { canSendAbandonedCheckoutEmail } from './recovery'

export async function marketingStatus(q: Queryable, email: string, siteUrl: string, now = new Date()) {
  const consent = await marketing.state(q, email)
  const token = await marketing.unsubscribeToken(q, email)
  const recoverable = (await orders.abandonedFor(q, email)).find((o) => canSendAbandonedCheckoutEmail(o, consent, now).eligible)
  const { rows } = await q.query("select 1 from orders where email = $1 and recovery_status = 'eligible' limit 1", [email])
  const fields: MarketingFields = {
    consent: !!consent?.granted,
    recoveryUrl: recoverable ? `${siteUrl}/reluare/${recoverable.recoveryToken}` : '',
    unsubscribeUrl: token && consent ? `${siteUrl}/dezabonare/${token}` : '',
  }
  // `hadRecovery`: the recovery tag may exist in GHL and must be removed when no longer allowed.
  return { fields, recoverable: !!recoverable, hadRecovery: rows.length > 0 }
}
