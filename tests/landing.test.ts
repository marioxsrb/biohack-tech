/**
 * Advertising landings: which hostnames are ours, what each one serves, which product it sells, and
 * what campaign data survives the trip to the order.
 */
import { describe, expect, it } from 'vitest'
import { checkoutHref } from '@/components/landing/checkout-link'
import { getProduct, productHref } from '@/content/catalog'
import { landings } from '@/content/landings'
import { attributionParams, attributionSummary, sanitizeAttribution } from '@/lib/attribution'
import { LANDING_SLUGS, landingForHost, routeLanding } from '@/lib/landing-hosts'

const BASE = 'biohack-tech.ro'
const prod = (host: string) => landingForHost(host, BASE, false)

describe('landing hostnames (explicit allowlist)', () => {
  it('maps each of the four hostnames to its landing, ignoring case, port and a trailing dot', () => {
    expect(LANDING_SLUGS.map((s) => prod(`${s}.biohack-tech.ro`))).toEqual(['calm', 'focus', 'amber', 'brain-flow'])
    expect(prod('CALM.Biohack-Tech.ro:443')).toBe('calm')
    expect(prod('brain-flow.biohack-tech.ro.')).toBe('brain-flow')
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
  it('its landing at "/", the checkout and order pages it needs, and a redirect to the main site for the rest', () => {
    expect(routeLanding('focus', '/')).toEqual({ action: 'rewrite', path: '/lp/focus' })
    expect(routeLanding('focus', '/lp/focus')).toEqual({ action: 'redirect', path: '/' })
    for (const p of ['/checkout', '/comanda/abc_DEF-123', '/api/checkout', '/api/consent', '/_next/static/x.js', '/politica-retur', '/retragere', '/retragere/confirmare', '/terms-of-service']) {
      expect(routeLanding('focus', p)).toEqual({ action: 'next' })
    }
    for (const p of ['/products/focus', '/admin', '/admin/orders/1', '/cart', '/lp/calm', '/api/jobs/run', '/api/webhooks/stripe', '/about-us']) {
      expect(routeLanding('focus', p)).toEqual({ action: 'redirect', path: p })
    }
  })
})

describe('the four landings', () => {
  it('one per product, same slug as the product page, not listed anywhere', () => {
    expect(landings.map((l) => [l.slug, l.productId])).toEqual([
      ['calm', 'balance-wave'],
      ['focus', 'brainlink-pro'],
      ['amber', 'ochelari-biohack'],
      ['brain-flow', 'brain-flow'],
    ])
    for (const l of landings) expect(productHref(getProduct(l.productId)!)).toBe(`/products/${l.slug}`)
  })

  it('copy: no dash punctuation, no invented social proof, urgency or health promises', () => {
    const text = JSON.stringify(
      landings.map((l) => [l.meta, l.hero.eyebrow, l.hero.title, l.hero.text, l.points, l.story.title, l.story.text, l.steps, l.moment.title, l.moment.text, l.offer, l.faqs]),
    )
    expect(text).not.toMatch(/[—–]/)
    expect(text).not.toMatch(/clienți mulțumiți|recenzi|stele|stoc limitat|ultimele|doar azi|ofertă expir|reducere|vindec|garantat|tratează|anxiet|depresi|insomni/i)
  })

  it('the checkout link carries ids and campaign parameters only', () => {
    const href = checkoutHref('brain-flow', 'brain-flow', '13-zone', {
      search: '?utm_source=facebook&utm_medium=paid&utm_campaign=lansare&fbclid=abc&email=ana@x.ro&price=1',
      host: 'brain-flow.biohack-tech.ro',
    })
    const q = new URL(href, 'https://x').searchParams
    expect(href.startsWith('/checkout?')).toBe(true)
    expect(Object.fromEntries(q)).toEqual({
      utm_source: 'facebook',
      utm_medium: 'paid',
      utm_campaign: 'lansare',
      item: 'brain-flow:13-zone',
      lp: 'brain-flow',
      lp_host: 'brain-flow.biohack-tech.ro',
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
