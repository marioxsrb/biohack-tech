/**
 * One GHL contact per address. The NEUROS location allows duplicate contacts, and GHL's upsert created a new
 * contact for an address it already had (verified on the live API, 14.10.2026). Every save looks the address up.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const { ghl } = await import('@/server/integrations/ghl')
const c = { token: 't', locationId: 'loc1', pipelineId: 'p', apiBase: 'https://ghl.test' } as never
let calls: { method: string; path: string; body: Record<string, unknown> | null }[]
let existing: string | null
let stale: Set<string>

beforeEach(() => {
  calls = []
  existing = null
  stale = new Set()
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const path = String(url).replace('https://ghl.test', '')
    const body = init.body ? JSON.parse(String(init.body)) : null
    calls.push({ method: init.method ?? 'GET', path, body })
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status })
    if (path === '/contacts/search') return json({ contacts: existing ? [{ id: existing }] : [] })
    if (path === '/contacts/upsert') return json({ contact: { id: 'created-1' } })
    if (init.method === 'PUT') return stale.has(path.split('/')[2]) ? json({ message: 'Contact not found' }, 400) : json({ contact: { id: path.split('/')[2] } })
    return json({}, 404)
  })
})
afterEach(() => vi.unstubAllGlobals())

const lead = { name: 'Ana Popescu', email: 'Ana@Exemplu.ro', phone: null }

it('an address GHL already has: its oldest contact is updated, nothing is created, its source is kept', async () => {
  existing = 'old-contact'
  expect(await ghl.upsertLeadContact(c, lead)).toBe('old-contact')
  expect(calls.map((x) => `${x.method} ${x.path}`)).toEqual(['POST /contacts/search', 'PUT /contacts/old-contact'])
  expect(calls[0].body).toMatchObject({ locationId: 'loc1', filters: [{ field: 'email', operator: 'eq', value: 'ana@exemplu.ro' }], sort: [{ field: 'dateAdded', direction: 'asc' }] })
  expect(calls[1].body).not.toHaveProperty('locationId')
  expect(calls[1].body).not.toHaveProperty('source')
})

it('a new address is created once; a known id skips the lookup; a stale known id falls back to it', async () => {
  expect(await ghl.updateMarketing(c, 'new@exemplu.ro', { consent: true, recoveryUrl: '', unsubscribeUrl: '' })).toBe('created-1')
  expect(calls.map((x) => `${x.method} ${x.path}`)).toEqual(['POST /contacts/search', 'POST /contacts/upsert'])
  calls = []
  expect(await ghl.upsertLeadContact(c, lead, 'known-1')).toBe('known-1')
  expect(calls.map((x) => `${x.method} ${x.path}`)).toEqual(['PUT /contacts/known-1'])
  calls = []
  stale.add('gone-1')
  existing = 'old-contact'
  expect(await ghl.upsertLeadContact(c, lead, 'gone-1')).toBe('old-contact')
  expect(calls.map((x) => `${x.method} ${x.path}`)).toEqual(['PUT /contacts/gone-1', 'POST /contacts/search', 'PUT /contacts/old-contact'])
})
