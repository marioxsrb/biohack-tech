/**
 * Where an order came from. The landing puts its slug and the campaign's UTM parameters on the
 * checkout link; the checkout sends them with the order; the server keeps only what this file
 * accepts. Nothing is stored in the browser: no cookie, no localStorage. Meta's click id (fbclid) is
 * kept with the order for campaign measurement (gclid is not collected).
 */
import type { MetaBrowser } from './meta'
import { isLandingSlug, landingBaseDomain, landingHost, type LandingSlug } from './landing-hosts'
import { ENTRY_LABEL, isEntrySource, type EntrySource } from './purchase'

export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const
export type UtmKey = (typeof UTM_KEYS)[number]

export type Attribution = {
  /** The advertising landing the visitor came through. */
  landing?: LandingSlug
  /** Where that landing was served: its own hostname in production, /lp/<slug> on the main site. */
  landingHost?: string
  landingPath?: string
  utm?: Partial<Record<UtmKey, string>>
  /** Where the order's first product was added (home, catalog, product, landing, cart offer, recovery, link). */
  entry?: EntrySource
  /** Meta click id from the ad link. */
  fbclid?: string
  /**
   * Browser signals for the Conversions API, captured by the server from the checkout request.
   * Never taken from the body (sanitizeAttribution does not copy this).
   */
  meta?: MetaBrowser
  /**
   * The visitor's marketing-cookie choice at checkout (the banner's, from the browser): the Conversions API sends
   * this order's Purchase only when it was true (META_CAPI_CONSENT). Set by the server from the request body's
   * `cookieMarketing`, never copied by sanitizeAttribution.
   */
  cookieMarketing?: boolean
}

const clean = (v: unknown) =>
  typeof v === 'string'
    ? v
        .normalize('NFC')
        .replace(/[^\p{L}\p{N} ._\-+:/|()]/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100)
    : ''

/** Query parameters worth forwarding from a landing URL to the checkout. */
export function attributionParams(search: string | URLSearchParams): URLSearchParams {
  const from = typeof search === 'string' ? new URLSearchParams(search) : search
  const out = new URLSearchParams()
  for (const k of ['lp', 'lp_host', ...UTM_KEYS]) {
    const v = clean(from.get(k))
    if (v) out.set(k, v)
  }
  // Meta's click id is longer than the other values and has its own alphabet.
  const fbclid = from.get('fbclid') ?? ''
  if (/^[\w-]{10,500}$/.test(fbclid)) out.set('fbclid', fbclid)
  return out
}

/**
 * Validates what the browser sent. Unknown keys are dropped, values are trimmed to a safe alphabet,
 * the landing must be one of ours and the host must be its real hostname (or the main site's /lp path,
 * or a local development host). Returns null when nothing usable is left.
 */
export function sanitizeAttribution(raw: unknown, mainHost?: string, base = landingBaseDomain()): Attribution | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const a: Attribution = {}
  if (isLandingSlug(r.lp)) {
    a.landing = r.lp
    const host = clean(r.lp_host).toLowerCase().replace(/:\d+$/, '')
    const own = landingHost(r.lp, base)
    if (host === own) {
      a.landingHost = own
      a.landingPath = '/'
    } else {
      const local = host === 'localhost' || host === '127.0.0.1' || host === `${r.lp}.localhost`
      a.landingHost = host && (host === mainHost || local) ? host : mainHost || undefined
      a.landingPath = host === `${r.lp}.localhost` ? '/' : `/lp/${r.lp}`
    }
  }
  const utm: Partial<Record<UtmKey, string>> = {}
  for (const k of UTM_KEYS) {
    const v = clean(r[k])
    if (v) utm[k] = v
  }
  if (Object.keys(utm).length) a.utm = utm
  if (isEntrySource(r.entry)) a.entry = r.entry
  const fbclid = typeof r.fbclid === 'string' && /^[\w-]{10,500}$/.test(r.fbclid) ? r.fbclid : ''
  if (fbclid) a.fbclid = fbclid
  return a.landing || a.utm || a.entry || a.fbclid ? a : null
}

/**
 * One line for the CRM and the admin: "landing calm · facebook / paid-social / lansare",
 * "site, pagina produsului". Plain "site" when nothing is known.
 */
export function attributionSummary(a: Attribution | null | undefined): string {
  if (!a) return 'site'
  const parts = [a.landing ? `landing ${a.landing}` : a.entry ? `site, ${ENTRY_LABEL[a.entry]}` : 'site']
  const u = a.utm
  if (u && (u.utm_source || u.utm_medium || u.utm_campaign)) parts.push([u.utm_source || '-', u.utm_medium || '-', u.utm_campaign || '-'].join(' / '))
  return parts.join(' · ').slice(0, 250)
}
