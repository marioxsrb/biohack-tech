/**
 * Download links: `<entitlement id>.<version>.<expiry>.<channel>.<signature>`, HMAC-SHA256 with DIGITAL_LINK_SECRET.
 * The link proves nothing by itself: the endpoint still checks the entitlement, the order and the limits on every
 * download. A link cannot be guessed (random id + 256-bit signature), cannot be extended (the expiry is signed) and
 * dies when its entitlement is revoked or its version is bumped (a person regenerated the links).
 */
import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/** Where a link was given: the order page (p), an email (e), a person in /admin (a). */
export type LinkChannel = 'p' | 'e' | 'a'

/** How long each kind of link works. */
export const LINK_TTL_SECONDS: Record<LinkChannel, number> = { p: 30 * 60, e: 7 * 86_400, a: 7 * 86_400 }

const sign = (secret: string, body: string) => createHmac('sha256', secret).update(`bt-digital-v1|${body}`).digest('base64url')

export function createLink(secret: string, x: { entitlementId: string; version: number; channel: LinkChannel; now?: number }) {
  const exp = Math.floor((x.now ?? Date.now()) / 1000) + LINK_TTL_SECONDS[x.channel]
  const body = `${x.entitlementId}.${x.version}.${exp}.${x.channel}`
  return { token: `${body}.${sign(secret, body)}`, expiresAt: new Date(exp * 1000) }
}

export type LinkClaims = { entitlementId: string; version: number; expiresAt: Date; channel: LinkChannel }

const SHAPE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(\d{1,6})\.(\d{10})\.([pea])\.([A-Za-z0-9_-]{43})$/

/** The link's claims when its signature is ours, else null; `expired` when it was ours but its time is over. */
export function readLink(secret: string, token: string, now = Date.now()): { ok: true; claims: LinkClaims } | { ok: false; reason: 'invalid' | 'expired' } {
  const m = SHAPE.exec(token)
  if (!m) return { ok: false, reason: 'invalid' }
  const [, id, version, exp, channel, sig] = m
  const expected = Buffer.from(sign(secret, `${id}.${version}.${exp}.${channel}`))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: 'invalid' }
  if (Number(exp) * 1000 <= now) return { ok: false, reason: 'expired' }
  return { ok: true, claims: { entitlementId: id, version: Number(version), expiresAt: new Date(Number(exp) * 1000), channel: channel as LinkChannel } }
}

/** The public URL of a link, on the site the order was placed on. */
export const downloadUrl = (origin: string, token: string) => `${origin.replace(/\/$/, '')}/api/carte/descarca?t=${encodeURIComponent(token)}`
