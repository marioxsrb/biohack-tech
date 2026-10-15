/**
 * HTTP Basic credentials for /admin (ADMIN_USER / ADMIN_PASSWORD). Shared by the proxy and by every
 * admin Server Action: actions are reachable as HTTP endpoints, so each one checks the credentials
 * itself instead of trusting that a request went through the proxy.
 * No Node-only APIs, so it runs in the proxy as well as in server code.
 */
export type AdminAuth = 'ok' | 'denied' | 'disabled'

/** Shorter passwords leave /admin switched off (the readiness report says why). */
export const ADMIN_PASSWORD_MIN = 10

/** Constant-time comparison that does not leak which part differs or the expected length. */
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}

export function checkAdminAuth(authorization: string | null | undefined, env: Record<string, string | undefined> = process.env): AdminAuth {
  const password = env.ADMIN_PASSWORD
  if (!password || password.length < ADMIN_PASSWORD_MIN) return 'disabled'
  const user = env.ADMIN_USER || 'admin'
  const [scheme, encoded] = (authorization ?? '').split(' ')
  if (scheme !== 'Basic' || !encoded) return 'denied'
  let decoded: string
  try {
    decoded = new TextDecoder().decode(Uint8Array.from(atob(encoded), (ch) => ch.charCodeAt(0)))
  } catch {
    return 'denied'
  }
  const i = decoded.indexOf(':')
  if (i < 0) return 'denied'
  // Evaluate both comparisons so timing does not reveal which one failed.
  const userOk = safeEqual(decoded.slice(0, i), user)
  const passOk = safeEqual(decoded.slice(i + 1), password)
  return userOk && passOk ? 'ok' : 'denied'
}

// ─── session (the login page) ────────────────────────────────────────────────

/** The admin session cookie: "<user>.<expiry ms>.<HMAC>", httpOnly, signed with a key derived from the password. */
export const ADMIN_COOKIE = 'bt_admin'
export const ADMIN_SESSION_DAYS = 7

const enc = new TextEncoder()
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')

/** The signing key: from ADMIN_SESSION_SECRET when set, else from the password (a new password ends every session). */
async function sessionKey(env: Record<string, string | undefined>) {
  const secret = env.ADMIN_SESSION_SECRET || `session:${env.ADMIN_PASSWORD ?? ''}`
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}

async function sign(payload: string, env: Record<string, string | undefined>) {
  return hex(await crypto.subtle.sign('HMAC', await sessionKey(env), enc.encode(payload)))
}

/** Checks a user name and password typed on the login page (same rules as Basic Auth). */
export function checkAdminCredentials(user: string, password: string, env: Record<string, string | undefined> = process.env): AdminAuth {
  const expected = env.ADMIN_PASSWORD
  if (!expected || expected.length < ADMIN_PASSWORD_MIN) return 'disabled'
  const userOk = safeEqual(user, env.ADMIN_USER || 'admin')
  const passOk = safeEqual(password, expected)
  return userOk && passOk ? 'ok' : 'denied'
}

export async function createAdminSession(user: string, env: Record<string, string | undefined> = process.env, now = Date.now()) {
  const payload = `${encodeURIComponent(user)}.${now + ADMIN_SESSION_DAYS * 86_400_000}`
  return `${payload}.${await sign(payload, env)}`
}

/** A valid, unexpired session cookie value → 'ok'. */
export async function checkAdminSession(token: string | null | undefined, env: Record<string, string | undefined> = process.env, now = Date.now()): Promise<AdminAuth> {
  const password = env.ADMIN_PASSWORD
  if (!password || password.length < ADMIN_PASSWORD_MIN) return 'disabled'
  const parts = (token ?? '').split('.')
  if (parts.length !== 3) return 'denied'
  const [user, exp, mac] = parts
  if (!/^\d+$/.test(exp) || Number(exp) < now) return 'denied'
  if (!safeEqual(decodeURIComponent(user), env.ADMIN_USER || 'admin')) return 'denied'
  return safeEqual(mac, await sign(`${user}.${exp}`, env)) ? 'ok' : 'denied'
}

/** The login session, or (for scripts) Basic Auth: either one lets a request into /admin. */
export async function checkAdminRequest(cookie: string | null | undefined, authorization: string | null | undefined, env: Record<string, string | undefined> = process.env): Promise<AdminAuth> {
  const session = await checkAdminSession(cookie, env)
  if (session !== 'denied') return session
  return checkAdminAuth(authorization, env)
}
