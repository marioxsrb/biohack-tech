/**
 * The two storefronts served by this app: biohack-tech.ro (Romanian by default, lei, AI chat and AI calls) and the
 * international biohack-tech.net (English by default, euro/dollar, no chat, no AI calls: an abandoned cart gets
 * an email instead). Locally net.localhost is the international one. Kept dependency-free: the proxy imports it.
 */
export type SiteId = 'ro' | 'net'

/** The international hostnames: biohack-tech.net and www.biohack-tech.net (INTL_HOSTS adds more, comma separated). */
export function isIntlHost(hostHeader: string | null | undefined, dev = process.env.NODE_ENV !== 'production'): boolean {
  if (!hostHeader) return false
  const host = hostHeader.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '')
  if (host === 'biohack-tech.net' || host === 'www.biohack-tech.net') return true
  if (dev && host === 'net.localhost') return true
  return (process.env.INTL_HOSTS ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean).includes(host)
}

export const siteForHost = (host: string | null | undefined): SiteId => (isIntlHost(host) ? 'net' : 'ro')

/** The public origin of each site (emails, order links). */
export const siteOrigin = (s: SiteId, roUrl: string) => (s === 'net' ? (process.env.INTL_SITE_URL?.trim() || 'https://www.biohack-tech.net').replace(/\/$/, '') : roUrl.replace(/\/$/, ''))

/** In the browser: is this page on the international site? */
export const onIntlSite = () => typeof location !== 'undefined' && isIntlHost(location.host, !/\.(net|ro)$/.test(location.hostname))
