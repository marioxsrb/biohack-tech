/**
 * Accounts of the private iOS app "BiohackTech Sales": at most two people, each with their own password (scrypt),
 * created in /admin. A login returns an opaque session token (the app keeps it in the Keychain); only its SHA-256
 * is stored, so a database copy never holds a usable session. Sessions last 90 days and can be revoked.
 * Everything the app reads is read-only; nothing here can change an order.
 */
import 'server-only'
import { createHash, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { Queryable } from '@/server/db'

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number }) => Promise<Buffer>

export const APP_MAX_USERS = 2
export const APP_PASSWORD_MIN = 12
const SESSION_DAYS = 90
const PARAMS = { N: 2 ** 15, r: 8, p: 1 }

export type AppUser = { id: string; email: string; name: string; active: boolean; createdAt: Date; lastLoginAt: Date | null }

const toUser = (r: Record<string, unknown>): AppUser => ({
  id: r.id as string,
  email: r.email as string,
  name: r.name as string,
  active: !!r.active,
  createdAt: new Date(r.created_at as string),
  lastLoginAt: r.last_login_at ? new Date(r.last_login_at as string) : null,
})

export async function hashPassword(pw: string) {
  const salt = randomBytes(16)
  const key = await scrypt(pw, salt, 32, { ...PARAMS, maxmem: 64 * 1024 * 1024 } as never)
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(pw: string, stored: string) {
  const [alg, n, r, p, salt, key] = stored.split('$')
  if (alg !== 'scrypt' || !salt || !key) return false
  const want = Buffer.from(key, 'base64')
  const got = await scrypt(pw, Buffer.from(salt, 'base64'), want.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 } as never)
  return got.length === want.length && timingSafeEqual(got, want)
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const normEmail = (e: string) => e.trim().toLowerCase()

/** Burns the same time as a real check when the address is unknown (no account enumeration by timing). */
const DUMMY = 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

export const appUsers = {
  async list(q: Queryable): Promise<AppUser[]> {
    return (await q.query('select * from app_users order by created_at')).rows.map(toUser)
  },

  /** Adds an account (refused past two, or for an address already used, or a short password). */
  async create(q: Queryable, x: { email: string; name: string; password: string }) {
    const email = normEmail(x.email)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false as const, reason: 'Adresa de email nu este validă.' }
    if (x.password.length < APP_PASSWORD_MIN) return { ok: false as const, reason: `Parola trebuie să aibă cel puțin ${APP_PASSWORD_MIN} caractere.` }
    const { rows } = await q.query<{ n: number }>('select count(*)::int as n from app_users where active')
    if ((rows[0]?.n ?? 0) >= APP_MAX_USERS) return { ok: false as const, reason: `Aplicația are deja ${APP_MAX_USERS} conturi active.` }
    const id = randomUUID()
    const r = await q.query('insert into app_users (id, email, name, password_hash) values ($1, $2, $3, $4) on conflict (email) do nothing returning id', [
      id,
      email,
      x.name.trim().slice(0, 80) || email,
      await hashPassword(x.password),
    ])
    return r.rows.length ? { ok: true as const, id } : { ok: false as const, reason: 'Există deja un cont cu această adresă.' }
  },

  async setPassword(q: Queryable, id: string, password: string) {
    if (password.length < APP_PASSWORD_MIN) return false
    const r = await q.query('update app_users set password_hash = $2 where id = $1 returning id', [id, await hashPassword(password)])
    // A new password signs every phone out.
    if (r.rows.length) await q.query('update app_sessions set revoked_at = now() where user_id = $1 and revoked_at is null', [id])
    return r.rows.length > 0
  },

  /** Deactivates an account: its sessions end and its phones stop receiving notifications. */
  async setActive(q: Queryable, id: string, active: boolean) {
    const r = await q.query('update app_users set active = $2 where id = $1 returning id', [id, active])
    if (!active) {
      await q.query('update app_sessions set revoked_at = now() where user_id = $1 and revoked_at is null', [id])
      await q.query(`update app_devices set active = false, disabled_reason = 'account disabled' where user_id = $1`, [id])
    }
    return r.rows.length > 0
  },
}

export const appSessions = {
  /** Email + password → a new session token, or null. The same work whether the address exists or not. */
  async login(q: Queryable, email: string, password: string, userAgent: string | null) {
    const { rows } = await q.query('select * from app_users where email = $1', [normEmail(email)])
    const row = rows[0]
    const ok = await verifyPassword(password, (row?.password_hash as string) ?? DUMMY)
    if (!row || !ok || !row.active) return null
    const token = randomBytes(32).toString('base64url')
    await q.query(`insert into app_sessions (id, user_id, token_hash, expires_at, user_agent) values ($1, $2, $3, now() + interval '${SESSION_DAYS} days', $4)`, [
      randomUUID(),
      row.id,
      sha(token),
      userAgent?.slice(0, 200) ?? null,
    ])
    await q.query('update app_users set last_login_at = now() where id = $1', [row.id])
    return { token, user: toUser(row) }
  },

  /** The session's user, if the token is valid, not expired, not revoked and the account is active. */
  async verify(q: Queryable, token: string | null | undefined) {
    if (!token || token.length < 30 || token.length > 100) return null
    const { rows } = await q.query(
      `select u.*, s.id as session_id from app_sessions s join app_users u on u.id = s.user_id
       where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now() and u.active`,
      [sha(token)],
    )
    if (!rows[0]) return null
    await q.query('update app_sessions set last_used_at = now() where id = $1', [rows[0].session_id])
    return { user: toUser(rows[0]), sessionId: rows[0].session_id as string }
  },

  async revoke(q: Queryable, sessionId: string) {
    await q.query('update app_sessions set revoked_at = now() where id = $1 and revoked_at is null', [sessionId])
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
