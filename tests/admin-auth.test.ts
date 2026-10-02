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
  it('defaults the user to "admin"', () => {
    expect(checkAdminAuth(basic('admin:a-long-test-password'), { ADMIN_PASSWORD: env.ADMIN_PASSWORD })).toBe('ok')
  })
})

describe('admin Server Actions check credentials themselves', () => {
  it('reject any request without valid credentials, even with a Basic header', async () => {
    let header: string | null = null
    vi.doMock('next/headers', () => ({ headers: async () => new Headers(header ? { authorization: header } : {}) }))
    vi.doMock('next/cache', () => ({ revalidatePath: () => {} }))
    vi.stubEnv('ADMIN_USER', env.ADMIN_USER)
    vi.stubEnv('ADMIN_PASSWORD', env.ADMIN_PASSWORD)
    const actions = await import('@/app/[lang]/(site)/admin/actions')
    const form = new FormData()
    form.set('id', '00000000-0000-4000-8000-000000000000')
    for (const h of [null, 'Basic x', basic('ops:wrong-password-123'), basic('ops')]) {
      header = h
      await expect(actions.markPaidAction(form)).rejects.toThrow('unauthorized')
      await expect(actions.retryJobsAction(form)).rejects.toThrow('unauthorized')
      await expect(actions.cancelAction(form)).rejects.toThrow('unauthorized')
    }
    vi.unstubAllEnvs()
  })
})
