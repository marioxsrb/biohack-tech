/**
 * The popup's three gift boxes (20.10.2026): the server draws the gift, a box is claimed once, the email carries
 * that gift's code, and the codes price as promised (100 lei off anything but the book, 12,33%). PGlite database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.setConfig({ testTimeout: 30_000 })
const { freshDb } = await import('./helpers')
const { drawGift, welcomeSignup, renderWelcome } = await import('@/server/welcome')
const { promoCodes, ruleOf } = await import('@/server/promo')
const { priceLines } = await import('@/lib/promotions')
const { WELCOME_GIFTS } = await import('@/config/promotions')

type Db = Awaited<ReturnType<typeof freshDb>>
let db: Db
const jobGift = async (email: string) => (await db.query<{ gift: string }>(`select payload->>'gift' as gift from jobs where dedupe_key = $1`, [`email.welcome:${email}`])).rows[0]?.gift

describe('the popup gift boxes', () => {
  beforeEach(async () => {
    db = await freshDb()
  })

  it('draws each of the three gifts, and only those', async () => {
    const seen = new Set<string>()
    for (let i = 0; i < 60; i++) seen.add((await db.tx((t) => drawGift(t))).gift)
    expect([...seen].sort()).toEqual(['lei100', 'p10', 'p1233'])
  })

  it('the email carries the gift of the opened box; a box is claimed once; no box means 10%', async () => {
    const box = await db.tx((t) => drawGift(t))
    await db.tx((t) => welcomeSignup(t, 'ana@exemplu.ro', '/', 'ro', 'ro', box.id))
    expect(await jobGift('ana@exemplu.ro')).toBe(box.gift)
    await db.tx((t) => welcomeSignup(t, 'ion@exemplu.ro', '/', 'ro', 'ro', box.id))
    expect(await jobGift('ion@exemplu.ro')).toBe('p10')
    await db.tx((t) => welcomeSignup(t, 'eva@exemplu.ro', '/', 'ro', 'ro', 'not-a-real-box-id'))
    expect(await jobGift('eva@exemplu.ro')).toBe('p10')
  })

  it('the codes exist and price as promised', async () => {
    const lei = (await promoCodes.get(db, WELCOME_GIFTS.lei100.code))!
    const pct = (await promoCodes.get(db, WELCOME_GIFTS.p1233.code))!
    expect([lei.kind, lei.value, pct.kind, pct.value]).toEqual(['fixed', 10000, 'percent', 12.33])
    // 100 lei off an Amber pair; never off the book.
    const amber = priceLines([{ key: 'a', productId: 'ochelari-biohack', variantId: 'cat-eye-negru', quantity: 1, unitAmount: 31500 }], [], ruleOf(lei), null)
    expect(amber.totalMinor).toBe(21500)
    const book = priceLines([{ key: 'b', productId: 'carte-diana', quantity: 1, unitAmount: 12000 }], [], ruleOf(lei), null)
    expect(book.totalMinor).toBe(12000)
    // 12,33% of NEUROS Calm (6.380 lei) = 786,65 lei, rounded half up.
    const calm = priceLines([{ key: 'c', productId: 'balance-wave', quantity: 1, unitAmount: 638000 }], [], ruleOf(pct), null)
    expect(calm.discountMinor).toBe(78665)
  })

  it('the email names the gift', () => {
    const m = renderWelcome({ siteUrl: 'https://biohack-tech.ro', unsubscribeUrl: 'https://biohack-tech.ro/dezabonare/x', code: 'CADOU100', gift: 'lei100' })
    expect(m.subject).toBe('Cadoul tău, 100 lei reducere: CADOU100')
    expect(m.text).toContain('mai puțin cartea')
  })
})
