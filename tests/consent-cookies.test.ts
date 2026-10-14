/**
 * Cookie consent in the browser: which optional scripts may start, and whether analytics events leave
 * the page. A minimal fake window/document stands in for the browser.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ALL, COOKIE_POLICY_VERSION, CONSENT_STORAGE_KEY, NONE, actionFor, nextConsent, parseConsent, withdrawn } from '@/lib/consent/cookies'
import type { Vendor } from '@/lib/consent/vendors'

const vendors: Vendor[] = [
  { id: 'ga4', name: 'GA4', category: 'analytics', key: 'G-TEST', cookies: [/^_ga/], purpose: '' },
  { id: 'clarity', name: 'Clarity', category: 'analytics', key: 'clar1', cookies: [/^_clck$/], excludePaths: /^\/checkout/, purpose: '' },
  { id: 'meta', name: 'Meta', category: 'marketing', key: '123', cookies: [/^_fbp$/], purpose: '' },
]

type FakeScript = { async: boolean; src: string; dataset: Record<string, string> }
let scripts: FakeScript[]
let storage: Map<string, string>
let cookies: string[]

function fakeBrowser() {
  scripts = []
  storage = new Map()
  cookies = ['_ga=1', '_fbp=2', 'other=3']
  const win: Record<string, unknown> = {
    localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v) },
  }
  vi.stubGlobal('window', win)
  vi.stubGlobal('location', { hostname: 'biohack-tech.ro', pathname: '/' })
  vi.stubGlobal('document', {
    createElement: () => ({ async: false, src: '', dataset: {} }),
    head: { appendChild: (s: FakeScript) => void scripts.push(s) },
    get cookie() {
      return cookies.join('; ')
    },
    set cookie(v: string) {
      if (/Max-Age=0/.test(v)) cookies = cookies.filter((c) => c.split('=')[0] !== v.split('=')[0])
    },
  })
  return win
}

/** Fresh modules per test: the loader and the store keep per-page state. */
async function load() {
  vi.resetModules()
  const v = await import('@/lib/consent/vendors')
  const { consentStore } = await import('@/lib/consent/store')
  const { track } = await import('@/lib/analytics')
  return { ...v, consentStore, track }
}

const item = { item_id: 'balance-wave', item_name: 'NEUROS Calm', price: 6380, quantity: 1 }

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('stored choice', () => {
  it('counts only when well-formed, for the current policy version, and less than 12 months old', () => {
    const c = nextConsent(null, { analytics: true, marketing: false }, 'id-1', new Date('2026-09-29T10:00:00Z'))
    expect(c).toMatchObject({ id: 'id-1', version: COOKIE_POLICY_VERSION, analytics: true, marketing: false, at: '2026-09-29T10:00:00.000Z' })
    expect(parseConsent(JSON.stringify(c), Date.parse('2026-10-01'))).toEqual(c)
    expect(parseConsent(JSON.stringify(c), Date.parse('2027-10-01'))).toBeNull()
    expect(parseConsent(JSON.stringify({ ...c, version: '2025-01-01' }))).toBeNull()
    expect(parseConsent('{bad json')).toBeNull()
    expect(parseConsent(JSON.stringify({ ...c, analytics: 'yes' }))).toBeNull()
  })

  it('keeps the first decision time and the id when the choice changes', () => {
    const first = nextConsent(null, ALL, 'id-1', new Date('2026-09-29T10:00:00Z'))
    const later = nextConsent(first, NONE, 'id-2', new Date('2026-10-05T10:00:00Z'))
    expect(later).toMatchObject({ id: 'id-1', at: first.at, updatedAt: '2026-10-05T10:00:00.000Z', analytics: false, marketing: false })
    expect(withdrawn(first, NONE)).toEqual(['analytics', 'marketing'])
    expect(withdrawn(null, NONE)).toEqual([])
    expect([actionFor(ALL), actionFor(NONE), actionFor({ analytics: true, marketing: false })]).toEqual(['accept_all', 'reject_all', 'custom'])
  })
})

describe('script blocking', () => {
  it('before any choice: nothing optional loads and no event leaves the page', async () => {
    const win = fakeBrowser()
    const { vendorsToLoad, track } = await load()
    expect(vendorsToLoad(null, '/', vendors)).toEqual([])
    track('view_item', { value: 638000, items: [item] })
    expect(win.dataLayer).toBeUndefined()
    expect(scripts).toEqual([])
  })

  it('rejects optional cookies: no analytics, no marketing, nothing queued for later', async () => {
    const win = fakeBrowser()
    const { vendorsToLoad, consentStore, track } = await load()
    consentStore.save(NONE)
    expect(vendorsToLoad(NONE, '/', vendors)).toEqual([])
    track('purchase', { value: 638000, items: [item], transaction_id: 'BHT-1' })
    expect(win.dataLayer).toBeUndefined()
    expect(win.fbq).toBeUndefined()
    expect(JSON.parse(storage.get(CONSENT_STORAGE_KEY)!)).toMatchObject({ analytics: false, marketing: false, version: COOKIE_POLICY_VERSION })
  })

  it('accepts analytics only: GA4 and Clarity may start, Meta may not; events reach GA4 only', async () => {
    const win = fakeBrowser()
    const { vendorsToLoad, startVendor, consentStore, track } = await load()
    const choice = { analytics: true, marketing: false }
    consentStore.save(choice)
    const allowed = vendorsToLoad(choice, '/', vendors)
    expect(allowed.map((v) => v.id)).toEqual(['ga4', 'clarity'])
    allowed.forEach(startVendor)
    expect(scripts.map((s) => s.src)).toEqual(['https://www.googletagmanager.com/gtag/js?id=G-TEST', 'https://www.clarity.ms/tag/clar1'])
    track('add_to_cart', { value: 638000, items: [item] })
    const events = (win.dataLayer as IArguments[]).map((a) => [...a])
    expect(events).toContainEqual(['event', 'add_to_cart', expect.objectContaining({ currency: 'RON', value: 6380 })])
    // GA4 runs with advertising storage denied.
    expect(events).toContainEqual(['consent', 'default', expect.objectContaining({ analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied' })])
    expect(win.fbq).toBeUndefined()
  })

  it('accepts marketing only: only the marketing tool starts; no personal data in events', async () => {
    const win = fakeBrowser()
    const { vendorsToLoad, startVendor, consentStore, track } = await load()
    const choice = { analytics: false, marketing: true }
    consentStore.save(choice)
    const allowed = vendorsToLoad(choice, '/', vendors)
    expect(allowed.map((v) => v.id)).toEqual(['meta'])
    allowed.forEach(startVendor)
    expect(scripts.map((s) => s.src)).toEqual(['https://connect.facebook.net/en_US/fbevents.js'])
    track('purchase', { value: 638000, items: [item], transaction_id: 'BHT-1' })
    const queue = (win.fbq as { queue: unknown[][] }).queue
    expect(queue).toContainEqual(['set', 'autoConfig', false, '123'])
    expect(queue).toContainEqual(['track', 'Purchase', expect.objectContaining({ value: 6380, content_ids: ['balance-wave'] }), { eventID: 'BHT-1' }])
    expect(JSON.stringify(queue)).not.toMatch(/@|Popescu|0722/)
    expect(win.dataLayer).toBeUndefined()
  })

  it('one Meta PageView per page: not for a URL clean-up on the same page, never before consent', async () => {
    const win = fakeBrowser()
    const { startVendor, pageView } = await load()
    pageView()
    expect(win.fbq).toBeUndefined()
    startVendor(vendors[2])
    const f = win.fbq as { disablePushState?: boolean; allowDuplicatePageViews?: boolean }
    expect([f.disablePushState, f.allowDuplicatePageViews]).toEqual([true, true])
    pageView()
    ;(location as { pathname: string }).pathname = '/checkout'
    pageView()
    pageView()
    const views = (win.fbq as { queue: unknown[][] }).queue.filter((c) => c[1] === 'PageView')
    expect(views).toHaveLength(2)
  })

  it('session recording never runs on checkout and order pages, even with consent', async () => {
    fakeBrowser()
    const { vendorsToLoad } = await load()
    expect(vendorsToLoad(ALL, '/checkout', vendors).map((v) => v.id)).toEqual(['ga4', 'meta'])
  })

  it('only configured tools can load (no id, no script)', async () => {
    fakeBrowser()
    const { vendorsToLoad } = await load()
    expect(vendorsToLoad(ALL, '/', vendors.map((v) => (v.id === 'meta' ? { ...v, key: undefined } : v))).map((v) => v.id)).toEqual(['ga4', 'clarity'])
  })

  it('withdrawal removes the cookies of the withdrawn category only', async () => {
    fakeBrowser()
    const { clearVendorCookies } = await load()
    clearVendorCookies(['marketing'], vendors)
    expect(cookies).toEqual(['_ga=1', 'other=3'])
    clearVendorCookies(['analytics'], vendors)
    expect(cookies).toEqual(['other=3'])
  })
})
