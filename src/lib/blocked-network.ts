import { BLOCKED } from '@/config/risk-blocklist'

/**
 * The networks of config/risk-blocklist.ts, checked in proxy.ts before any API answers. The address is compared as the
 * same keyed hash server/risk.ts ipKey stores (HMAC-SHA256 of the IP, first 32 hex characters), never as the IP itself.
 * Web Crypto, so it runs wherever the proxy runs.
 */
export async function networkKey(ip: string | null | undefined, secret = process.env.ADMIN_SESSION_SECRET || process.env.CRON_SECRET || 'bt-risk') {
  if (!ip || ip === 'unknown') return null
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(`risk:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(ip.trim())))
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

export async function isBlockedNetwork(ip: string | null | undefined) {
  if (!BLOCKED.ipKeys.length) return false
  const k = await networkKey(ip)
  return !!k && BLOCKED.ipKeys.includes(k)
}

/** What a blocked network may still reach: the payment provider, the admin, the team apps and the scheduler. */
export const OPEN_TO_BLOCKED = /^\/api\/(webhooks|admin|app|jobs|fulfillment|health)(\/|$)/
