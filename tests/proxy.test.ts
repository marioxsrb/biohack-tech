/** The proxy itself, with real requests: landing hostnames, forged hosts, and the admin gate. */
import { NextRequest } from 'next/server'
import { getRewrittenUrl, isRewrite } from 'next/experimental/testing/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.unstubAllEnvs()
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://biohack-tech.ro')
  vi.stubEnv('ADMIN_PASSWORD', 'a-long-test-password')
  vi.resetModules()
})

async function run(url: string, host: string, headers: Record<string, string> = {}) {
  const { proxy } = await import('@/proxy')
  return proxy(new NextRequest(url, { headers: { host, ...headers } }))
}

describe('proxy', () => {
  it('serves the landing at the root of its hostname, never indexed, keeping the campaign query', async () => {
    const res = await run('https://focus.biohack-tech.ro/?utm_source=meta', 'focus.biohack-tech.ro')
    expect(isRewrite(res)).toBe(true)
    expect(getRewrittenUrl(res)).toBe('https://focus.biohack-tech.ro/ro/lp/focus?utm_source=meta')
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  })

  it('lets the checkout through on a landing hostname and sends everything else to the main site', async () => {
    const ok = await run('https://calm.biohack-tech.ro/checkout?item=balance-wave', 'calm.biohack-tech.ro')
    expect(getRewrittenUrl(ok)).toBe('https://calm.biohack-tech.ro/ro/checkout?item=balance-wave')
    expect(ok.status).toBe(200)
    const away = await run('https://calm.biohack-tech.ro/admin', 'calm.biohack-tech.ro')
    expect(away.status).toBe(308)
    expect(away.headers.get('location')).toBe('https://biohack-tech.ro/admin')
  })

  it('a forged Host is just the main site: no landing, and /admin still asks for credentials', async () => {
    const res = await run('https://biohack-tech.ro/', 'calm.biohack-tech.ro.evil.com')
    expect(getRewrittenUrl(res)).toBe('https://biohack-tech.ro/ro')
    expect(res.headers.get('x-robots-tag')).toBeNull()
    const admin = await run('https://biohack-tech.ro/admin', 'calm.biohack-tech.ro.evil.com')
    expect(admin.status).toBe(401)
  })

  it('serves the presentation page at /prezentare on a landing hostname, outside the language tree, never indexed', async () => {
    const res = await run('https://calm.biohack-tech.ro/prezentare?utm_source=x', 'calm.biohack-tech.ro')
    expect(getRewrittenUrl(res)).toBe('https://calm.biohack-tech.ro/prezentare/calm?utm_source=x')
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    // Another landing's presentation is not reachable from this hostname.
    const other = await run('https://calm.biohack-tech.ro/prezentare/focus', 'calm.biohack-tech.ro')
    expect(other.status).toBe(308)
  })

  it('previews the presentation pages on the main host at /lp/<slug>/prezentare, never indexed', async () => {
    const res = await run('https://biohack-tech.ro/lp/amber/prezentare', 'biohack-tech.ro')
    expect(getRewrittenUrl(res)).toBe('https://biohack-tech.ro/prezentare/amber')
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(getRewrittenUrl(await run('https://biohack-tech.ro/lp/nope/prezentare', 'biohack-tech.ro'))).toBe('https://biohack-tech.ro/ro/lp/nope/prezentare')
  })

  it('NEUROS Flow is gone: its hostname redirects to the main site, its pages answer 410 on every host and language', async () => {
    for (const [url, to] of [
      ['https://brain-flow.biohack-tech.ro/?utm_source=meta', 'https://biohack-tech.ro/?utm_source=meta'],
      ['https://brain-flow.biohack-tech.ro/checkout?item=brain-flow:4-zone', 'https://biohack-tech.ro/checkout?item=brain-flow:4-zone'],
      ['https://brain-flow.biohack-tech.ro/comanda/abc_DEF', 'https://biohack-tech.ro/comanda/abc_DEF'],
      ['https://brain-flow.biohack-tech.ro/api/checkout', 'https://biohack-tech.ro/api/checkout'],
    ]) {
      const res = await run(url, 'brain-flow.biohack-tech.ro')
      expect([res.status, res.headers.get('location')]).toEqual([308, to])
    }
    for (const [url, host] of [
      ['https://biohack-tech.ro/products/brain-flow', 'biohack-tech.ro'],
      ['https://biohack-tech.ro/en/products/brain-flow', 'biohack-tech.ro'],
      ['https://biohack-tech.ro/lp/brain-flow', 'biohack-tech.ro'],
      ['https://biohack-tech.ro/lp/brain-flow/prezentare', 'biohack-tech.ro'],
      ['https://biohack-tech.ro/prezentare/brain-flow', 'biohack-tech.ro'],
      ['https://calm.biohack-tech.ro/products/brain-flow', 'calm.biohack-tech.ro'],
    ]) {
      const res = await run(url, host)
      expect(res.status).toBe(410)
      expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow')
      expect(await res.text()).toContain('NEUROS Flow')
    }
  })

  it('the main-site copies under /lp are not indexed', async () => {
    const res = await run('https://biohack-tech.ro/lp/amber', 'biohack-tech.ro')
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  })

  it('Romanian keeps the plain URLs, English lives under /en, and /ro is never a public address', async () => {
    expect(getRewrittenUrl(await run('https://biohack-tech.ro/products/calm?x=1', 'biohack-tech.ro'))).toBe('https://biohack-tech.ro/ro/products/calm?x=1')
    const en = await run('https://biohack-tech.ro/en/products/calm', 'biohack-tech.ro')
    expect(getRewrittenUrl(en)).toBe('https://biohack-tech.ro/en/products/calm')
    expect(getRewrittenUrl(await run('https://biohack-tech.ro/en', 'biohack-tech.ro'))).toBe('https://biohack-tech.ro/en')
    const ro = await run('https://biohack-tech.ro/ro/cart?a=b', 'biohack-tech.ro')
    expect(ro.status).toBe(308)
    expect(ro.headers.get('location')).toBe('https://biohack-tech.ro/cart?a=b')
    // A path that only starts with the letters is not a language.
    expect(getRewrittenUrl(await run('https://biohack-tech.ro/english', 'biohack-tech.ro'))).toBe('https://biohack-tech.ro/ro/english')
  })

  it('API routes and generated files are not pages: they keep their paths', async () => {
    for (const path of ['/api/checkout', '/sitemap.xml', '/robots.txt', '/icon.svg']) {
      const res = await run(`https://biohack-tech.ro${path}`, 'biohack-tech.ro')
      expect(isRewrite(res)).toBe(false)
    }
  })

  it('the admin gate also covers /en/admin', async () => {
    expect((await run('https://biohack-tech.ro/en/admin', 'biohack-tech.ro')).status).toBe(401)
  })
})
