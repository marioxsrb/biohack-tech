/**
 * Numbers the AI agent never calls, whatever the consent, test list or retries say (added in /admin/apeluri or
 * through the admin API). Checked when a call is planned and again just before dialing; test calls too.
 */
import 'server-only'
import { romanianE164 } from '@/lib/consent/calling'
import type { Queryable } from '@/server/db'

export type BlockedNumber = { phone: string; note: string | null; createdAt: Date; createdBy: string | null }

export const callBlocklist = {
  async has(q: Queryable, phone: string | null) {
    if (!phone) return false
    const { rows } = await q.query('select 1 from call_blocklist where phone = $1', [phone])
    return rows.length > 0
  },
  async list(q: Queryable): Promise<BlockedNumber[]> {
    const { rows } = await q.query('select * from call_blocklist order by created_at desc')
    return rows.map((r) => ({ phone: r.phone as string, note: (r.note as string) ?? null, createdAt: new Date(r.created_at as string), createdBy: (r.created_by as string) ?? null }))
  },
  /** Adds a number (any common Romanian format); returns the stored E.164 number, or null when it is not one. */
  async add(q: Queryable, raw: string, note: string | null, by: string) {
    const phone = romanianE164(raw)
    if (!phone) return null
    await q.query('insert into call_blocklist (phone, note, created_by) values ($1, $2, $3) on conflict (phone) do update set note = coalesce(excluded.note, call_blocklist.note)', [phone, note?.slice(0, 120) || null, by.slice(0, 80)])
    // Waiting attempts for this number are dropped at once.
    await q.query(
      `update jobs set status = 'skipped', last_error = 'number on the do-not-call list', updated_at = now()
       where kind = 'call.attempt' and status in ('pending', 'retry') and payload->>'leadId' in (select id::text from leads where phone is not null and regexp_replace(phone, '\\D', '', 'g') like '%' || right($1, 9))`,
      [phone],
    )
    return phone
  },
  async remove(q: Queryable, raw: string) {
    const phone = romanianE164(raw) ?? raw
    const { rows } = await q.query('delete from call_blocklist where phone = $1 returning phone', [phone])
    return rows.length > 0
  },
}
