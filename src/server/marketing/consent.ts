/**
 * Email marketing consent, in our database: the source of truth for every marketing or recovery decision.
 * GoHighLevel receives a copy (field `bt_marketing_consent`) and is never the only proof.
 *
 * Each address has one subject row (with its opaque unsubscribe token) and an append-only log of events.
 * The current state is the latest event. An unticked box at checkout records nothing: it is not an
 * objection, and it does not undo an earlier consent. Withdrawal is always recorded and always wins
 * until a new, explicit consent.
 */
import 'server-only'
import { randomBytes } from 'node:crypto'
import type { Queryable } from '@/server/db'
import { MARKETING_CONSENT_TEXTS, MARKETING_CONSENT_VERSION, type MarketingConsentVersion } from '@/lib/consent/marketing'

export type ConsentSource = 'checkout' | 'unsubscribe_link' | 'ghl' | 'admin'
export type ConsentState = { granted: boolean; at: Date; version: string; source: ConsentSource }

const norm = (email: string) => email.trim().toLowerCase()

async function ensureSubject(q: Queryable, email: string): Promise<string> {
  await q.query('insert into marketing_subjects (email, unsubscribe_token) values ($1, $2) on conflict (email) do nothing', [norm(email), randomBytes(24).toString('base64url')])
  const { rows } = await q.query<{ unsubscribe_token: string }>('select unsubscribe_token from marketing_subjects where email = $1', [norm(email)])
  return rows[0].unsubscribe_token
}

async function record(
  q: Queryable,
  e: { email: string; granted: boolean; source: ConsentSource; version?: MarketingConsentVersion; orderId?: string; page?: string },
) {
  await ensureSubject(q, e.email)
  const version = e.version ?? MARKETING_CONSENT_VERSION
  const { rows } = await q.query<{ id: string }>(
    `insert into marketing_consent_events (email, granted, source, text_version, consent_text, order_id, page)
     values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [norm(e.email), e.granted, e.source, version, MARKETING_CONSENT_TEXTS[version], e.orderId ?? null, e.page ?? null],
  )
  return Number(rows[0].id)
}

export const marketing = {
  /** The latest decision for an address, or null when it never agreed to anything. */
  async state(q: Queryable, email: string): Promise<ConsentState | null> {
    const { rows } = await q.query<{ granted: boolean; created_at: string; text_version: string; source: ConsentSource }>(
      'select granted, created_at, text_version, source from marketing_consent_events where email = $1 order by id desc limit 1',
      [norm(email)],
    )
    const r = rows[0]
    return r ? { granted: r.granted, at: new Date(r.created_at), version: r.text_version, source: r.source } : null
  },

  grant: (q: Queryable, e: { email: string; source: ConsentSource; orderId?: string; page?: string }) => record(q, { ...e, granted: true }),

  /** Returns the event id, or null when the address had already withdrawn (nothing new to record). */
  async withdraw(q: Queryable, e: { email: string; source: ConsentSource; page?: string }) {
    const now = await marketing.state(q, e.email)
    if (now && !now.granted) return null
    return record(q, { ...e, granted: false })
  },

  /** The address behind an unsubscribe token, or null. */
  async emailForToken(q: Queryable, token: string): Promise<string | null> {
    if (!/^[\w-]{20,64}$/.test(token)) return null
    const { rows } = await q.query<{ email: string }>('select email from marketing_subjects where unsubscribe_token = $1', [token])
    return rows[0]?.email ?? null
  },

  async unsubscribeToken(q: Queryable, email: string): Promise<string | null> {
    const { rows } = await q.query<{ unsubscribe_token: string }>('select unsubscribe_token from marketing_subjects where email = $1', [norm(email)])
    return rows[0]?.unsubscribe_token ?? null
  },

  async history(q: Queryable, email: string) {
    return (
      await q.query<{ granted: boolean; source: string; text_version: string; order_id: string | null; page: string | null; created_at: string }>(
        'select granted, source, text_version, order_id, page, created_at from marketing_consent_events where email = $1 order by id',
        [norm(email)],
      )
    ).rows
  },
}
