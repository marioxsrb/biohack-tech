/**
 * The AI calling consent log, by phone number: every grant and withdrawal is a new row (the proof), the
 * latest one is the current state. Granted only by the separate box on the price form or in the checkout;
 * withdrawn by a refusal during a call, by an admin, or by the email unsubscribe (which stops calls too).
 */
import 'server-only'
import { CALL_CONSENT_VERSION } from '@/lib/consent/calling'
import type { Config } from '@/server/config'
import type { Queryable } from '@/server/db'
import type { NewJob } from '@/server/jobs/outbox'
import type { Lead } from '@/server/leads'

export type CallConsentSource = 'lead_form' | 'checkout' | 'call' | 'admin' | 'unsubscribe_link'
export type CallConsentState = { granted: boolean; at: Date; version: string | null; source: CallConsentSource }

export const callConsent = {
  async state(q: Queryable, phone: string): Promise<CallConsentState | null> {
    const { rows } = await q.query<{ granted: boolean; created_at: string; text_version: string | null; source: CallConsentSource }>(
      'select granted, created_at, text_version, source from call_consent_events where phone = $1 order by id desc limit 1',
      [phone],
    )
    const r = rows[0]
    return r ? { granted: r.granted, at: new Date(r.created_at), version: r.text_version, source: r.source } : null
  },

  /** Several numbers at once, for the admin list: phone → granted. */
  async states(q: Queryable, phones: string[]): Promise<Map<string, boolean>> {
    if (!phones.length) return new Map()
    const { rows } = await q.query<{ phone: string; granted: boolean }>(
      'select distinct on (phone) phone, granted from call_consent_events where phone = any($1::text[]) order by phone, id desc',
      [[...new Set(phones)]],
    )
    return new Map(rows.map((r) => [r.phone, r.granted]))
  },

  grant: (q: Queryable, e: { phone: string; email?: string | null; source: CallConsentSource; page?: string; leadId?: string }) =>
    q.query('insert into call_consent_events (phone, email, granted, text_version, source, page, lead_id) values ($1, $2, true, $3, $4, $5, $6)', [
      e.phone,
      e.email?.toLowerCase() ?? null,
      CALL_CONSENT_VERSION,
      e.source,
      e.page?.slice(0, 80) ?? null,
      e.leadId ?? null,
    ]),

  /** Records a withdrawal unless the number already has none in force. */
  async withdraw(q: Queryable, e: { phone: string; email?: string | null; source: CallConsentSource; leadId?: string }) {
    const now = await callConsent.state(q, e.phone)
    if (now && !now.granted) return false
    await q.query('insert into call_consent_events (phone, email, granted, text_version, source, lead_id) values ($1, $2, false, null, $3, $4)', [e.phone, e.email?.toLowerCase() ?? null, e.source, e.leadId ?? null])
    return true
  },
}

/** The first call for a lead: after the configured quiet time; the job itself checks everything again. */
export function firstCallJob(lead: Pick<Lead, 'id' | 'lastActivityAt'>, c: Pick<Config, 'calling'>): NewJob {
  return { kind: 'call.attempt', dedupeKey: `call.attempt:${lead.id}:1`, payload: { leadId: lead.id, attempt: 1 }, runAt: new Date(lead.lastActivityAt.getTime() + c.calling.firstDelayMinutes * 60_000) }
}
