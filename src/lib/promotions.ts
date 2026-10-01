/**
 * Promotion engine. Pure and integer-only (bani), so the server and the browser compute exactly the
 * same result. The server is the only one whose result is charged: it runs this on the lines it priced
 * itself, and nothing the browser sends about discounts is read.
 *
 * Every discount is also split across the lines it came from (`lineDiscounts`), so an invoice that
 * lists line totals adds up to exactly what the customer paid.
 */
import { PROMOTIONS, type BundlePercent, type BundleTier, type Promotion } from '@/config/promotions'

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

/** The highest tier `units` reaches, or null below the first one. */
export const tierFor = (p: BundlePercent, units: number): BundleTier | null => [...p.tiers].reverse().find((t) => units >= t.minUnits) ?? null

/** The tier after `units` (what one or more units would unlock), or null once the top tier applies. */
export const nextTier = (p: BundlePercent, units: number): BundleTier | null => p.tiers.find((t) => units < t.minUnits) ?? null

/** The top tier: the offer's headline (3 products, 20%). */
export const topTier = (p: BundlePercent): BundleTier => p.tiers[p.tiers.length - 1]

function applyOne(p: Promotion, lines: PricedLine[]): { amount: number; perLine: number[]; label: string } | null {
  const own = lines.filter((l) => (p.products as string[]).includes(l.productId))
  const units = own.reduce((n, l) => n + l.quantity, 0)
  if (p.kind === 'bundle_percent') {
    const tier = tierFor(p, units)
    if (!tier) return null
    const base = own.map((l) => l.unitAmount * l.quantity)
    const amount = percentOf(base.reduce((s, b) => s + b, 0), tier.percent)
    return { amount, perLine: allocate(amount, base), label: tier.label }
  }
  // Buy X get Y: the free units are the cheapest ones, so the customer always gets the stated deal,
  // whatever the frames cost. That amount is then spread over the eligible lines in proportion to their
  // totals (like the percentage rule), so a mixed selection never leaves a line at 0 lei on the invoice.
  const free = Math.floor(units / p.group) * (p.group - p.pay)
  if (!free) return null
  const cheapest = own.flatMap((l) => Array.from({ length: l.quantity }, () => l.unitAmount)).sort((a, b) => a - b)
  const amount = cheapest.slice(0, free).reduce((s, x) => s + x, 0)
  return { amount, perLine: allocate(amount, own.map((l) => l.unitAmount * l.quantity)), label: p.label }
}

export function priceLines(lines: PricedLine[], promotions: Promotion[] = PROMOTIONS): Pricing {
  const subtotalMinor = lines.reduce((s, l) => s + l.unitAmount * l.quantity, 0)
  const applied: AppliedPromotion[] = []
  const lineDiscounts: Record<string, number> = {}
  const linePromotion: Record<string, string> = {}
  for (const p of promotions) {
    const r = applyOne(p, lines)
    if (!r || !r.amount) continue
    applied.push({ id: p.id, label: r.label, amountMinor: r.amount })
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
      const next = nextTier(p, units)
      if (units === 0 || !next) continue
      const missing = next.minUnits - units
      hints.push({
        id: p.id,
        text: `Mai adaugă ${missing === 1 ? 'un produs' : `${missing} produse`} NEUROS Calm, NEUROS Focus sau NEUROS Flow și primești ${next.percent}% reducere la toate.`,
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

/**
 * Where the cart stands for each promotion, for the progress UI:
 *   active  the promotion applies now (with what it saves);
 *   close   one more unit unlocks it (or, for 2+1, the next free unit);
 *   far     the customer has started but needs more than one unit.
 * A promotion the cart has nothing to do with is left out. Same rules as priceLines.
 */
export type PromotionProgress = {
  id: string
  kind: Promotion['kind']
  label: string
  products: string[]
  /** Eligible units in the cart. */
  units: number
  /** Units still needed for the next reward (0 when nothing more is needed). */
  missing: number
  /** The target the progress counts towards (3 for both current rules). */
  target: number
  active: boolean
  savedMinor: number
  state: 'active' | 'close' | 'far'
  /** 2+1: free units already earned (3 → 1, 6 → 2, 9 → 3...). 0 for the percentage rule. */
  freeUnits: number
  /** Percentage rule: the percent applied now (0 below the first tier) and the next tier's percent (0 at the top). */
  percent: number
  nextPercent: number
  /** Units until the next reward: the next percentage tier (0 at the top), or the next free unit of 2+1 (never 0 for 2+1). */
  untilNext: number
}

const pricingLabel = (pricing: Pricing, p: Promotion) => pricing.promotions.find((a) => a.id === p.id)?.label ?? p.label

export function promotionProgress(lines: PricedLine[], promotions: Promotion[] = PROMOTIONS): PromotionProgress[] {
  const pricing = priceLines(lines, promotions)
  const out: PromotionProgress[] = []
  for (const p of promotions) {
    const units = lines.filter((l) => (p.products as string[]).includes(l.productId)).reduce((n, l) => n + l.quantity, 0)
    if (!units) continue
    const saved = pricing.promotions.find((a) => a.id === p.id)?.amountMinor ?? 0
    const bundle = p.kind === 'bundle_percent'
    const target = bundle ? topTier(p).minUnits : p.group
    const missing = bundle ? Math.max(0, target - units) : units % p.group >= p.pay ? p.group - (units % p.group) : 0
    const active = saved > 0
    const state = missing === 1 ? 'close' : active ? 'active' : 'far'
    const freeUnits = bundle ? 0 : Math.floor(units / p.group) * (p.group - p.pay)
    const next = bundle ? nextTier(p, units) : null
    const untilNext = bundle ? (next ? next.minUnits - units : 0) : p.group - (units % p.group)
    const percent = bundle ? (tierFor(p, units)?.percent ?? 0) : 0
    const label = pricingLabel(pricing, p)
    out.push({ id: p.id, kind: p.kind, label, products: p.products, units, missing: missing || (active ? 0 : target - (units % target)), target, active, savedMinor: saved, state, freeUnits, untilNext, percent, nextPercent: next?.percent ?? 0 })
  }
  return out
}
