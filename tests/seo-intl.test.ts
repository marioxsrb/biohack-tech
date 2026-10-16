/** Search engines: Romanian pages on biohack-tech.ro, English pages on www.biohack-tech.net, each sitemap its own. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

let host = 'biohack-tech.ro'
vi.mock('next/headers', () => ({ headers: async () => new Headers({ host }) }))
vi.mock('server-only', () => ({}))

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://biohack-tech.ro')
  vi.stubEnv('NODE_ENV', 'production')
})

const { pageMetadata, productJsonLd } = await import('@/lib/seo')
const { getProduct } = await import('@/content/catalog')

describe('international SEO', () => {
  it('canonical by language: Romanian on .ro, English on .net (also for the English copy served on .ro); hreflang ro-RO, en, x-default', () => {
    const ro = pageMetadata({ title: 't', description: 'd', path: '/products/calm', locale: 'ro' })
    const en = pageMetadata({ title: 't', description: 'd', path: '/products/calm', locale: 'en' })
    expect(ro.alternates?.canonical).toBe('https://biohack-tech.ro/products/calm')
    expect(en.alternates?.canonical).toBe('https://www.biohack-tech.net/en/products/calm')
    const languages = { 'ro-RO': 'https://biohack-tech.ro/products/calm', en: 'https://www.biohack-tech.net/en/products/calm', 'x-default': 'https://www.biohack-tech.net/en/products/calm' }
    expect(ro.alternates?.languages).toEqual(languages)
    expect(en.alternates?.languages).toEqual(languages)
    expect(en.openGraph).toMatchObject({ url: 'https://www.biohack-tech.net/en/products/calm', locale: 'en_GB' })
    expect((en.openGraph as { images?: unknown[] }).images?.length).toBe(1) // a sharing image even without its own
    expect(pageMetadata({ title: 't', description: 'd', path: '/', locale: 'en' }).alternates?.canonical).toBe('https://www.biohack-tech.net/en')
  })

  it('product data on the English page: its .net address and the euro price the store shows; the Romanian one in lei', () => {
    const p = getProduct('brainlink-pro')!
    const en = productJsonLd(p, 'd', [], 'en') as { url: string; offers: { priceCurrency: string; price: string; shippingDetails?: unknown } }
    const ro = productJsonLd(p, 'd', [], 'ro') as { url: string; offers: { priceCurrency: string; price: string } }
    expect(en.url).toBe('https://www.biohack-tech.net/en/products/focus')
    expect(en.offers.priceCurrency).toBe('EUR')
    expect(Number(en.offers.price)).toBeGreaterThan(0)
    expect(Number(en.offers.price)).toBeLessThan(Number(ro.offers.price))
    expect(en.offers.shippingDetails).toBeUndefined() // delivery worldwide
    expect(ro).toMatchObject({ url: 'https://biohack-tech.ro/products/focus', offers: { priceCurrency: 'RON' } })
  })

  it('each host has its own sitemap and robots', async () => {
    const { default: sitemap } = await import('@/app/sitemap')
    const { default: robots } = await import('@/app/robots')
    host = 'biohack-tech.ro'
    const ro = await sitemap()
    expect(ro.every((e) => e.url.startsWith('https://biohack-tech.ro'))).toBe(true)
    expect((await robots()).sitemap).toBe('https://biohack-tech.ro/sitemap.xml')
    host = 'www.biohack-tech.net'
    const net = await sitemap()
    expect(net.every((e) => e.url.startsWith('https://www.biohack-tech.net/en'))).toBe(true)
    expect(net.find((e) => e.url.endsWith('/en/products/calm'))?.alternates?.languages).toMatchObject({ 'ro-RO': 'https://biohack-tech.ro/products/calm' })
    expect(net.some((e) => e.url.endsWith('/en/terms-of-service'))).toBe(true)
    expect((await robots()).sitemap).toBe('https://www.biohack-tech.net/sitemap.xml')
  })
})
