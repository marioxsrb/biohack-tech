/**
 * Optional third-party tools. None is in the page's HTML: a tool's script is added to the page only
 * after the visitor allows its category, and only if its id is configured (NEXT_PUBLIC_*). With no ids
 * set, the site loads nothing optional and asks nothing.
 *
 * To add a tool: one entry here (category, cookies it sets, how to start it) and one line in the
 * cookie policy (src/content/legal.ts). A tool that cannot say which category it belongs to (for
 * example a tag manager that loads other tags) does not go here.
 */
import { activeMetaPixelId, META_PIXEL_ID } from '@/lib/meta'
import type { ConsentChoice, OptionalCategory } from './cookies'

export { META_PIXEL_ID }

export type VendorId = 'ga4' | 'clarity' | 'meta'

export type Vendor = {
  id: VendorId
  name: string
  category: OptionalCategory
  /** Configured account id; the tool is off without it. */
  key: string | undefined
  /** First-party cookies it sets, removed when consent is withdrawn. */
  cookies: RegExp[]
  /** Pages where it never runs (session recording is kept away from forms with personal data). */
  excludePaths?: RegExp
  purpose: string
}

const PRIVATE_PAGES = /^\/(checkout|comanda|reluare|dezabonare|retragere|admin)(\/|$)/

export const VENDORS: Vendor[] = [
  {
    id: 'ga4',
    name: 'Google Analytics 4',
    category: 'analytics',
    key: process.env.NEXT_PUBLIC_GA4_ID,
    cookies: [/^_ga$/, /^_ga_/, /^_gid$/],
    purpose: 'Statistici despre vizite și comenzi, fără date de contact.',
  },
  {
    id: 'clarity',
    name: 'Microsoft Clarity',
    category: 'analytics',
    key: process.env.NEXT_PUBLIC_CLARITY_ID,
    cookies: [/^_clck$/, /^_clsk$/],
    excludePaths: PRIVATE_PAGES,
    purpose: 'Cum sunt folosite paginile (clicuri, derulare), ca să le facem mai clare.',
  },
  {
    id: 'meta',
    name: 'Meta Pixel',
    category: 'marketing',
    // On only with META_PIXEL_ENABLED=true (inlined at build). The id is public; the retired pixel is never used.
    // No excludePaths: the same pixel runs on the main site, calm/focus/amber, and acces (ConsentManager is in the root layout).
    key: process.env.NEXT_PUBLIC_META_PIXEL_ENABLED === 'true' ? activeMetaPixelId() : undefined,
    cookies: [/^_fbp$/, /^_fbc$/],
    purpose: 'Măsurarea și afișarea reclamelor Biohack Tech pe Facebook și Instagram.',
  },
]

export const configuredVendors = (list: Vendor[] = VENDORS) => list.filter((v) => !!v.key)

/** Which tools may run, for a choice and a page. No choice means none. */
export function vendorsToLoad(choice: ConsentChoice | null, path: string, list: Vendor[] = VENDORS): Vendor[] {
  if (!choice) return []
  return configuredVendors(list).filter((v) => choice[v.category] && !v.excludePaths?.test(path))
}

type W = Window & {
  dataLayer?: unknown[]
  gtag?: (...a: unknown[]) => void
  fbq?: ((...a: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; callMethod?: (...a: unknown[]) => void; push?: unknown; disablePushState?: boolean; allowDuplicatePageViews?: boolean }
  _fbq?: unknown
  clarity?: ((...a: unknown[]) => void) & { q?: unknown[] }
}

const loaded = new Set<VendorId>()
export const isLoaded = (id: VendorId) => loaded.has(id)
export const isConfigured = (id: VendorId, list: Vendor[] = VENDORS) => loaded.has(id) || !!list.find((v) => v.id === id)?.key

/**
 * Runs `fn` once the tool has started on this page: at once if it already runs, otherwise when the consent
 * manager starts it (its effect runs after the page's own, so a page's first event would otherwise be lost).
 * Callers check consent first: nothing waits here for a tool the visitor did not allow.
 */
const waiting = new Map<VendorId, (() => void)[]>()
export function whenLoaded(id: VendorId, fn: () => void) {
  if (loaded.has(id)) return fn()
  waiting.set(id, [...(waiting.get(id) ?? []), fn])
}

/**
 * Inserts a vendor script after consent. The call is queued for idle (the same moment as next/script
 * `lazyOnload`) so fbevents.js, gtag and Clarity do not run during hydration. The stubs and the queued
 * events, including Meta PageView, are already in place: the script flushes them when it arrives.
 * Without requestIdleCallback the script is inserted immediately, which is what the unit tests see.
 */
function addScript(src: string) {
  const insert = () => {
    const s = document.createElement('script')
    s.async = true
    s.src = src
    s.dataset.consent = 'granted'
    document.head.appendChild(s)
  }
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback
  if (typeof ric === 'function') ric(insert, { timeout: 1500 })
  else insert()
}

/** Starts a tool once per page load. Called only by the consent manager, after consent. */
export function startVendor(v: Vendor) {
  if (loaded.has(v.id) || !v.key) return
  loaded.add(v.id)
  const w = window as W
  if (v.id === 'ga4') {
    w.dataLayer = w.dataLayer ?? []
    w.gtag = function gtag() {
      // gtag.js reads the `arguments` object, not an array.
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments)
    }
    // Analytics only: advertising storage and signals stay denied.
    w.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })
    w.gtag('js', new Date())
    w.gtag('config', v.key)
    addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(v.key)}`)
  }
  if (v.id === 'clarity') {
    const q = ((...a: unknown[]) => void (q.q = q.q ?? []).push(a)) as NonNullable<W['clarity']>
    w.clarity = w.clarity ?? q
    addScript(`https://www.clarity.ms/tag/${encodeURIComponent(v.key)}`)
  }
  if (v.id === 'meta') {
    if (!w.fbq) {
      const f = ((...a: unknown[]) => (f.callMethod ? f.callMethod(...a) : f.queue!.push(a))) as NonNullable<W['fbq']>
      f.push = f
      f.loaded = true
      f.version = '2.0'
      f.queue = []
      w.fbq = f
      w._fbq = f
    }
    // One PageView per page, sent by `pageView` below: Meta's own history tracking also counted URL
    // clean-ups (the checkout replacing its `item` parameters), two PageViews for one page. Without its
    // history tracking, fbevents drops every PageView after the first unless duplicates are allowed;
    // `pageView` sends at most one per pathname.
    w.fbq.disablePushState = true
    w.fbq.allowDuplicatePageViews = true
    metaPage = location.pathname
    // No automatic event or form-field collection: only the events the site sends, without personal data.
    w.fbq('set', 'autoConfig', false, v.key)
    w.fbq('init', v.key)
    w.fbq('track', 'PageView')
    addScript('https://connect.facebook.net/en_US/fbevents.js')
  }
  for (const fn of waiting.get(v.id) ?? []) fn()
  waiting.delete(v.id)
}

let metaPage: string | undefined

/** A client-side navigation to another page: a PageView, if the pixel already runs on this page load. */
export function pageView() {
  if (!loaded.has('meta') || location.pathname === metaPage) return
  metaPage = location.pathname
  ;(window as W).fbq?.('track', 'PageView')
}

/** Removes the first-party cookies of tools whose consent was withdrawn. */
export function clearVendorCookies(categories: OptionalCategory[], list: Vendor[] = VENDORS) {
  const patterns = list.filter((v) => categories.includes(v.category)).flatMap((v) => v.cookies)
  if (!patterns.length) return
  const host = location.hostname
  const domains = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`]
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0].trim()
    if (!patterns.some((p) => p.test(name))) continue
    for (const d of domains) document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}`
  }
}
