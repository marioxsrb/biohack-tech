/**
 * bt-comanda-plasata (an order that stands: cash on delivery or transfer once placed, card once paid) and the
 * mirror sub-account (Brain Event): the purchase tags reach a contact it already has, matched by email, never a
 * new contact, and a mirror failure never fails the order's own sync. GoHighLevel is stubbed; PGlite.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.setConfig({ testTimeout: 30_000 })
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: () => {} }))

const { freshDb, person, lines, TEST_ENV } = await import('./helpers')
const svc = await import('@/server/orders/service')
const { runDueJobs } = await import('@/server/jobs/runner')
const { STAGES, placedTags } = await import('@/server/integrations/ghl')
const { getDb } = await import('@/server/db')

const MIRROR = 'brain-loc'
let calls: { url: string; method: string; auth: string; body: Record<string, unknown> | null }[]
let mirror: { found: boolean; down: boolean }

beforeEach(async () => {
  await freshDb({ ...TEST_ENV, EMAIL_TRANSPORT: 'none', GHL_BRAINEVENT_TOKEN: 'pit-brain', GHL_BRAINEVENT_LOCATION_ID: MIRROR })
  calls = []
  mirror = { found: true, down: false }
  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    const auth = String((init.headers as Record<string, string>)?.Authorization ?? '')
    const body = init.body && String(init.body).startsWith('{') ? JSON.parse(String(init.body)) : null
    calls.push({ url, method: init.method ?? 'GET', auth, body })
    const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } })
    if (auth.includes('pit-brain')) {
      if (mirror.down) return json({ message: 'down' }, 503)
      if (url.includes('/contacts/search')) return json({ contacts: mirror.found ? [{ id: 'brain-contact' }] : [] })
      if (url.includes('/tags')) return json({})
      return json({ message: 'unexpected mirror call' }, 400)
    }
    if (url.includes('/contacts/search')) return json({ contacts: [] })
    if (url.includes('/contacts/upsert')) return json({ contact: { id: 'contact-1' } })
    if (url.includes('/tags')) return json({})
    if (url.includes('/opportunities/pipelines')) return json({ pipelines: [{ id: 'pipe1', stages: Object.values(STAGES).map((n, i) => ({ id: `stage-${i}`, name: n })) }] })
    if (url.includes('/opportunities/search')) return json({ opportunities: [] })
    if (url.includes('/opportunities')) return json({ opportunity: { id: 'opp-1' } })
    return json({})
  })
})
afterEach(() => vi.unstubAllGlobals())

const place = (method: 'cod' | 'transfer' | 'card', email = person.email) =>
  svc.placeOrder({ lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]), form: { ...person, email, paymentMethod: method }, attemptId: `m-${Math.random()}` })
const mirrorTags = () => calls.filter((c) => c.auth.includes('pit-brain') && c.url.endsWith('/tags')).flatMap((c) => c.body?.tags as string[])
const mainTags = () => calls.filter((c) => !c.auth.includes('pit-brain') && c.url.endsWith('/tags') && c.method === 'POST').flatMap((c) => c.body?.tags as string[])

describe('bt-comanda-plasata', () => {
  it('cash on delivery and transfer: as soon as placed; an unpaid card order: not yet', async () => {
    const cod = (await place('cod')).order
    const transfer = (await place('transfer')).order
    const card = (await place('card')).order
    expect(placedTags(cod)).toEqual(['bt-comanda-plasata'])
    expect(placedTags(transfer)).toEqual(['bt-comanda-plasata'])
    expect(placedTags(card)).toEqual([])
    await runDueJobs()
    expect(mainTags()).toContain('bt-comanda-plasata')
  })
})

describe('mirror sub-account (Brain Event)', () => {
  it('a contact it already has gets bt-comanda-plasata; nothing is ever created there', async () => {
    await place('cod')
    await runDueJobs()
    expect(mirrorTags()).toEqual(['bt-comanda-plasata'])
    const mirrorCalls = calls.filter((c) => c.auth.includes('pit-brain'))
    expect(mirrorCalls.every((c) => c.url.includes('/contacts/search') || c.url.endsWith('/contacts/brain-contact/tags'))).toBe(true)
    expect(mirrorCalls.find((c) => c.url.includes('/contacts/search'))!.body).toMatchObject({ locationId: MIRROR })
  })

  it('an address the mirror does not have: no tag, no contact', async () => {
    mirror.found = false
    await place('cod', 'nou@exemplu.ro')
    await runDueJobs()
    expect(mirrorTags()).toEqual([])
  })

  it('the mirror being down never fails the order sync', async () => {
    mirror.down = true
    await place('cod')
    await runDueJobs()
    expect(mainTags()).toContain('bt-comanda-plasata')
    const failed = await (await getDb()).query<{ n: number }>("select count(*)::int as n from jobs where kind = 'ghl.sync' and status <> 'done'")
    expect(failed.rows[0].n).toBe(0)
  })
})
