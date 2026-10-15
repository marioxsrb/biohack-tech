import { describe, expect, it, vi } from 'vitest'
import { checkAdminAuth } from '@/lib/admin-auth'

const env = { ADMIN_USER: 'ops', ADMIN_PASSWORD: 'a-long-test-password' }
const basic = (s: string) => `Basic ${btoa(s)}`

describe('admin credentials', () => {
  it('is disabled without a strong password', () => {
    expect(checkAdminAuth(basic('ops:x'), {})).toBe('disabled')
    expect(checkAdminAuth(basic('ops:short'), { ADMIN_PASSWORD: 'short' })).toBe('disabled')
  })
  it('accepts only the exact user and password', () => {
    expect(checkAdminAuth(basic('ops:a-long-test-password'), env)).toBe('ok')
    expect(checkAdminAuth(basic('ops:a-long-test-passwordX'), env)).toBe('denied')
    expect(checkAdminAuth(basic('admin:a-long-test-password'), env)).toBe('denied')
    expect(checkAdminAuth(basic('ops:'), env)).toBe('denied')
    expect(checkAdminAuth('Basic anything', env)).toBe('denied')
    expect(checkAdminAuth('Basic !!!not-base64', env)).toBe('denied')
    expect(checkAdminAuth('Bearer a-long-test-password', env)).toBe('denied')
    expect(checkAdminAuth(null, env)).toBe('denied')
  })
  it('needs at least 10 characters: 9 keeps /admin off, 10 works, still only with the exact credentials', async () => {
    const nine = { ADMIN_USER: 'ops', ADMIN_PASSWORD: 'abcdefghi' }
    const ten = { ADMIN_USER: 'ops', ADMIN_PASSWORD: 'abcdefghij' }
    expect(checkAdminAuth(basic('ops:abcdefghi'), nine)).toBe('disabled')
    expect(checkAdminAuth(basic('ops:abcdefghij'), ten)).toBe('ok')
    expect(checkAdminAuth(basic('ops:abcdefghik'), ten)).toBe('denied')
    expect(checkAdminAuth(undefined, ten)).toBe('denied')
    const { loadConfig, resetConfig } = await import('@/server/config')
    for (const [password, admin, error] of [
      ['abcdefghi', null, true],
      ['abcdefghij', { user: 'ops', password: 'abcdefghij' }, false],
    ] as const) {
      vi.stubEnv('ADMIN_USER', 'ops')
      vi.stubEnv('ADMIN_PASSWORD', password)
      resetConfig()
      const { config, issues } = loadConfig()
      expect(config.admin).toEqual(admin)
      expect(issues.some((i) => i.area === 'admin' && i.level === 'error')).toBe(error)
    }
    vi.unstubAllEnvs()
    resetConfig()
  })
  it('defaults the user to "admin"', () => {
    expect(checkAdminAuth(basic('admin:a-long-test-password'), { ADMIN_PASSWORD: env.ADMIN_PASSWORD })).toBe('ok')
  })
})

describe('admin Server Actions check credentials themselves', () => {
  it('reject any request without valid credentials, even with a Basic header', async () => {
    let header: string | null = null
    let session: string | undefined
    vi.doMock('next/headers', () => ({
      headers: async () => new Headers(header ? { authorization: header } : {}),
      cookies: async () => ({ get: () => (session ? { value: session } : undefined) }),
    }))
    vi.doMock('next/cache', () => ({ revalidatePath: () => {} }))
    vi.stubEnv('ADMIN_USER', env.ADMIN_USER)
    vi.stubEnv('ADMIN_PASSWORD', env.ADMIN_PASSWORD)
    const actions = await import('@/app/[lang]/(admin)/admin/actions')
    const form = new FormData()
    form.set('id', '00000000-0000-4000-8000-000000000000')
    for (const h of [null, 'Basic x', basic('ops:wrong-password-123'), basic('ops')]) {
      header = h
      await expect(actions.markPaidAction(form)).rejects.toThrow('unauthorized')
      await expect(actions.retryJobsAction(form)).rejects.toThrow('unauthorized')
      await expect(actions.cancelAction(form)).rejects.toThrow('unauthorized')
    }
    // A forged or expired session cookie does not pass either.
    header = null
    const { createAdminSession } = await import('@/lib/admin-auth')
    for (const s of ['x.1.y', await createAdminSession(env.ADMIN_USER, env, Date.now() - 30 * 86_400_000), await createAdminSession('someone-else', env)]) {
      session = s
      await expect(actions.retryJobsAction(form)).rejects.toThrow('unauthorized')
    }
    vi.unstubAllEnvs()
  })
})
