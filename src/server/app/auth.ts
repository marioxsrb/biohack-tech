/**
 * Sign-in of the private iOS app "BiohackTech Sales": one account, the web admin's. The user name is always "admin"
 * and the password is checked on the server against ADMIN_PASSWORD with the web admin's own check (lib/admin-auth),
 * which this file does not change; the password is never stored, copied or sent anywhere. A login opens an app-only
 * session: an opaque token (the app keeps it in the Keychain), of which only a SHA-256 is stored, plus a keyed
 * fingerprint of the password it was opened with (HMAC with ADMIN_SESSION_SECRET) so a new ADMIN_PASSWORD ends every
 * app session. The session reads (orders, stats) and registers its own iPhone; it is never accepted by /admin or
 * /api/admin, so it can do nothing administrative. Sessions last 90 days and can be revoked from /admin.
 */
import 'server-only'
import { createHash, createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { checkAdminCredentials } from '@/lib/admin-auth'
import type { Queryable } from '@/server/db'

export const APP_USERNAME = 'admin'
const SESSION_DAYS = 90

/** The single principal the app's sessions and iPhones belong to (a row with no password: the password is ADMIN_PASSWORD). */
export const ADMIN_PRINCIPAL_ID = '00000000-0000-4000-8000-00000000ad01'

export type AppUser = { id: string; email: string; name: string; active: boolean; createdAt: Date; lastLoginAt: Date | null }

const toUser = (r: Record<string, unknown>): AppUser => ({
  id: r.id as string,
  email: r.email as string,
  name: r.name as string,
  active: !!r.active,
  createdAt: new Date(r.created_at as string),
  lastLoginAt: r.last_login_at ? new Date(r.last_login_at as string) : null,
})

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
function same(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/**
 * A fingerprint of the current ADMIN_PASSWORD for the sessions (not the password, and useless without the server's
 * ADMIN_SESSION_SECRET). Without that secret (local development) a slow scrypt of the password stands in.
 */
export function passwordTag(env: Record<string, string | undefined> = process.env) {
  const pw = env.ADMIN_PASSWORD ?? ''
  if (env.ADMIN_SESSION_SECRET) return createHmac('sha256', env.ADMIN_SESSION_SECRET).update(`bt-app-session:${pw}`).digest('hex')
  return scryptSync(pw, 'bt-app-session-tag', 32).toString('hex')
}

async function ensurePrincipal(q: Queryable) {
  await q.query(
    `insert into app_users (id, email, name, password_hash) values ($1, 'admin', 'Admin', 'none: the web admin password (ADMIN_PASSWORD) is checked')
     on conflict (id) do update set active = true`,
    [ADMIN_PRINCIPAL_ID],
  )
}

export const appSessions = {
  /** "admin" + the web admin's password → a new app session, or null. The same checks whatever is wrong. */
  async login(q: Queryable, username: string, password: string, userAgent: string | null, env: Record<string, string | undefined> = process.env) {
    const userOk = same(username.trim().toLowerCase(), APP_USERNAME)
    // The web admin's own check (its configured user name, ADMIN_PASSWORD, minimum length), unchanged.
    const passOk = checkAdminCredentials(env.ADMIN_USER || 'admin', password, env) === 'ok'
    if (!userOk || !passOk) return null
    await ensurePrincipal(q)
    const token = randomBytes(32).toString('base64url')
    await q.query(
      `insert into app_sessions (id, user_id, token_hash, expires_at, user_agent, pw_tag) values ($1, $2, $3, now() + interval '${SESSION_DAYS} days', $4, $5)`,
      [randomUUID(), ADMIN_PRINCIPAL_ID, sha(token), userAgent?.slice(0, 200) ?? null, passwordTag(env)],
    )
    const { rows } = await q.query('update app_users set last_login_at = now() where id = $1 returning *', [ADMIN_PRINCIPAL_ID])
    return { token, user: toUser(rows[0]) }
  },

  /** The session, if the token is valid, unexpired, not revoked and opened with the current ADMIN_PASSWORD. */
  async verify(q: Queryable, token: string | null | undefined, env: Record<string, string | undefined> = process.env) {
    if (!token || token.length < 30 || token.length > 100) return null
    const { rows } = await q.query(
      `select u.*, s.id as session_id, s.pw_tag from app_sessions s join app_users u on u.id = s.user_id
       where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now() and u.active and s.user_id = $2`,
      [sha(token), ADMIN_PRINCIPAL_ID],
    )
    const r = rows[0]
    if (!r) return null
    if (!r.pw_tag || !same(r.pw_tag as string, passwordTag(env))) {
      // The admin password changed since this session opened: it ends for good.
      await q.query('update app_sessions set revoked_at = now() where id = $1', [r.session_id])
      return null
    }
    await q.query('update app_sessions set last_used_at = now() where id = $1', [r.session_id])
    return { user: toUser(r), sessionId: r.session_id as string }
  },

  async revoke(q: Queryable, sessionId: string) {
    await q.query('update app_sessions set revoked_at = now() where id = $1 and revoked_at is null', [sessionId])
  },

  /** /admin: sign every iPhone out (their sessions end and they stop receiving notifications). */
  async revokeAll(q: Queryable) {
    await q.query('update app_sessions set revoked_at = now() where revoked_at is null')
    await q.query(`update app_devices set active = false, disabled_reason = 'signed out from /admin' where active`)
  },

  async active(q: Queryable) {
    const { rows } = await q.query<{ n: number }>('select count(*)::int as n from app_sessions where revoked_at is null and expires_at > now()')
    return rows[0]?.n ?? 0
  },
}

export type DevicePrefs = { payments: boolean; newOrders: boolean; kaching: boolean }
export const DEFAULT_PREFS: DevicePrefs = { payments: true, newOrders: true, kaching: true }
const APNS_TOKEN = /^[0-9a-f]{64,200}$/i

export const appDevices = {
  /** Registers (or moves to this account) an iPhone's APNs token; the app calls it at every launch. */
  async register(q: Queryable, userId: string, x: { token: string; environment: string; name?: string; prefs?: Partial<DevicePrefs> }) {
    if (!APNS_TOKEN.test(x.token) || (x.environment !== 'sandbox' && x.environment !== 'production')) return null
    const prefs = { ...DEFAULT_PREFS, ...pickPrefs(x.prefs) }
    const { rows } = await q.query<{ id: string; prefs: DevicePrefs }>(
      `insert into app_devices (id, user_id, token, environment, name, prefs) values ($1, $2, $3, $4, $5, $6)
       on conflict (token) do update set user_id = excluded.user_id, environment = excluded.environment, name = coalesce(excluded.name, app_devices.name),
         active = true, disabled_reason = null, last_seen_at = now()
       returning id, prefs`,
      [randomUUID(), userId, x.token.toLowerCase(), x.environment, x.name?.slice(0, 80) ?? null, JSON.stringify(prefs)],
    )
    return rows[0]
  },

  async setPrefs(q: Queryable, userId: string, deviceId: string, prefs: Partial<DevicePrefs>) {
    const { rows } = await q.query<{ prefs: DevicePrefs }>('update app_devices set prefs = prefs || $3::jsonb where id = $1 and user_id = $2 returning prefs', [
      deviceId,
      userId,
      JSON.stringify(pickPrefs(prefs)),
    ])
    return rows[0]?.prefs ?? null
  },

  async remove(q: Queryable, userId: string, deviceId: string) {
    await q.query(`update app_devices set active = false, disabled_reason = 'signed out' where id = $1 and user_id = $2`, [deviceId, userId])
  },

  /** Every phone that should hear about an event, with its preferences (active accounts only). */
  async targets(q: Queryable) {
    const { rows } = await q.query<{ id: string; token: string; environment: 'sandbox' | 'production'; prefs: DevicePrefs }>(
      `select d.id, d.token, d.environment, d.prefs from app_devices d join app_users u on u.id = d.user_id where d.active and u.active`,
    )
    return rows.map((r) => ({ ...r, prefs: { ...DEFAULT_PREFS, ...r.prefs } }))
  },

  async disable(q: Queryable, deviceId: string, reason: string) {
    await q.query('update app_devices set active = false, disabled_reason = $2 where id = $1', [deviceId, reason.slice(0, 120)])
  },

  async forUser(q: Queryable, userId: string) {
    return (await q.query('select id, name, environment, prefs, active, last_seen_at from app_devices where user_id = $1 order by last_seen_at desc', [userId])).rows
  },
}

function pickPrefs(p: Partial<DevicePrefs> | undefined): Partial<DevicePrefs> {
  const out: Partial<DevicePrefs> = {}
  for (const k of ['payments', 'newOrders', 'kaching'] as const) if (typeof p?.[k] === 'boolean') out[k] = p[k]
  return out
}
