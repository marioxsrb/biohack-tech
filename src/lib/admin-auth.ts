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
