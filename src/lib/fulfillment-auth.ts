/**
 * The fulfillment portal's access (/fulfillment), separate from the admin's:
 *   - FULFILLMENT_USER / FULFILLMENT_PASSWORD (optional): a warehouse account. Its session (cookie bt_fulfil, role
 *     "staff") opens only /fulfillment and its actions; it never opens /admin, settings, refunds or secrets.
 *   - The admin's own credentials also open the portal (role "admin"), as asked: the same login works for both.
 * With a single shared admin password there is no real separation (whoever has it is an admin); separation exists
 * once employees get the warehouse password instead. Every portal action checks access itself, server-side.
 * No Node-only APIs (runs in the proxy too).
 */
import { ADMIN_PASSWORD_MIN, checkAdminCredentials, checkAdminRequest } from './admin-auth'

export const FULFIL_COOKIE = 'bt_fulfil'
export const FULFIL_SESSION_HOURS = 14

export type FulfilRole = 'staff' | 'admin'
export type FulfilActor = { role: FulfilRole; user: string }

type Env = Record<string, string | undefined>

const enc = new TextEncoder()
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')

function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}

/** Its own key (never the admin session's): a new warehouse or admin password ends every portal session. */
async function key(env: Env) {
  const secret = env.FULFILLMENT_SESSION_SECRET || `fulfil-session:${env.ADMIN_SESSION_SECRET || env.ADMIN_PASSWORD || ''}:${env.FULFILLMENT_PASSWORD || ''}`
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}
const sign = async (payload: string, env: Env) => hex(await crypto.subtle.sign('HMAC', await key(env), enc.encode(payload)))

/** The warehouse account, when configured with a long enough password. */
const staffConfigured = (env: Env) => !!env.FULFILLMENT_PASSWORD && env.FULFILLMENT_PASSWORD.length >= ADMIN_PASSWORD_MIN

/** A user name and password typed on /fulfillment/login: the warehouse account, else the admin's. */
export function checkFulfilCredentials(user: string, password: string, env: Env = process.env): FulfilRole | null {
  if (staffConfigured(env)) {
    const userOk = safeEqual(user, env.FULFILLMENT_USER || 'depozit')
    const passOk = safeEqual(password, env.FULFILLMENT_PASSWORD!)
    if (userOk && passOk) return 'staff'
  }
  return checkAdminCredentials(user, password, env) === 'ok' ? 'admin' : null
}

export async function createFulfilSession(role: FulfilRole, user: string, env: Env = process.env, now = Date.now()) {
  const payload = `${role}.${encodeURIComponent(user)}.${now + FULFIL_SESSION_HOURS * 3_600_000}`
  return `${payload}.${await sign(payload, env)}`
}

export async function checkFulfilSession(token: string | null | undefined, env: Env = process.env, now = Date.now()): Promise<FulfilActor | null> {
  const parts = (token ?? '').split('.')
  if (parts.length !== 4) return null
  const [role, user, exp, mac] = parts
  if ((role !== 'staff' && role !== 'admin') || !/^\d+$/.test(exp) || Number(exp) < now) return null
  if (role === 'staff' && !staffConfigured(env)) return null
  if (role === 'admin' && (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < ADMIN_PASSWORD_MIN)) return null
  if (!safeEqual(mac, await sign(`${role}.${user}.${exp}`, env))) return null
  return { role, user: decodeURIComponent(user) }
}

/**
 * Who may use the portal for this request: a portal session, or an admin session / Basic Auth (an admin is always
 * allowed in). null = nobody: the proxy sends to the login page and every action refuses.
 */
export async function fulfilAccess(fulfilCookie: string | null | undefined, adminCookie: string | null | undefined, authorization: string | null | undefined, env: Env = process.env): Promise<FulfilActor | null> {
  const portal = await checkFulfilSession(fulfilCookie, env)
  if (portal) return portal
  if ((await checkAdminRequest(adminCookie, authorization, env)) === 'ok') return { role: 'admin', user: env.ADMIN_USER || 'admin' }
  return null
}

/** The name written in the audit trail and the order's history. */
export const actorName = (a: FulfilActor) => (a.role === 'staff' ? `depozit:${a.user}` : `admin:${a.user}`)
