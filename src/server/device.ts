/**
 * Recognising a device that already gave its details on the price form, so it sees prices again without the
 * form (another browser on the same device, an in-app browser, a private window, a cleared cookie). The page
 * sends a SHA-256 of device signals (screen, time zone, language, platform); the server keeps only an HMAC of
 * that hash together with the network address (the IPv4 address, or the IPv6 /64): identical phones on other
 * networks never match, and neither the signals nor the IP are stored. Used for nothing else (no tracking, no
 * ads). A wrong match only shows a price, which is public on the main site anyway.
 */
import 'server-only'
import { createHmac } from 'node:crypto'
import { getConfig } from '@/server/config'

const HASH = /^[0-9a-f]{64}$/

/** The network address of a client: the IPv4 address, or the /64 of an IPv6 address (one home or one phone). */
export function networkPrefix(ip: string): string {
  const v4 = ip.match(/^(?:::ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i)
  if (v4) return v4[1]
  if (ip.includes(':')) return ip.toLowerCase().split(':').slice(0, 4).join(':')
  return ip
}

/** The stored key for a device hash seen from an IP, or null for a malformed hash or an unknown IP. */
export function deviceKey(hash: unknown, ip: string): string | null {
  if (typeof hash !== 'string' || !HASH.test(hash) || !ip || ip === 'unknown') return null
  const secret = process.env.DEVICE_KEY_SECRET || getConfig().cronSecret || 'biohack-device'
  return createHmac('sha256', secret).update(`${hash}|${networkPrefix(ip)}`).digest('hex')
}
