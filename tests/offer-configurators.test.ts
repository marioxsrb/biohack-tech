/**
 * Offer wording at every quantity (NEUROS Amber 2+1 beyond 3, the 20%), the 3-product picker, and where
 * the pickers open from. Amounts come from the promotion engine; the server prices the order again.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bundleToLines, bundleTotals, pickComplete, unitsInCart } from '@/lib/bundle-picks'
import { amberCopy, bundleCopy } from '@/lib/offer-copy'
import { resolveOrderLines } from '@/lib/orders/resolve'
import { promotionProgress } from '@/lib/promotions'

const AMBER = 31500
const amber = (n: number) => promotionProgress([{ key: 'a', productId: 'ochelari-biohack', quantity: n, unitAmount: AMBER }]).find((p) => p.kind === 'buy_x_get_y') ?? null

describe('NEUROS Amber 2+1 at any quantity', () => {
  it('free pairs, saving and next step: 3 → 1, 6 → 2, 9 → 3', () => {
    const rows = [0, 1, 2, 3, 4, 5, 6, 8, 9].map((n) => {
      const p = amber(n)
      return [n, p?.freeUnits ?? 0, p?.savedMinor ?? 0, p?.untilNext ?? 3]
    })
    expect(rows).toEqual([
      [0, 0, 0, 3],
      [1, 0, 0, 2],
      [2, 0, 0, 1],
      [3, 1, AMBER, 3],
      [4, 1, AMBER, 2],
      [5, 1, AMBER, 1],
      [6, 2, 2 * AMBER, 3],
      [8, 2, 2 * AMBER, 1],
      [9, 3, 3 * AMBER, 3],
    ])
  })

  it('wording: progress before the first pair, calm once earned, a visible prompt only one pair away (2, 5, 8)', () => {
    const c = (n: number) => amberCopy(amber(n))
    expect(c(0)).toMatchObject({ tone: 'discover', headline: 'Alege 3 perechi. Plătești 2.' })
    expect(c(1)).toMatchObject({ tone: 'progress', headline: 'Mai alege 2 perechi pentru 2+1.' })
    expect(c(2)).toMatchObject({ tone: 'progress', headline: 'Mai alege 1 pereche. A treia este gratuită.' })
    expect(c(3)).toEqual({ tone: 'active', headline: '2+1 activ', detail: 'Economisești 315 lei.' })
    expect(c(4)).toMatchObject({ tone: 'active', headline: '2+1 activ', quiet: 'Încă 2 perechi până la următoarea pereche gratuită.' })
    expect(c(4).nudge).toBeUndefined()
    expect(c(5)).toMatchObject({ tone: 'active', nudge: 'Mai adaugă 1 pereche și primești încă una gratuită.' })
    expect(c(6)).toEqual({ tone: 'active', headline: '2 perechi gratuite', detail: 'Economisești 630 lei.' })
    expect(c(8)).toMatchObject({ headline: '2 perechi gratuite', nudge: 'Mai adaugă 1 pereche și primești încă una gratuită.' })
    expect(c(9)).toEqual({ tone: 'active', headline: '3 perechi gratuite', detail: 'Economisești 945 lei.' })
  })
})

describe('quantity discount, per product', () => {
  const P = { calm: 638000, focus: 180000 }
  it('wording at 0, 1, 2, 3 eligible units', () => {
    const b = (lines: { productId: string; quantity: number; unitAmount: number }[]) => bundleCopy(promotionProgress(lines.map((l, i) => ({ key: String(i), ...l }))).find((p) => p.kind === 'bundle_percent') ?? null)
    expect(b([]).headline).toBe('Iei 2 bucăți din același produs: 10% reducere. Iei 3: 20%.')
    expect(b([{ productId: 'balance-wave', quantity: 1, unitAmount: P.calm }]).headline).toBe('Mai adaugă încă un NEUROS Calm și primești 10% la ambele.')
    expect(b([{ productId: 'balance-wave', quantity: 2, unitAmount: P.calm }])).toMatchObject({ tone: 'active', headline: 'Reducerea de 10% la NEUROS Calm este activă.', nudge: 'Mai adaugă încă un NEUROS Calm și primești 20% la toate trei.' })
    expect(b([{ productId: 'balance-wave', quantity: 3, unitAmount: P.calm }])).toMatchObject({ tone: 'active', headline: 'Reducerea de 20% la NEUROS Calm este activă.' })
  })

  it('a pick is one product and a quantity; nothing is chosen for the customer', () => {
    expect(pickComplete({ productId: 'balance-wave', variantId: null, quantity: 3 })).toBe(true)
    expect(pickComplete({ productId: 'ochelari-biohack', variantId: 'cat-eye-bej', quantity: 3 })).toBe(false)
    expect(pickComplete({ productId: 'balance-wave', variantId: null, quantity: 0 })).toBe(false)
    expect(bundleToLines({ productId: 'brainlink-pro', variantId: null, quantity: 3 })).toEqual([{ productId: 'brainlink-pro', quantity: 3 }])
  })

  it('units already in the cart count; other products never do', () => {
    const cart = [{ productId: 'balance-wave', quantity: 1 }, { productId: 'brainlink-pro', quantity: 2 }]
    expect(unitsInCart(cart, 'balance-wave')).toBe(1)
    const t = bundleTotals(cart, { productId: 'balance-wave', variantId: null, quantity: 2 })
    // 3 Calm: 19.140 lei − 20% (3.828 lei) = 15.312 lei. The Focus in the cart is not part of this offer's totals.
    expect(t).toMatchObject({ units: 3, percent: 20, subtotalMinor: 1914000, discountMinor: 382800, totalMinor: 1531200 })
  })

  it('picker totals = server totals (3 NEUROS Focus)', () => {
    const pick = { productId: 'brainlink-pro' as const, variantId: null, quantity: 3 }
    const t = bundleTotals([], pick)
    expect(t).toMatchObject({ subtotalMinor: 3 * P.focus, discountMinor: Math.floor((3 * P.focus * 20 + 50) / 100), units: 3 })
    const server = resolveOrderLines(bundleToLines(pick)!)
    expect(server.ok && [server.subtotal, server.discount, server.total]).toEqual([t.subtotalMinor, t.discountMinor, t.totalMinor])
  })
})

describe('where the pickers open', () => {
  const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')
  it('homepage: both offer images and both buttons open their picker (never a product page)', () => {
    const src = read('src/components/home/Offers.tsx')
    expect(src.match(/<OfferTrigger offer="bundle"/g)?.length).toBe(2)
    expect(src.match(/<OfferTrigger offer="amber"/g)?.length).toBe(2)
    expect(src).not.toMatch(/productHref\(amberProduct\)/)
  })
  it('cart and checkout: the bundle picker and the Amber pair picker are wired', () => {
    const src = read('src/components/offers/Suggestions.tsx')
    expect(src).toContain("if (r.add === 'bundle') return openBundle(placement)")
    expect(src).toContain("if (r.add === 'amber_pairs') return openAmber(placement, r.slots ?? 3)")
  })
})

describe('copy', () => {
  const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]))
  it('no generic filler anywhere in the customer-facing app', () => {
    const text = files(join(process.cwd(), 'src')).filter((f) => /\.(tsx?|md)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n')
    for (const bad of ['Mai vrei și ceva', 'Produse care ți-ar putea plăcea', 'Nu rata', 'Oferta perfectă']) expect(text).not.toContain(bad)
  })
})
