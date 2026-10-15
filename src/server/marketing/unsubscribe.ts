/**
 * Withdrawing email marketing consent, from any channel (the site's unsubscribe link, a GoHighLevel
 * notification, an operator), and with it the AI call consent of the same address. Recorded in our database first; GHL is updated afterwards by a job, so a
 * CRM outage never loses an unsubscribe. Order emails (confirmation, transfer details, invoice,
 * shipping, cancellation, refund) are not affected: they are not marketing.
 */
import 'server-only'
import { getConfig } from '@/server/config'
import { getDb, type Queryable } from '@/server/db'
import { jobs } from '@/server/jobs/outbox'
import { log } from '@/server/log'
import { callConsent } from '@/server/calling/consent'
import { marketing, type ConsentSource } from './consent'

/** Returns true when this call recorded a new withdrawal (false: the address had already withdrawn). */
export async function withdrawMarketing(email: string, source: ConsentSource, page?: string): Promise<boolean> {
  const db = await getDb()
  const changed = await db.tx(async (t) => {
    const { id, calls } = await withdrawIn(t, email, source, page)
    if ((id || calls) && getConfig().ghl)
      await jobs.enqueue(t, { kind: 'marketing.sync', dedupeKey: `marketing.sync:${id ?? `calls-${Date.now()}`}`, payload: { email: email.trim().toLowerCase() } })
    return id !== null || calls > 0
  })
  log.info('marketing.withdrawn', { source, changed })
  return changed
}

async function withdrawIn(t: Queryable, email: string, source: ConsentSource, page?: string) {
  const id = await marketing.withdraw(t, { email, source, page })
  // An unsubscribe stops every commercial contact: the AI call consents of the address are withdrawn too.
  const calls = await callConsent.withdrawForEmail(t, email, source === 'checkout' || source === 'lead_form' ? 'admin' : source)
  return { id, calls }
}

/** The same withdrawal inside the caller's transaction (a refusal during an AI call); the caller queues the CRM sync. */
export async function withdrawAllMarketing(t: Queryable, email: string, source: ConsentSource) {
  const r = await withdrawIn(t, email, source)
  return r.id !== null || r.calls > 0
}
