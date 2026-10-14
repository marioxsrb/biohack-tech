/**
 * The operator's controls over AI calling for one lead (from /admin/leaduri). Each one is safe to repeat;
 * a retry only queues an attempt, which still checks consent, purchase, hours and limits when it runs.
 */
import 'server-only'
import type { Config } from '@/server/config'
import type { Queryable } from '@/server/db'
import { jobs } from '@/server/jobs/outbox'
import { romanianE164 } from '@/lib/consent/calling'
import { leads, type Lead } from '@/server/leads'
import { callConsent } from './consent'

/** A call that ended without a real conversation (or a dry run) may be tried again; a refusal never. */
export const canRetryCall = (l: Pick<Lead, 'callStatus' | 'callOutcome' | 'callDisabled' | 'callAttempts'>, maxAttempts: number) =>
  !l.callDisabled &&
  l.callAttempts < maxAttempts &&
  (l.callStatus === 'failed' || l.callStatus === 'dry_run' || (l.callStatus === 'stopped' && ['no_answer', 'busy', 'technical_failure'].includes(l.callOutcome ?? '')))

/** Cancels the lead's waiting call attempts. Returns how many were cancelled. */
export async function cancelScheduledCalls(q: Queryable, leadId: string) {
  const { rows } = await q.query(
    `update jobs set status = 'skipped', last_error = 'cancelled in admin', updated_at = now()
     where kind = 'call.attempt' and payload->>'leadId' = $1 and status in ('pending', 'retry') returning id`,
    [leadId],
  )
  if (rows.length) await q.query(`update leads set call_status = case when call_status = 'scheduled' then 'none' else call_status end, updated_at = now() where id = $1`, [leadId])
  return rows.length
}

/** No more calls for this lead, whatever happens next (consent and the other leads are untouched). */
export async function disableCalling(q: Queryable, leadId: string) {
  await cancelScheduledCalls(q, leadId)
  await q.query(`update leads set call_disabled = true, call_status = 'disabled', updated_at = now() where id = $1`, [leadId])
}

/** One more attempt now, for a failed or uncertain call, within the attempt limit. */
export async function retryCall(q: Queryable, c: Pick<Config, 'calling'>, leadId: string): Promise<string> {
  const lead = await leads.byId(q, leadId)
  if (!lead) return 'lead not found'
  if (lead.callDisabled) return 'calling disabled for this lead'
  if (lead.callAttempts + 1 > c.calling.maxAttempts) return 'maximum attempts reached'
  if (!canRetryCall(lead, c.calling.maxAttempts)) return `nothing to retry (${lead.callStatus}${lead.callOutcome ? `, ${lead.callOutcome}` : ''})`
  const phone = romanianE164(lead.phone)
  if (!phone || !(await callConsent.state(q, phone))?.granted) return 'no call consent in force'
  const attempt = lead.callAttempts + 1
  const added = await jobs.enqueue(q, { kind: 'call.attempt', dedupeKey: `call.attempt:${lead.id}:${attempt}:admin`, payload: { leadId: lead.id, attempt } })
  if (added) await leads.update(q, lead.id, { call_status: 'scheduled' })
  return added ? `attempt ${attempt} queued` : 'already queued'
}
