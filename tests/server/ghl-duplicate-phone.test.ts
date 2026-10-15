/** A phone number that belongs to another GHL contact (the location forbids duplicates): saved without the phone. */
import { afterEach, describe, expect, it, vi } from 'vitest'

const { ghl } = await import('@/server/integrations/ghl')
const c = { token: 'pit-test', locationId: 'loc1', pipelineId: 'pipe1', apiBase: 'https://services.leadconnectorhq.com' } as never

afterEach(() => vi.unstubAllGlobals())

describe('GHL contact with a phone another contact has', () => {
  it('updates the email’s contact without the phone instead of failing', async () => {
    const calls: { method: string; url: string; body: Record<string, unknown> | null }[] = []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
      const body = init.body ? JSON.parse(String(init.body)) : null
      calls.push({ method: init.method ?? 'GET', url: String(url), body })
      const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } })
      if (String(url).includes('/contacts/search')) return json({ contacts: [{ id: 'by-email' }] })
      if (init.method === 'PUT' && body?.phone) return json({ message: 'This location does not allow duplicated contacts.' }, 400)
      return json({ contact: { id: 'by-email' } })
    })
    const id = await ghl.upsertLeadContact(c, { name: 'Mario Test', email: 'mario@exemplu.ro', phone: '+40770000000', funnel: 'visible_price' })
    expect(id).toBe('by-email')
    const puts = calls.filter((x) => x.method === 'PUT')
    expect(puts.at(-1)!.body).toMatchObject({ email: 'mario@exemplu.ro', firstName: 'Mario' })
    expect(puts.at(-1)!.body).not.toHaveProperty('phone')
    expect(calls.some((x) => x.url.includes('/contacts/upsert'))).toBe(false)
  })
})
