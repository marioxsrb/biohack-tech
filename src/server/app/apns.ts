/**
 * Apple Push Notification service over HTTP/2 with token authentication (a .p8 key, ES256 JWT, reused for 50
 * minutes as Apple asks). One connection per environment (sandbox for Xcode builds, production for TestFlight),
 * kept open between sends for the lowest latency. The result says whether the token is dead (remove it), the
 * failure is temporary (retry) or it was delivered to Apple.
 */
import 'server-only'
import { createPrivateKey, sign } from 'node:crypto'
import http2 from 'node:http2'
import type { Config } from '@/server/config'

export type ApnsConfig = NonNullable<Config['apns']>
export type ApnsEnv = 'sandbox' | 'production'
export type ApnsResult = { ok: true; apnsId: string | null } | { ok: false; status: number; reason: string; dead: boolean; retry: boolean }

const HOSTS: Record<ApnsEnv, string> = { sandbox: 'https://api.sandbox.push.apple.com', production: 'https://api.push.apple.com' }
/** Reasons that mean this token will never work again for this app: the device is removed. */
const DEAD = new Set(['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic', 'ExpiredToken'])

let jwtCache: { key: string; at: number; token: string } | null = null
const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url')

export function apnsJwt(c: ApnsConfig, now = Date.now()) {
  const cacheKey = `${c.teamId}:${c.keyId}`
  if (jwtCache && jwtCache.key === cacheKey && now - jwtCache.at < 50 * 60_000) return jwtCache.token
  const head = b64u(JSON.stringify({ alg: 'ES256', kid: c.keyId }))
  const body = b64u(JSON.stringify({ iss: c.teamId, iat: Math.floor(now / 1000) }))
  const sig = sign('sha256', Buffer.from(`${head}.${body}`), { key: createPrivateKey(c.privateKey), dsaEncoding: 'ieee-p1363' })
  const token = `${head}.${body}.${b64u(sig)}`
  jwtCache = { key: cacheKey, at: now, token }
  return token
}
export const resetApnsJwt = () => void (jwtCache = null)

const sessions = new Map<ApnsEnv, http2.ClientHttp2Session>()

function session(env: ApnsEnv) {
  const s = sessions.get(env)
  if (s && !s.closed && !s.destroyed) return s
  const fresh = http2.connect(HOSTS[env])
  fresh.on('error', () => sessions.delete(env))
  fresh.on('close', () => sessions.delete(env))
  fresh.setTimeout(5 * 60_000, () => fresh.close())
  sessions.set(env, fresh)
  return fresh
}

export type ApnsMessage = {
  token: string
  environment: ApnsEnv
  payload: Record<string, unknown>
  /** Same id for a retry of the same notification (Apple shows it once). */
  collapseId?: string
  priority?: 10 | 5
}

/** Sends one notification. Never throws: the result tells the caller what to do. */
export function sendApns(c: ApnsConfig, m: ApnsMessage, timeoutMs = 10_000): Promise<ApnsResult> {
  return new Promise((resolve) => {
    let done = false
    const finish = (r: ApnsResult) => {
      if (!done) {
        done = true
        resolve(r)
      }
    }
    try {
      const req = session(m.environment).request({
        ':method': 'POST',
        ':path': `/3/device/${m.token}`,
        authorization: `bearer ${apnsJwt(c)}`,
        'apns-topic': c.bundleId,
        'apns-push-type': 'alert',
        'apns-priority': String(m.priority ?? 10),
        'apns-expiration': String(Math.floor(Date.now() / 1000) + 24 * 3600),
        ...(m.collapseId && { 'apns-collapse-id': m.collapseId.slice(0, 64) }),
        'content-type': 'application/json',
      })
      let status = 0
      let apnsId: string | null = null
      let body = ''
      req.setTimeout(timeoutMs, () => {
        req.close()
        finish({ ok: false, status: 0, reason: 'timeout', dead: false, retry: true })
      })
      req.on('response', (h) => {
        status = Number(h[':status'] ?? 0)
        apnsId = (h['apns-id'] as string) ?? null
      })
      req.on('data', (d) => (body += d))
      req.on('end', () => {
        if (status === 200) return finish({ ok: true, apnsId })
        let reason = `HTTP ${status}`
        try {
          reason = (JSON.parse(body) as { reason?: string }).reason ?? reason
        } catch {}
        finish({ ok: false, status, reason, dead: status === 410 || DEAD.has(reason), retry: status === 429 || status >= 500 || status === 0 })
      })
      req.on('error', (e) => finish({ ok: false, status: 0, reason: e.message.slice(0, 120), dead: false, retry: true }))
      req.end(JSON.stringify(m.payload))
    } catch (e) {
      finish({ ok: false, status: 0, reason: e instanceof Error ? e.message.slice(0, 120) : 'apns error', dead: false, retry: true })
    }
  })
}
