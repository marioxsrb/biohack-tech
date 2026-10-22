/**
 * Failed sign-ins counted in the database (auth_attempts), so the limit holds across every server instance: one
 * counter per client address for both logins that accept the admin password (/admin and /fulfillment). After
 * LOGIN_MAX failures in LOGIN_WINDOW_MS the address is refused until the window ends; a success clears it.
 * If the database cannot be reached, the per-instance limiter (server/rate-limit.ts) still applies.
 */
import 'server-only'
import type { Queryable } from '@/server/db'

export const LOGIN_MAX = 10
export const LOGIN_WINDOW_MS = 15 * 60_000

const keyOf = (ip: string) => `login:${ip}`

export async function loginBlocked(q: Queryable, ip: string, now = new Date()): Promise<boolean> {
  const { rows } = await q.query<{ failures: number; window_start: string }>('select failures, window_start from auth_attempts where key = $1', [keyOf(ip)])
  const r = rows[0]
  return !!r && now.getTime() - new Date(r.window_start).getTime() < LOGIN_WINDOW_MS && Number(r.failures) >= LOGIN_MAX
}

export async function loginFailed(q: Queryable, ip: string, now = new Date()) {
  await q.query(
    `insert into auth_attempts (key, failures, window_start) values ($1, 1, $2)
     on conflict (key) do update set
       failures = case when auth_attempts.window_start < $3 then 1 else auth_attempts.failures + 1 end,
       window_start = case when auth_attempts.window_start < $3 then $2 else auth_attempts.window_start end`,
    [keyOf(ip), now, new Date(now.getTime() - LOGIN_WINDOW_MS)],
  )
}

export async function loginSucceeded(q: Queryable, ip: string) {
  await q.query('delete from auth_attempts where key = $1', [keyOf(ip)])
}

/** Old rows (the cron): windows that ended a day ago. */
export async function purgeAuthAttempts(q: Queryable, now = new Date()) {
  await q.query('delete from auth_attempts where window_start < $1', [new Date(now.getTime() - 86_400_000)])
}
