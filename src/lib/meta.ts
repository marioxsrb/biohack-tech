/**
 * Meta (Facebook) measurement shared by the browser pixel and the Conversions API.
 * Amounts here are lei (RON), never bani. The pixel id is public; the access token is not in this file.
 */
import { landingBaseDomain } from './landing-hosts'

/** Biohack Tech's live dataset. The previous id 826932839766824 is blocked by Meta traffic permissions. */
export const META_PIXEL_ID = '967887562483664'
export const RETIRED_META_PIXEL_ID = '826932839766824'

/** The pixel that should receive events. A stale override of the retired id is ignored. */
export function activeMetaPixelId(override = process.env.NEXT_PUBLIC_META_PIXEL_ID): string {
  const id = override?.trim()
  if (id && id !== RETIRED_META_PIXEL_ID && /^\d{8,20}$/.test(id)) return id
  return META_PIXEL_ID
}

/** Order total in lei. `minor` is bani (or cents of the order's currency); `fxRate` is lei per unit of that currency (1 for lei). */
export function purchaseLei(minor: number, fxRate = 1): number {
  if (!Number.isFinite(minor) || !Number.isFinite(fxRate) || fxRate <= 0) return 0
  return Math.round(minor * fxRate) / 100
}

/**
 * Which tools still need the purchase. A previous report to Google Analytics must not count as a Meta Purchase:
 * marketing consent often arrives later (the cookie banner on the order page), and that event is the one Meta
 * optimizes on. `legacy` is the old single key that already sent both.
 */
export function purchaseChannels(s: {
  paid: boolean
  legacy: boolean
  gaSent: boolean
  metaSent: boolean
  analytics: boolean
  marketing: boolean
  ga4: boolean
  meta: boolean
}): { ga4: boolean; meta: boolean } {
  if (s.legacy) return { ga4: false, meta: false }
  return {
    ga4: s.analytics && s.ga4 && !s.gaSent,
    meta: s.paid && s.marketing && s.meta && !s.metaSent,
  }
}

/** Browser signals stored with the order so the Conversions API can match the pixel's Purchase. */
export type MetaBrowser = {
  fbp?: string
  fbc?: string
  ip?: string
  ua?: string
  host?: string
}

const FBP = /^fb\.\d+\.\d+\.[\w-]{1,80}$/
const FBC = /^fb\.\d+\.\d+\.[\w-]{1,500}$/

function cookieValue(header: string, name: string): string {
  const m = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  if (!m) return ''
  try {
    return decodeURIComponent(m[1].trim())
  } catch {
    return ''
  }
}

/** A host of this store (apex, a landing, or the international site), or undefined. */
export function storeHost(hostHeader: string | null | undefined, siteHost: string, base = landingBaseDomain()): string | undefined {
  if (!hostHeader) return
  const host = hostHeader.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost')) return
  const apex = siteHost.toLowerCase().replace(/:\d+$/, '')
  if (host === apex || host === `www.${apex}` || host === base || host.endsWith(`.${base}`)) return host
  return
}

/**
 * Reads `_fbp` / `_fbc` (and builds `_fbc` from `fbclid` when the cookie is missing), plus IP, user agent and host.
 * Returns null when there is no browser signal: a test request with only an IP must not change stored attribution.
 */
export function metaBrowser(
  headers: { get(name: string): string | null },
  opts: { fbclid?: string; siteHost: string; now?: number },
): MetaBrowser | null {
  const cookies = headers.get('cookie') ?? ''
  const fbp = cookieValue(cookies, '_fbp')
  let fbc = cookieValue(cookies, '_fbc')
  const fbclid = opts.fbclid ?? ''
  if (!FBC.test(fbc) && /^[\w-]{10,500}$/.test(fbclid)) fbc = `fb.1.${opts.now ?? Date.now()}.${fbclid}`
  const ua = (headers.get('user-agent') ?? '').trim().slice(0, 512)
  const ipRaw = (headers.get('x-forwarded-for')?.split(',')[0] ?? headers.get('x-real-ip') ?? '').trim()
  const ip = ipRaw && ipRaw !== 'unknown' && ipRaw.length <= 64 ? ipRaw : ''
  const host = storeHost(headers.get('host') ?? headers.get('x-forwarded-host'), opts.siteHost)
  const out: MetaBrowser = {}
  if (FBP.test(fbp)) out.fbp = fbp
  if (FBC.test(fbc)) out.fbc = fbc
  if (ua) out.ua = ua
  if (ip) out.ip = ip
  if (host) out.host = host
  if (!out.fbp && !out.fbc && !out.ua) return null
  return out
}

/** Digits with country code, no plus. Romanian numbers that start with 0 become 40…; anything else keeps its digits. */
export function metaPhoneDigits(raw: string | null | undefined): string | null {
  if (!raw) return null
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  else if (d.startsWith('0')) d = `40${d.slice(1)}`
  else if (d.length === 9 && /^[237]/.test(d)) d = `40${d}`
  if (d.length < 8 || d.length > 15) return null
  return d
}

export function metaEmail(raw: string | null | undefined): string | null {
  const email = raw?.trim().toLowerCase() ?? ''
  return email.includes('@') ? email : null
}
