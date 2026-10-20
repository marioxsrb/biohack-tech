/**
 * Advertising landings: which hostnames are ours, what each one serves, which product it sells, and
 * what campaign data survives the trip to the order.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkoutHref } from '@/components/landing/checkout-link'
import { getProduct, productHref } from '@/content/catalog'
import { landings } from '@/content/landings'
import { attributionParams, attributionSummary, sanitizeAttribution } from '@/lib/attribution'
import { DISCONTINUED_PATH, LANDING_SLUGS, landingForHost, retiredLandingRedirect, routeLanding, wwwRedirect } from '@/lib/landing-hosts'

const BASE = 'biohack-tech.ro'
const prod = (host: string) => landingForHost(host, BASE, false)

describe('landing hostnames (explicit allowlist)', () => {
  it('maps each of the three hostnames to its landing, ignoring case, port and a trailing dot', () => {
    expect(LANDING_SLUGS.map((s) => prod(`${s}.biohack-tech.ro`))).toEqual(['calm', 'focus', 'amber'])
    expect(prod('CALM.Biohack-Tech.ro:443')).toBe('calm')
    expect(prod('amber.biohack-tech.ro.')).toBe('amber')
  })

  it('the NEUROS Flow hostname is no landing: every path goes to the same path on the main site', () => {
    expect(prod('brain-flow.biohack-tech.ro')).toBeNull()
    expect(retiredLandingRedirect('brain-flow.biohack-tech.ro', 'https://biohack-tech.ro', '/?utm_source=meta', BASE, false)).toBe('https://biohack-tech.ro/?utm_source=meta')
    expect(retiredLandingRedirect('Brain-Flow.Biohack-Tech.ro.', 'https://biohack-tech.ro', '/checkout?item=brain-flow:4-zone', BASE, false)).toBe('https://biohack-tech.ro/checkout?item=brain-flow:4-zone')
    expect(retiredLandingRedirect('brain-flow.biohack-tech.ro', 'https://biohack-tech.ro', '/comanda/abc', BASE, false)).toBe('https://biohack-tech.ro/comanda/abc')
    expect(retiredLandingRedirect('brain-flow.localhost:3000', 'https://biohack-tech.ro', '/', BASE, true)).toBe('http://localhost:3000/')
    for (const h of ['calm.biohack-tech.ro', 'biohack-tech.ro', 'brain-flow.biohack-tech.ro.evil.com', 'brain-flow.localhost', null]) expect(retiredLandingRedirect(h, 'https://biohack-tech.ro', '/', BASE, false)).toBeNull()
  })

  it('NEUROS Flow pages are recognized as discontinued, other product pages are not', () => {
    for (const p of ['/products/brain-flow', '/products/brain-flow/', '/lp/brain-flow', '/lp/brain-flow/prezentare', '/prezentare/brain-flow']) expect(DISCONTINUED_PATH.test(p)).toBe(true)
    for (const p of ['/products/calm', '/products', '/lp/amber', '/products/brain-flowx']) expect(DISCONTINUED_PATH.test(p)).toBe(false)
  })

  it('treats the main site, unknown and forged hosts as the main site', () => {
    for (const h of [
      'biohack-tech.ro',
      'www.biohack-tech.ro',
      'calm.biohack-tech.ro.evil.com',
      'evil-calm.biohack-tech.ro',
      'x.calm.biohack-tech.ro',
      'calm.biohack-tech.com',
      'calm.localhost',
      '',
      'calm',
    ]) {
      expect(prod(h)).toBeNull()
    }
    expect(landingForHost(null, BASE, false)).toBeNull()
  })

  it('accepts <slug>.localhost only outside production', () => {
    expect(landingForHost('amber.localhost:3000', BASE, true)).toBe('amber')
    expect(landingForHost('amber.localhost:3000', BASE, false)).toBeNull()
  })
})

describe('what a landing hostname serves', () => {
  it('its landing at "/", the whole purchase path on the same origin, and a redirect to the main site for the rest', () => {
    expect(routeLanding('focus', '/')).toEqual({ action: 'rewrite', path: '/products/focus' })
    expect(routeLanding('focus', '/lp/focus')).toEqual({ action: 'redirect', path: '/' })
    // The cart lives in this origin's storage: cart, checkout and the product pages the cart links to stay here.
    for (const p of ['/checkout', '/cart', '/products', '/products/amber', '/comanda/abc_DEF-123', '/api/checkout', '/api/consent', '/api/contact', '/_next/static/x.js', '/politica-retur', '/retragere', '/retragere/confirmare', '/terms-of-service']) {
      expect(routeLanding('focus', p)).toEqual({ action: 'next' })
    }
    for (const p of ['/admin', '/admin/orders/1', '/products/focus/extra', '/lp/calm', '/api/jobs/run', '/api/webhooks/stripe', '/about-us']) {
      expect(routeLanding('focus', p)).toEqual({ action: 'redirect', path: p })
    }
  })
})

describe('www → apex', () => {
  it('redirects www to the main host, keeps path and query; leaves every other host alone', () => {
    expect(wwwRedirect('www.biohack-tech.ro', 'https://biohack-tech.ro', '/products/amber?utm_source=x')).toBe('https://biohack-tech.ro/products/amber?utm_source=x')
    expect(wwwRedirect('WWW.biohack-tech.ro:443', 'https://biohack-tech.ro', '/')).toBe('https://biohack-tech.ro/')
    for (const h of ['biohack-tech.ro', 'calm.biohack-tech.ro', 'www.evil.com', 'www.biohack-tech.ro.evil.com', null]) expect(wwwRedirect(h, 'https://biohack-tech.ro', '/')).toBeNull()
  })
})

describe('the three landings', () => {
  it('one per product, same slug as the product page, not listed anywhere', () => {
    expect(landings.map((l) => [l.slug, l.productId])).toEqual([
      ['calm', 'balance-wave'],
      ['focus', 'brainlink-pro'],
      ['amber', 'ochelari-biohack'],
    ])
    for (const l of landings) expect(productHref(getProduct(l.productId)!)).toBe(`/products/${l.slug}`)
  })

  it('copy: no dash punctuation, no invented social proof, urgency or health promises', () => {
    // The pages' own copy (sections) and the product FAQs.
    const dir = join(process.cwd(), 'src/components/landing')
    const sources = [...readdirSync(join(dir, 'pages')).map((f) => join(dir, 'pages', f)), join(dir, 'kit.tsx'), join(dir, 'LandingOffer.tsx'), join(dir, 'AmberSelector.tsx')]
    const text = sources.map((f) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')).join('\n') + JSON.stringify(landings.map((l) => [l.meta, l.faqs]))
    expect(text).not.toMatch(/[—–]/)
    expect(text).not.toMatch(/clienți mulțumiți|recenzi|★|stele|stoc limitat|ultimele bucăți|doar azi|ofertă expir|vindec|garantat|tratează|anxiet|depresi|insomni|studii arată|dovedit/i)
    expect(text).not.toMatch(/Brain Flow|NEUROS Flow/)
  })

  it('product pages: no unverifiable "users say" statements', () => {
    const src = readFileSync(join(process.cwd(), 'src/content/product-content.ts'), 'utf8')
    expect(src).not.toMatch(/utilizatori (spun|simt)|clienții spun|oamenii spun/i)
  })

  it('the checkout link carries ids and campaign parameters only', () => {
    const href = checkoutHref('amber', { productId: 'ochelari-biohack', variantId: 'patrat-maro' }, {
      search: '?utm_source=facebook&utm_medium=paid&utm_campaign=lansare&fbclid=abc&email=ana@x.ro&price=1',
      host: 'amber.biohack-tech.ro',
    })
    const q = new URL(href, 'https://x').searchParams
    expect(href.startsWith('/checkout?')).toBe(true)
    expect(Object.fromEntries(q)).toEqual({
      utm_source: 'facebook',
      utm_medium: 'paid',
      utm_campaign: 'lansare',
      item: 'ochelari-biohack:patrat-maro',
      lp: 'amber',
      lp_host: 'amber.biohack-tech.ro',
    })
  })
})

describe('attribution kept with the order', () => {
  const main = 'biohack-tech.ro'
  it('keeps a known landing on its real hostname and the UTM values, cleaned', () => {
    const a = sanitizeAttribution({ lp: 'calm', lp_host: 'calm.biohack-tech.ro', utm_source: ' Facebook ', utm_campaign: 'toamna<script>', other: 'x' }, main, BASE)
    expect(a).toEqual({ landing: 'calm', landingHost: 'calm.biohack-tech.ro', landingPath: '/', utm: { utm_source: 'Facebook', utm_campaign: 'toamnascript' } })
    expect(attributionSummary(a)).toBe('landing calm · Facebook / - / toamnascript')
  })

  it('the main-site copy of a landing is recorded as /lp/<slug>; a forged host is replaced by the main host', () => {
    expect(sanitizeAttribution({ lp: 'amber', lp_host: 'biohack-tech.ro' }, main, BASE)).toEqual({ landing: 'amber', landingHost: 'biohack-tech.ro', landingPath: '/lp/amber' })
    expect(sanitizeAttribution({ lp: 'amber', lp_host: 'evil.example' }, main, BASE)).toEqual({ landing: 'amber', landingHost: 'biohack-tech.ro', landingPath: '/lp/amber' })
    expect(sanitizeAttribution({ lp: 'amber', lp_host: 'localhost:3000' }, main, BASE)).toMatchObject({ landingHost: 'localhost', landingPath: '/lp/amber' })
  })

  it('drops unknown landings, over-long values and non-objects', () => {
    expect(sanitizeAttribution({ lp: 'nope' }, main, BASE)).toBeNull()
    expect(sanitizeAttribution('lp=calm', main, BASE)).toBeNull()
    expect(sanitizeAttribution(null, main, BASE)).toBeNull()
    expect(sanitizeAttribution({ utm_source: 'x'.repeat(500) }, main, BASE)!.utm!.utm_source).toHaveLength(100)
    expect(attributionSummary(null)).toBe('site')
    expect(Object.fromEntries(attributionParams('?gclid=1&utm_term=somn'))).toEqual({ utm_term: 'somn' })
  })
})
