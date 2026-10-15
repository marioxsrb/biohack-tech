/** Resetting the acces sessions: a form sent before GATE_RESET_AT no longer unlocks any device. PGlite. */
import { describe, expect, it } from 'vitest'

const { freshDb, TEST_ENV } = await import('./helpers')
const { captureLead, leads } = await import('@/server/leads')
const { GATE_RESET_AT, GATE_COOKIE } = await import('@/lib/lead')

describe('acces sessions reset', () => {
  it('recognises only forms sent after the reset, by id, device key or email', async () => {
    const db = await freshDb(TEST_ENV)
    const form = (visitorId: string, email: string) =>
      captureLead(db, { visitorId, funnel: 'gated_price', stage: 'lead', productId: 'balance-wave', contact: { name: 'Ana', email, phone: '0722123456' }, marketingConsent: false, deviceKey: `key-${visitorId}` })
    const old = (await form('v-old', 'veche@exemplu.ro')).lead
    await db.query('update leads set created_at = $2 where id = $1', [old.id, new Date(GATE_RESET_AT.getTime() - 60_000)])
    const fresh = (await form('v-new', 'noua@exemplu.ro')).lead
    expect(await leads.recognize(db, { id: old.id }, 90)).toBeNull()
    expect(await leads.recognize(db, { deviceKey: 'key-v-old' }, 90)).toBeNull()
    expect(await leads.recognize(db, { email: 'veche@exemplu.ro' }, 90)).toBeNull()
    expect((await leads.recognize(db, { email: 'noua@exemplu.ro' }, 90))?.id).toBe(fresh.id)
    expect(GATE_COOKIE).not.toBe('bt_gate') // the old cookie no longer unlocks prices before paint
  })
})
