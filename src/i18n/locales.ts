/**
 * The two languages of the store. Romanian is the default and keeps the plain URLs (/products/calm);
 * English lives under /en (/en/products/calm). The proxy maps plain URLs to the internal /ro segment,
 * so visitors and search engines never see /ro. Kept dependency-free: the proxy imports it.
 */
export const locales = ['ro', 'en'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'ro'

export const isLocale = (v: unknown): v is Locale => typeof v === 'string' && (locales as readonly string[]).includes(v)

/** BCP 47 tag for <html lang>, Open Graph and Intl. */
export const localeTag: Record<Locale, string> = { ro: 'ro-RO', en: 'en-GB' }

/** Public URL of an internal path in a language: '/products' → '/products' (ro) or '/en/products' (en). */
export function localePath(locale: Locale, path: string): string {
  if (locale === defaultLocale || !path.startsWith('/') || path.startsWith('//')) return path
  if (path === '/' || path.startsWith('/?') || path.startsWith('/#')) return `/en${path.slice(1)}`
  return `/en${path}`
}

/** The language of a public pathname and the path without its prefix: '/en/cart' → { en, '/cart' }. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const m = /^\/(en|ro)(?=\/|$)/.exec(pathname)
  if (!m) return { locale: defaultLocale, path: pathname || '/' }
  return { locale: m[1] as Locale, path: pathname.slice(m[0].length) || '/' }
}
