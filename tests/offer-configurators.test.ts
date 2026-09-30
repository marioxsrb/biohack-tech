/**
 * Offer wording at every quantity (NEUROS Amber 2+1 beyond 3, the 20%), the 3-product picker, and where
 * the pickers open from. Amounts come from the promotion engine; the server prices the order again.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bundleNeeds, bundleToLines, bundleTotals, pickComplete } from '@/lib/bundle-picks'
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

describe('20% for 3 products', () => {
  const P = { calm: 638000, focus: 79000, flow1: 1290000 }
  it('wording at 0, 1, 2, 3 eligible units', () => {
    const b = (lines: { productId: string; quantity: number; unitAmount: number }[]) => bundleCopy(promotionProgress(lines.map((l, i) => ({ key: String(i), ...l }))).find((p) => p.kind === 'bundle_percent') ?? null)
    expect(b([]).headline).toBe('Alege 3 produse. Primești 20% reducere.')
    expect(b([{ productId: 'balance-wave', quantity: 1, unitAmount: P.calm }]).headline).toBe('Mai alege 2 produse pentru 20% reducere.')
    expect(b([{ productId: 'balance-wave', quantity: 2, unitAmount: P.calm }]).headline).toBe('Mai alege 1 produs pentru 20% reducere.')
    expect(b([{ productId: 'balance-wave', quantity: 3, unitAmount: P.calm }])).toMatchObject({ tone: 'active', headline: 'Reducerea de 20% este activă.' })
  })

  it('asks only for the missing products: 0 → 3 slots, 1 → 2, 2 → 1, 3+ → none; Amber does not count', () => {
    expect(bundleNeeds([]).missing).toBe(3)
    expect(bundleNeeds([{ productId: 'balance-wave', quantity: 1 }, { productId: 'ochelari-biohack', quantity: 3 }]).missing).toBe(2)
    expect(bundleNeeds([{ productId: 'balance-wave', quantity: 1 }, { productId: 'brainlink-pro', quantity: 1 }]).missing).toBe(1)
    expect(bundleNeeds([{ productId: 'brain-flow', quantity: 4 }]).missing).toBe(0)
  })

  it('NEUROS Flow needs its configuration; nothing is chosen for the customer', () => {
    expect(pickComplete({ productId: 'brain-flow', variantId: null })).toBe(false)
    expect(pickComplete({ productId: 'brain-flow', variantId: '1-zona' })).toBe(true)
    expect(pickComplete({ productId: 'ochelari-biohack', variantId: 'cat-eye-bej' })).toBe(false)
    expect(bundleToLines([{ productId: 'balance-wave', variantId: null }, { productId: 'brain-flow', variantId: null }])).toBeNull()
  })

  it('same product more than once merges; Calm + Focus + NEUROS Flow 1 zone totals from the engine = server', () => {
    expect(bundleToLines([{ productId: 'brainlink-pro', variantId: null }, { productId: 'brainlink-pro', variantId: null }, { productId: 'brainlink-pro', variantId: null }])).toEqual([{ productId: 'brainlink-pro', quantity: 3 }])
    const picks = [
      { productId: 'balance-wave' as const, variantId: null },
      { productId: 'brainlink-pro' as const, variantId: null },
      { productId: 'brain-flow' as const, variantId: '1-zona' },
    ]
    const t = bundleTotals([], picks)
    const sub = P.calm + P.focus + P.flow1
    expect(t).toMatchObject({ subtotalMinor: sub, discountMinor: Math.floor((sub * 20 + 50) / 100), units: 3 })
    // With NEUROS Focus at 790 lei: 6.380 + 790 + 12.900 = 20.070 lei, − 20% (4.014 lei) = 16.056 lei.
    expect(t).toMatchObject({ subtotalMinor: 2007000, discountMinor: 401400, totalMinor: 1605600 })
    const server = resolveOrderLines(bundleToLines(picks))
    expect(server.ok && [server.subtotal, server.discount, server.total]).toEqual([t.subtotalMinor, t.discountMinor, t.totalMinor])
  })

  it('with products already in the cart the totals include them', () => {
    expect(bundleTotals([{ productId: 'balance-wave', quantity: 1 }, { productId: 'brainlink-pro', quantity: 1 }], [{ productId: 'brainlink-pro', variantId: null }])).toMatchObject({ units: 3, discountMinor: Math.floor(((P.calm + 2 * P.focus) * 20 + 50) / 100) })
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
  it('cart and checkout: the 20% completion opens the 3-product picker, Amber the pair picker', () => {
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
