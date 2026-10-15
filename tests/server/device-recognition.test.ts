/**
 * A returning device sees prices without the form: by the lead id it kept, by its device key (device hash +
 * network address, stored only as an HMAC), or by the email typed again. Plus the price form's optional terms
 * box and the duplicate filter (one row per person in admin, distinct people in stats). PGlite database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.setConfig({ testTimeout: 30_000 })
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => void fn() }))
vi.mock('@/server/rate-limit', async (orig) => ({ ...(await orig<typeof import('@/server/rate-limit')>()), rateLimit: () => true }))

const { freshDb, TEST_ENV } = await import('./helpers')
const { leads } = await import('@/server/leads')
const { funnelStats } = await import('@/server/stats')
const { networkPrefix } = await import('@/server/device')
const { POST: lead } = await import('@/app/api/lead/route')

const NO_GHL = Object.fromEntries(Object.entries(TEST_ENV).filter(([k]) => !k.startsWith('GHL_')))
const ENV = { ...NO_GHL, NEXT_PUBLIC_SITE_URL: 'https://biohack-tech.ro', PRICE_GATE_ENABLED: 'true', ABANDONED_CHECKOUT_ENABLED: 'true', EMAIL_TRANSPORT: 'smtp' }
const GATED = 'acces.biohack-tech.ro'
const DEV_A = 'a'.repeat(64)
const DEV_B = 'b'.repeat(64)
const ana = { name: 'Ana Popescu', email: 'ana@exemplu.ro', phone: '0722 123 456' }

let db: Awaited<ReturnType<typeof freshDb>>
beforeEach(async () => {
  db = await freshDb(ENV)
})

function post(body: unknown, ip: string, host = GATED) {
  return new NextRequest(`https://${host}/api/lead`, { method: 'POST', headers: { host, 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) })
}
const reveal = (extra: Record<string, unknown>, ip = '86.120.10.20') => lead(post({ action: 'reveal', termsAccepted: true, ...ana, productId: 'balance-wave', ...extra }, ip))
const recognize = async (body: Record<string, unknown>, ip = '86.120.10.20', host = GATED) => {
  const res = await lead(post({ action: 'recognize', ...body }, ip, host))
  return { status: res.status, cookie: res.headers.get('set-cookie') ?? '', ...((await res.json()) as { unlocked?: boolean; leadId?: string }) }
}
const count = async () => (await db.query<{ n: number }>('select count(*)::int as n from leads')).rows[0].n

describe('device recognition', () => {
  it('the same device on the same network sees prices again, in another browser (no cookie), without a new lead', async () => {
    const { leadId } = await (await reveal({ device: DEV_A })).json()
    const r = await recognize({ device: DEV_A })
    expect(r).toMatchObject({ status: 200, unlocked: true, leadId })
    expect(r.cookie).toMatch(new RegExp(`bt_gate2=${leadId}`))
    expect(await count()).toBe(1)
  })

  it('only the key is stored: an HMAC, never the device hash or the IP', async () => {
    await reveal({ device: DEV_A })
    const { rows } = await db.query<{ device_key: string }>('select device_key from leads')
    expect(rows[0].device_key).toMatch(/^[0-9a-f]{64}$/)
    expect(rows[0].device_key).not.toBe(DEV_A)
    expect(JSON.stringify(rows)).not.toContain('86.120.10.20')
  })

  it('an identical device on another network, or another device on the same network, is not recognised', async () => {
    await reveal({ device: DEV_A }, '86.120.10.20')
    expect((await recognize({ device: DEV_A }, '5.12.200.7')).unlocked).toBe(false)
    expect((await recognize({ device: DEV_B }, '86.120.10.20')).unlocked).toBe(false)
    expect((await recognize({}, '86.120.10.20')).unlocked).toBe(false)
  })

  it('IPv6: the same /64 matches (a phone changing its address), another /64 does not', async () => {
    await reveal({ device: DEV_A }, '2a02:2f0e:1234:5678:aaaa:bbbb:cccc:1')
    expect((await recognize({ device: DEV_A }, '2a02:2f0e:1234:5678:1111:2222:3333:4')).unlocked).toBe(true)
    expect((await recognize({ device: DEV_A }, '2a02:2f0e:1234:9999:aaaa:bbbb:cccc:1')).unlocked).toBe(false)
    expect(networkPrefix('::ffff:86.120.10.20')).toBe('86.120.10.20')
  })

  it('the lead id the device kept works from any network; a made-up id does not', async () => {
    const { leadId } = await (await reveal({ device: DEV_A })).json()
    expect((await recognize({ saved: leadId }, '5.12.200.7')).unlocked).toBe(true)
    expect((await recognize({ saved: '00000000-0000-4000-8000-000000000000' })).unlocked).toBe(false)
    expect((await recognize({ saved: "x' or 1=1 --" })).unlocked).toBe(false)
  })

  it('"Ai mai completat?": a known email unlocks, an unknown one does not, a malformed one is refused', async () => {
    await reveal({})
    expect((await recognize({ email: ' ANA@exemplu.ro ' }, '5.12.200.7')).unlocked).toBe(true)
    expect((await recognize({ email: 'altcineva@exemplu.ro' })).unlocked).toBe(false)
    expect((await recognize({ email: 'nu-e-email' })).status).toBe(422)
    expect(await count()).toBe(1)
  })

  it('only for 90 days, and only on the price-gated host', async () => {
    const { leadId } = await (await reveal({ device: DEV_A })).json()
    expect((await recognize({ device: DEV_A }, '86.120.10.20', 'biohack-tech.ro')).status).toBe(404)
    await db.query("update leads set created_at = now() - interval '91 days'")
    expect((await recognize({ device: DEV_A })).unlocked).toBe(false)
    expect((await recognize({ saved: leadId })).unlocked).toBe(false)
    expect((await recognize({ email: ana.email })).unlocked).toBe(false)
  })
})

describe('price form: the terms box is required (15.10.2026)', () => {
  it('unticked: refused, nothing stored; ticked: the price unlocks and the time is kept on the lead', async () => {
    const res = await reveal({ termsAccepted: false })
    expect(res.status).toBe(422)
    expect((await res.json()).fields).toHaveProperty('terms')
    const b = await (await lead(post({ action: 'reveal', termsAccepted: true, ...ana, email: 'ion@exemplu.ro', productId: 'balance-wave' }, '86.120.10.21'))).json()
    expect((await leads.byId(db, b.leadId))!.termsAcceptedAt).toBeInstanceOf(Date)
  })
})

describe('duplicate filter', () => {
  it('admin: one row per person (newest form, with the count); every form on request. Stats: distinct people', async () => {
    await reveal({ productId: 'balance-wave' }, '86.120.10.20')
    await reveal({ productId: 'brainlink-pro' }, '86.120.10.20')
    await lead(post({ action: 'reveal', termsAccepted: true, ...ana, productId: 'balance-wave' }, '5.12.200.7')) // another browser, no cookie
    await lead(post({ action: 'reveal', termsAccepted: true, name: 'Ion', email: 'ion@exemplu.ro', phone: '0733 123 456', productId: 'balance-wave' }, '5.12.200.8'))
    const all = await leads.listWithForms(db, {})
    const unique = await leads.listWithForms(db, { unique: true })
    expect(all.length).toBeGreaterThanOrEqual(3)
    expect(unique.map((x) => x.lead.email).sort()).toEqual(['ana@exemplu.ro', 'ion@exemplu.ro'])
    expect(unique.find((x) => x.lead.email === 'ana@exemplu.ro')!.forms).toBe(all.filter((x) => x.lead.email === 'ana@exemplu.ro').length)
    const [gated] = await funnelStats(db, { from: new Date(Date.now() - 86_400_000), to: new Date(Date.now() + 86_400_000), funnel: 'gated_price' })
    expect(gated.people).toBe(2)
    expect(gated.leads).toBe(all.length)
  })
})
