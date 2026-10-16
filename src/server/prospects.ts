/**
 * Where a person who left an address stands, for the CRM's leads pipeline (one opportunity per address): the
 * furthest step reached across the price form, the 10% popup, the checkout and orders, or "unsubscribed" when the
 * latest marketing decision is a withdrawal. Computed from our database every time, so a resync is always right.
 */
import 'server-only'
import type { Queryable } from '@/server/db'
import type { LeadStageKey } from '@/server/integrations/ghl'

export type Prospect = { name: string; stage: LeadStageKey; site: 'ro' | 'net' }

const INTL_HOST = /(^|\.)biohack-tech\.net$/i

export async function prospectFor(q: Queryable, email: string, hint?: { site?: 'ro' | 'net' }): Promise<Prospect | null> {
  const addr = email.trim().toLowerCase()
  const [leadRows, popup, placed, consent] = await Promise.all([
    q.query<{ name: string | null; stage: string; landing_host: string | null }>('select name, stage, landing_host from leads where email = $1 order by created_at', [addr]),
    q.query('select 1 from welcome_signups where email = $1', [addr]),
    q.query(
      `select 1 from orders where email = $1 and kind = 'checkout'
         and (status in ('confirmed', 'processing', 'shipped', 'delivered') or payment_status = 'awaiting_transfer') limit 1`,
      [addr],
    ),
    q.query<{ granted: boolean }>('select granted from marketing_consent_events where email = $1 order by id desc limit 1', [addr]),
  ])
  const stages = new Set(leadRows.rows.map((r) => r.stage))
  if (!leadRows.rows.length && !popup.rows.length && !placed.rows.length) return null
  const stage: LeadStageKey =
    placed.rows.length || stages.has('ordered') || stages.has('purchased')
      ? 'ordered'
      : consent.rows[0]?.granted === false
        ? 'unsubscribed'
        : stages.has('checkout_started')
          ? 'checkout'
          : leadRows.rows.length
            ? 'lead'
            : 'popup'
  const name = leadRows.rows.map((r) => r.name?.trim()).find(Boolean) ?? addr
  const site = hint?.site ?? (leadRows.rows.some((r) => r.landing_host && INTL_HOST.test(r.landing_host)) ? 'net' : 'ro')
  return { name, stage, site }
}
