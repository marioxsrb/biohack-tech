/**
 * Withdrawing email marketing consent, from any channel (the site's unsubscribe link, a GoHighLevel
 * notification, an operator). Recorded in our database first; GHL is updated afterwards by a job, so a
 * CRM outage never loses an unsubscribe. Order emails (confirmation, transfer details, invoice,
 * shipping, cancellation, refund) are not affected: they are not marketing.
 */
import 'server-only'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { jobs } from '@/server/jobs/outbox'
import { log } from '@/server/log'
import { marketing, type ConsentSource } from './consent'

/** Returns true when this call recorded a new withdrawal (false: the address had already withdrawn). */
export async function withdrawMarketing(email: string, source: ConsentSource, page?: string): Promise<boolean> {
  const db = await getDb()
  const changed = await db.tx(async (t) => {
    const id = await marketing.withdraw(t, { email, source, page })
    if (id && getConfig().ghl) await jobs.enqueue(t, { kind: 'marketing.sync', dedupeKey: `marketing.sync:${id}`, payload: { email: email.trim().toLowerCase() } })
    return id !== null
  })
  log.info('marketing.withdrawn', { source, changed })
  return changed
}
