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
    const res = await run('https://brain-flow.biohack-tech.ro/?utm_source=meta', 'brain-flow.biohack-tech.ro')
    expect(isRewrite(res)).toBe(true)
    expect(getRewrittenUrl(res)).toBe('https://brain-flow.biohack-tech.ro/lp/brain-flow?utm_source=meta')
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  })

  it('lets the checkout through on a landing hostname and sends everything else to the main site', async () => {
    const ok = await run('https://calm.biohack-tech.ro/checkout?item=balance-wave', 'calm.biohack-tech.ro')
    expect(isRewrite(ok)).toBe(false)
    expect(ok.status).toBe(200)
    const away = await run('https://calm.biohack-tech.ro/admin', 'calm.biohack-tech.ro')
    expect(away.status).toBe(308)
    expect(away.headers.get('location')).toBe('https://biohack-tech.ro/admin')
  })

  it('a forged Host is just the main site: no landing, and /admin still asks for credentials', async () => {
    const res = await run('https://biohack-tech.ro/', 'calm.biohack-tech.ro.evil.com')
    expect(isRewrite(res)).toBe(false)
    const admin = await run('https://biohack-tech.ro/admin', 'calm.biohack-tech.ro.evil.com')
    expect(admin.status).toBe(401)
  })

  it('the main-site copies under /lp are not indexed', async () => {
    const res = await run('https://biohack-tech.ro/lp/amber', 'biohack-tech.ro')
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  })
})
