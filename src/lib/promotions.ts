/**
 * Promotion engine. Pure and integer-only (bani), so the server and the browser compute exactly the
 * same result. The server is the only one whose result is charged: it runs this on the lines it priced
 * itself, and nothing the browser sends about discounts is read.
 *
 * Every discount is also split across the lines it came from (`lineDiscounts`), so an invoice that
 * lists line totals adds up to exactly what the customer paid.
 */
import { PROMOTIONS, type Promotion } from '@/config/promotions'

export type PricedLine = { key: string; productId: string; quantity: number; unitAmount: number }

export type AppliedPromotion = { id: string; label: string; amountMinor: number }

export type Pricing = {
  subtotalMinor: number
  discountMinor: number
  /** subtotal − discount; shipping is added by the order. */
  totalMinor: number
  promotions: AppliedPromotion[]
  /** Discount per line key; lines without a discount are absent. Sums to `discountMinor`. */
  lineDiscounts: Record<string, number>
  /** Line key → the promotion that discounted it (one per line: the rules never overlap). */
  linePromotion: Record<string, string>
}

/**
 * Splits `amount` over `weights` in proportion, in whole bani, so the parts always sum to `amount`
 * (largest remainder method, ties to the earlier line).
 */
export function allocate(amount: number, weights: number[]): number[] {
  const total = weights.reduce((s, w) => s + w, 0)
  if (!amount || !total) return weights.map(() => 0)
  const exact = weights.map((w) => (amount * w) / total)
  const parts = exact.map(Math.floor)
  let left = amount - parts.reduce((s, p) => s + p, 0)
  const order = exact.map((e, i) => [e - Math.floor(e), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1])
  for (const [, i] of order) {
    if (!left) break
    parts[i]++
    left--
  }
  return parts
}

/** p% of an amount in bani, rounded half up, integers only. */
export const percentOf = (amount: number, percent: number) => Math.floor((amount * percent + 50) / 100)

function applyOne(p: Promotion, lines: PricedLine[]): { amount: number; perLine: number[] } | null {
  const own = lines.filter((l) => (p.products as string[]).includes(l.productId))
  const units = own.reduce((n, l) => n + l.quantity, 0)
  if (p.kind === 'bundle_percent') {
    if (units < p.minUnits) return null
    const base = own.map((l) => l.unitAmount * l.quantity)
    const amount = percentOf(base.reduce((s, b) => s + b, 0), p.percent)
    return { amount, perLine: allocate(amount, base) }
  }
  // Buy X get Y: the free units are the cheapest ones, so the customer always gets the stated deal.
  const free = Math.floor(units / p.group) * (p.group - p.pay)
  if (!free) return null
  const order = own.map((l, i) => ({ i, unit: l.unitAmount, qty: l.quantity })).sort((a, b) => a.unit - b.unit || a.i - b.i)
  const perLine = own.map(() => 0)
  let remaining = free
  for (const o of order) {
    const take = Math.min(remaining, o.qty)
    perLine[o.i] += take * o.unit
    remaining -= take
    if (!remaining) break
  }
  return { amount: perLine.reduce((s, x) => s + x, 0), perLine }
}

export function priceLines(lines: PricedLine[], promotions: Promotion[] = PROMOTIONS): Pricing {
  const subtotalMinor = lines.reduce((s, l) => s + l.unitAmount * l.quantity, 0)
  const applied: AppliedPromotion[] = []
  const lineDiscounts: Record<string, number> = {}
  const linePromotion: Record<string, string> = {}
  for (const p of promotions) {
    const r = applyOne(p, lines)
    if (!r || !r.amount) continue
    applied.push({ id: p.id, label: p.label, amountMinor: r.amount })
    const own = lines.filter((l) => (p.products as string[]).includes(l.productId))
    own.forEach((l, i) => {
      if (!r.perLine[i]) return
      lineDiscounts[l.key] = (lineDiscounts[l.key] ?? 0) + r.perLine[i]
      linePromotion[l.key] = p.id
    })
  }
  const discountMinor = applied.reduce((s, a) => s + a.amountMinor, 0)
  return { subtotalMinor, discountMinor, totalMinor: subtotalMinor - discountMinor, promotions: applied, lineDiscounts, linePromotion }
}

export type PromotionHint = { id: string; text: string }

/**
 * What the customer can still unlock with the cart as it is, in plain words. Honest by construction:
 * computed from the same rules, no urgency, nothing when there is nothing to say.
 */
export function promotionHints(lines: Pick<PricedLine, 'productId' | 'quantity'>[], promotions: Promotion[] = PROMOTIONS): PromotionHint[] {
  const hints: PromotionHint[] = []
  for (const p of promotions) {
    const units = lines.filter((l) => (p.products as string[]).includes(l.productId)).reduce((n, l) => n + l.quantity, 0)
    if (p.kind === 'bundle_percent') {
      if (units === 0 || units >= p.minUnits) continue
      const missing = p.minUnits - units
      hints.push({
        id: p.id,
        text: `Mai adaugă ${missing === 1 ? 'un produs' : `${missing} produse`} NEUROS Calm, NEUROS Focus sau NEUROS Flow și primești ${p.percent}% reducere la toate.`,
      })
    } else {
      const inGroup = units % p.group
      if (units === 0 || inGroup < p.pay) continue
      hints.push({ id: p.id, text: 'Mai adaugă o pereche NEUROS Amber și o primești gratuit.' })
    }
  }
  return hints
}

/** Which promotion a product takes part in (for badges). */
export const promotionFor = (productId: string, promotions: Promotion[] = PROMOTIONS) => promotions.find((p) => (p.products as string[]).includes(productId))
