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

  it('a forged Host is just the main site: no landing, and /admin still asks to sign in', async () => {
    const res = await run('https://biohack-tech.ro/', 'calm.biohack-tech.ro.evil.com')
    expect(getRewrittenUrl(res)).toBe('https://biohack-tech.ro/ro')
    expect(res.headers.get('x-robots-tag')).toBeNull()
    const admin = await run('https://biohack-tech.ro/admin', 'calm.biohack-tech.ro.evil.com')
    expect([admin.status, admin.headers.get('location')]).toEqual([303, 'https://biohack-tech.ro/admin/login?next=%2Fadmin'])
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
    expect((await run('https://biohack-tech.ro/en/admin', 'biohack-tech.ro')).status).toBe(303)
  })

  it('admin login: the page is open; a signed session lets in; a forged, expired or old-password session does not', async () => {
    const { createAdminSession, ADMIN_COOKIE } = await import('@/lib/admin-auth')
    const login = await run('https://biohack-tech.ro/admin/login', 'biohack-tech.ro')
    expect(getRewrittenUrl(login)).toBe('https://biohack-tech.ro/ro/admin/login')
    expect(login.headers.get('cache-control')).toBe('no-store')
    const env = { ADMIN_PASSWORD: 'a-long-test-password' }
    const good = await createAdminSession('admin', env)
    const page = await run('https://biohack-tech.ro/admin/comenzi', 'biohack-tech.ro', { cookie: `${ADMIN_COOKIE}=${good}` })
    expect(getRewrittenUrl(page)).toBe('https://biohack-tech.ro/ro/admin/comenzi')
    // Signed in: the login page goes straight to the dashboard.
    expect((await run('https://biohack-tech.ro/admin/login', 'biohack-tech.ro', { cookie: `${ADMIN_COOKIE}=${good}` })).headers.get('location')).toBe('https://biohack-tech.ro/admin')
    const forged = good.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'))
    const expired = await createAdminSession('admin', env, Date.now() - 8 * 86_400_000)
    const oldPassword = await createAdminSession('admin', { ADMIN_PASSWORD: 'the-previous-password' })
    for (const v of [forged, expired, oldPassword, 'garbage']) expect((await run('https://biohack-tech.ro/admin', 'biohack-tech.ro', { cookie: `${ADMIN_COOKIE}=${v}` })).status).toBe(303)
    // Basic Auth still works for scripts.
    const basic = await run('https://biohack-tech.ro/admin', 'biohack-tech.ro', { authorization: `Basic ${btoa('admin:a-long-test-password')}` })
    expect(getRewrittenUrl(basic)).toBe('https://biohack-tech.ro/ro/admin')
  })

  describe('the former acces.<domain> funnel (closed 20.10.2026)', () => {
    it('every address goes permanently to the main site; old short addresses go to the product page', async () => {
      const home = await run('https://acces.biohack-tech.ro/?utm_source=meta', 'acces.biohack-tech.ro')
      expect([home.status, home.headers.get('location')]).toEqual([308, 'https://biohack-tech.ro/?utm_source=meta'])
      const product = await run('https://acces.biohack-tech.ro/en/products/focus', 'acces.biohack-tech.ro')
      expect(product.headers.get('location')).toBe('https://biohack-tech.ro/en/products/focus')
      for (const old of ['/calm', '/acces/calm', '/lp/calm']) {
        const res = await run(`https://acces.biohack-tech.ro${old}?utm_source=meta`, 'acces.biohack-tech.ro')
        expect([res.status, res.headers.get('location')]).toEqual([308, 'https://biohack-tech.ro/products/calm?utm_source=meta'])
      }
      for (const path of ['/checkout', '/cart', '/admin', '/pentru-companii']) expect((await run(`https://acces.biohack-tech.ro${path}`, 'acces.biohack-tech.ro')).headers.get('location')).toBe(`https://biohack-tech.ro${path}`)
    })

    it('links already sent keep working: order, recovery and unsubscribe links keep their token on the way', async () => {
      const token = 'AbCdEfGhIjKlMnOpQrStUvWx12'
      for (const path of [`/comanda/${token}`, `/reluare/${token}`, `/dezabonare/${token}`, `/api/lead/resume?t=${token}&cod=BIOHACK10`]) {
        const res = await run(`https://acces.biohack-tech.ro${path}`, 'acces.biohack-tech.ro')
        expect([res.status, res.headers.get('location')]).toEqual([308, `https://biohack-tech.ro${path}`])
      }
    })

    it('old /acces/<slug> addresses on the main site go to the product page; a forged acces host is the main site', async () => {
      const res = await run('https://biohack-tech.ro/acces/calm', 'biohack-tech.ro')
      expect([res.status, res.headers.get('location')]).toEqual([307, 'https://biohack-tech.ro/products/calm'])
      const forged = await run('https://biohack-tech.ro/', 'acces.biohack-tech.ro.evil.com')
      expect(getRewrittenUrl(forged)).toBe('https://biohack-tech.ro/ro')
    })
  })

  it('a private link never keeps its token in the address: cookie (HttpOnly), 303 to the token-free page, only the needed parameters', async () => {
    const token = 'AbCdEfGhIjKlMnOpQrStUvWx12'
    const order = await run(`https://biohack-tech.ro/comanda/${token}?payment_intent=pi_1&payment_intent_client_secret=pi_1_secret_x&redirect_status=failed`, 'biohack-tech.ro')
    expect(order.status).toBe(303)
    expect(order.headers.get('location')).toBe('https://biohack-tech.ro/comanda?redirect_status=failed')
    const cookie = order.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(new RegExp(`bt_tok_comanda=${token}`))
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/Secure/i)
    expect(cookie).toMatch(/SameSite=lax/i)
    expect(order.headers.get('referrer-policy')).toBe('no-referrer')
    expect(order.headers.get('location')).not.toContain(token)
    // English, the international site and the landing hosts: same treatment, same host.
    const en = await run(`https://www.biohack-tech.net/en/reluare/${token}`, 'www.biohack-tech.net')
    expect(en.headers.get('location')).toBe('https://www.biohack-tech.net/en/reluare')
    const unsub = await run(`https://biohack-tech.ro/dezabonare/${token}?gata=1`, 'biohack-tech.ro')
    expect(unsub.headers.get('location')).toBe('https://biohack-tech.ro/dezabonare?gata=1')
    const landing = await run(`https://calm.biohack-tech.ro/comanda/${token}`, 'calm.biohack-tech.ro')
    expect(landing.headers.get('location')).toBe('https://calm.biohack-tech.ro/comanda')
    // The token-free page is served on the landing host (not sent away to the main site).
    const page = await run('https://calm.biohack-tech.ro/comanda', 'calm.biohack-tech.ro')
    expect(getRewrittenUrl(page)).toBe('https://calm.biohack-tech.ro/ro/comanda')
    // Not a token: an ordinary path.
    expect((await run('https://biohack-tech.ro/comanda/abc', 'biohack-tech.ro')).status).not.toBe(303)
  })
})
