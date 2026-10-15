/**
 * The AI calling consent log, by phone number: every grant and withdrawal is a new row (the proof), the
 * latest one is the current state. Granted only by a box whose text names the calls (today the communications
 * box, on the price form or in the checkout); withdrawn by a refusal during a call, by an admin, or by the email
 * unsubscribe (which stops calls too). The CRM learns the state through marketing.sync (a contact tag).
 */
import 'server-only'
import { CALL_CONSENT_VERSION } from '@/lib/consent/calling'
import type { Config } from '@/server/config'
import type { Queryable } from '@/server/db'
import type { NewJob } from '@/server/jobs/outbox'
import type { Lead } from '@/server/leads'
import { firstCallDelay } from './delay'

export type CallConsentSource = 'lead_form' | 'checkout' | 'call' | 'admin' | 'unsubscribe_link' | 'ghl'
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

  /** Records a grant with the current text version; returns the event id. */
  async grant(q: Queryable, e: { phone: string; email?: string | null; source: CallConsentSource; page?: string; leadId?: string }): Promise<number> {
    const { rows } = await q.query<{ id: number }>(
      'insert into call_consent_events (phone, email, granted, text_version, source, page, lead_id) values ($1, $2, true, $3, $4, $5, $6) returning id',
      [e.phone, e.email?.toLowerCase() ?? null, CALL_CONSENT_VERSION, e.source, e.page?.slice(0, 80) ?? null, e.leadId ?? null],
    )
    return Number(rows[0]?.id)
  },

  /** Whether any number this address gave has a call consent in force (latest event per number). */
  async grantedForEmail(q: Queryable, email: string): Promise<boolean> {
    const { rows } = await q.query<{ granted: boolean }>(
      `select distinct on (e.phone) e.granted from call_consent_events e
       where e.phone in (select phone from call_consent_events where email = $1) order by e.phone, e.id desc`,
      [email.trim().toLowerCase()],
    )
    return rows.some((r) => r.granted)
  },

  /** Withdraws every number this address gave (the email unsubscribe stops calls too); returns how many changed. */
  async withdrawForEmail(q: Queryable, email: string, source: CallConsentSource): Promise<number> {
    const { rows } = await q.query<{ phone: string }>('select distinct phone from call_consent_events where email = $1', [email.trim().toLowerCase()])
    let n = 0
    for (const r of rows) if (await callConsent.withdraw(q, { phone: r.phone, email, source })) n++
    return n
  },

  /** Records a withdrawal unless the number already has none in force. */
  async withdraw(q: Queryable, e: { phone: string; email?: string | null; source: CallConsentSource; leadId?: string }) {
    const now = await callConsent.state(q, e.phone)
    if (now && !now.granted) return false
    await q.query('insert into call_consent_events (phone, email, granted, text_version, source, lead_id) values ($1, $2, false, null, $3, $4)', [e.phone, e.email?.toLowerCase() ?? null, e.source, e.leadId ?? null])
    return true
  },
}

/** The first call for a lead: after the configured quiet time; the job itself checks everything again. */
export function firstCallJob(lead: Pick<Lead, 'id' | 'lastActivityAt' | 'productId' | 'cart'>, c: Pick<Config, 'calling'>, phone: string | null): NewJob {
  return { kind: 'call.attempt', dedupeKey: `call.attempt:${lead.id}:1`, payload: { leadId: lead.id, attempt: 1 }, runAt: new Date(lead.lastActivityAt.getTime() + firstCallDelay(lead, c.calling, phone) * 60_000) }
}
