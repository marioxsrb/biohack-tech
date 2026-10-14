/**
 * Promotion engine. Pure and integer-only (bani), so the server and the browser compute exactly the
 * same result. The server is the only one whose result is charged: it runs this on the lines it priced
 * itself, and nothing the browser sends about discounts is read.
 *
 * Every discount is also split across the lines it came from (`lineDiscounts`), so an invoice that
 * lists line totals adds up to exactly what the customer paid.
 *
 * The quantity discount (bundle_percent) is counted per product: each eligible product is its own group,
 * applied under its own id (`trei-produse-20:balance-wave`), so 3 Calm + 2 Focus is 20% on the Calm
 * lines and 10% on the Focus lines, and an invoice line names the discount that lowered it.
 */
import { PROMOTIONS, type BundlePercent, type BundleTier, type Promotion } from '@/config/promotions'
import { getProduct } from '@/content/catalog'

export type PricedLine = { key: string; productId: string; quantity: number; unitAmount: number }

export type AppliedPromotion = { id: string; label: string; amountMinor: number }

/**
 * A promo code as the pricing needs it (validity, dates and usage are checked by the server before). It
 * applies after the automatic promotions, on what is left to pay for its eligible lines.
 *   percent: `value` percent (1–90) of that amount; fixed: `value` bani, at most that amount.
 *   products: the eligible products (null: all). minOrderMinor: the cart after automatic promotions must reach it.
 */
export type PromoCodeRule = { code: string; kind: 'percent' | 'fixed'; value: number; products: string[] | null; minOrderMinor: number }

/** The applied id of a promo code (`cod:VARA10`), and whether an applied id is one. */
export const codeId = (code: string) => `cod:${code}`
export const isCodeId = (id: string) => id.startsWith('cod:')

export type Pricing = {
  subtotalMinor: number
  discountMinor: number
  /** subtotal − discount; shipping is added by the order. */
  totalMinor: number
  promotions: AppliedPromotion[]
  /** Discount per line key; lines without a discount are absent. Sums to `discountMinor`. */
  lineDiscounts: Record<string, number>
  /** Line key → the automatic promotion that discounted it (one per line: the rules never overlap). */
  linePromotion: Record<string, string>
  /** Line key → the promo code's share of the line's discount (already included in `lineDiscounts`). */
  lineCodeDiscounts: Record<string, number>
  /** The code applied, or why it did not lower anything ('min_order' | 'no_products'). */
  code?: { code: string; amountMinor: number; problem?: 'min_order' | 'no_products' }
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

/** The top tier: the offer's headline (3 of the same product, 20%). */
export const topTier = (p: BundlePercent): BundleTier => p.tiers[p.tiers.length - 1]

/** Id of one product's group of a per-product promotion: `trei-produse-20:balance-wave`. */
export const groupId = (promotionId: string, productId: string) => `${promotionId}:${productId}`

/** The promotion an applied id belongs to (`trei-produse-20:balance-wave` → `trei-produse-20`). */
export const baseId = (appliedId: string) => appliedId.split(':')[0]

/** Everything one promotion saved, over all its product groups. */
export const savedBy = (applied: Pick<AppliedPromotion, 'id' | 'amountMinor'>[], promotionId: string) => applied.filter((a) => baseId(a.id) === promotionId).reduce((s, a) => s + a.amountMinor, 0)

const productName = (id: string) => getProduct(id)?.name ?? id

/** The eligible products in the cart, in cart order, each with its lines. */
function groups(p: Promotion, lines: PricedLine[]) {
  const by = new Map<string, PricedLine[]>()
  for (const l of lines) if ((p.products as string[]).includes(l.productId)) by.set(l.productId, [...(by.get(l.productId) ?? []), l])
  return [...by.entries()].map(([productId, own]) => ({ productId, own, units: own.reduce((n, l) => n + l.quantity, 0) }))
}

type Applied = { id: string; amount: number; own: PricedLine[]; perLine: number[]; label: string }

function applyOne(p: Promotion, lines: PricedLine[]): Applied[] {
  if (p.kind === 'bundle_percent') {
    return groups(p, lines).flatMap(({ productId, own, units }) => {
      const tier = tierFor(p, units)
      if (!tier) return []
      const base = own.map((l) => l.unitAmount * l.quantity)
      const amount = percentOf(base.reduce((s, b) => s + b, 0), tier.percent)
      return [{ id: groupId(p.id, productId), amount, own, perLine: allocate(amount, base), label: `${tier.label} ${productName(productId)}` }]
    })
  }
  const own = lines.filter((l) => (p.products as string[]).includes(l.productId))
  const units = own.reduce((n, l) => n + l.quantity, 0)
  // Buy X get Y: the free units are the cheapest ones, so the customer always gets the stated deal,
  // whatever the frames cost. That amount is then spread over the eligible lines in proportion to their
  // totals (like the percentage rule), so a mixed selection never leaves a line at 0 lei on the invoice.
  const free = Math.floor(units / p.group) * (p.group - p.pay)
  if (!free) return []
  const cheapest = own.flatMap((l) => Array.from({ length: l.quantity }, () => l.unitAmount)).sort((a, b) => a - b)
  const amount = cheapest.slice(0, free).reduce((s, x) => s + x, 0)
  return [{ id: p.id, amount, own, perLine: allocate(amount, own.map((l) => l.unitAmount * l.quantity)), label: p.label }]
}

export function priceLines(lines: PricedLine[], promotions: Promotion[] = PROMOTIONS, promo?: PromoCodeRule | null): Pricing {
  const subtotalMinor = lines.reduce((s, l) => s + l.unitAmount * l.quantity, 0)
  const applied: AppliedPromotion[] = []
  const lineDiscounts: Record<string, number> = {}
  const linePromotion: Record<string, string> = {}
  for (const p of promotions) {
    for (const r of applyOne(p, lines)) {
      if (!r.amount) continue
      applied.push({ id: r.id, label: r.label, amountMinor: r.amount })
      r.own.forEach((l, i) => {
        if (!r.perLine[i]) return
        lineDiscounts[l.key] = (lineDiscounts[l.key] ?? 0) + r.perLine[i]
        linePromotion[l.key] = r.id
      })
    }
  }
  const lineCodeDiscounts: Record<string, number> = {}
  let code: Pricing['code']
  if (promo) {
    // After the automatic promotions: what is left of each eligible line.
    const left = (l: PricedLine) => l.unitAmount * l.quantity - (lineDiscounts[l.key] ?? 0)
    const afterAuto = lines.reduce((s, l) => s + left(l), 0)
    const own = lines.filter((l) => !promo.products || promo.products.includes(l.productId))
    const base = own.map(left)
    const eligible = base.reduce((s, b) => s + b, 0)
    if (!own.length || !eligible) code = { code: promo.code, amountMinor: 0, problem: 'no_products' }
    else if (afterAuto < promo.minOrderMinor) code = { code: promo.code, amountMinor: 0, problem: 'min_order' }
    else {
      const amount = Math.min(eligible, promo.kind === 'percent' ? percentOf(eligible, Math.min(90, Math.max(0, promo.value))) : Math.max(0, promo.value))
      code = { code: promo.code, amountMinor: amount }
      if (amount) {
        applied.push({ id: codeId(promo.code), label: `Cod ${promo.code}`, amountMinor: amount })
        allocate(amount, base).forEach((part, i) => {
          if (!part) return
          lineDiscounts[own[i].key] = (lineDiscounts[own[i].key] ?? 0) + part
          lineCodeDiscounts[own[i].key] = part
        })
      }
    }
  }
  const discountMinor = applied.reduce((s, a) => s + a.amountMinor, 0)
  return { subtotalMinor, discountMinor, totalMinor: subtotalMinor - discountMinor, promotions: applied, lineDiscounts, linePromotion, lineCodeDiscounts, ...(code && { code }) }
}

export type PromotionHint = { id: string; text: string }

/**
 * What the customer can still unlock with the cart as it is, in plain words. Honest by construction:
 * computed from the same rules, no urgency, nothing when there is nothing to say.
 */
export function promotionHints(lines: Pick<PricedLine, 'productId' | 'quantity'>[], promotions: Promotion[] = PROMOTIONS): PromotionHint[] {
  const hints: PromotionHint[] = []
  for (const p of promotions) {
    if (p.kind === 'bundle_percent') {
      for (const g of groups(p, lines.map((l, i) => ({ ...l, key: String(i), unitAmount: 0 })))) {
        const next = nextTier(p, g.units)
        if (!next) continue
        const missing = next.minUnits - g.units
        hints.push({
          id: groupId(p.id, g.productId),
          text: `Mai adaugă ${missing === 1 ? 'încă un' : `încă ${missing}`} ${productName(g.productId)} și primești ${next.percent}% reducere la ${next.minUnits === 2 ? 'ambele' : next.minUnits === 3 ? 'toate trei' : `toate ${next.minUnits}`}.`,
        })
      }
    } else {
      const units = lines.filter((l) => (p.products as string[]).includes(l.productId)).reduce((n, l) => n + l.quantity, 0)
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
  /** The promotion id, or for the per-product discount the product group id (`trei-produse-20:balance-wave`). */
  id: string
  /** The product the group counts (per-product discount only). */
  productId?: string
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

export function promotionProgress(lines: PricedLine[], promotions: Promotion[] = PROMOTIONS): PromotionProgress[] {
  const pricing = priceLines(lines, promotions)
  const out: PromotionProgress[] = []
  for (const p of promotions) {
    const bundle = p.kind === 'bundle_percent'
    // One entry per product for the per-product discount, one for the whole promotion otherwise.
    const parts = bundle
      ? groups(p, lines).map((g) => ({ id: groupId(p.id, g.productId), productId: g.productId, products: [g.productId], units: g.units }))
      : [{ id: p.id, productId: undefined, products: p.products as string[], units: lines.filter((l) => (p.products as string[]).includes(l.productId)).reduce((n, l) => n + l.quantity, 0) }]
    for (const part of parts) {
      const { units } = part
      if (!units) continue
      const applied = pricing.promotions.find((a) => a.id === part.id)
      const saved = applied?.amountMinor ?? 0
      const target = bundle ? topTier(p).minUnits : p.group
      const missing = bundle ? Math.max(0, target - units) : units % p.group >= p.pay ? p.group - (units % p.group) : 0
      const active = saved > 0
      const state = missing === 1 ? 'close' : active ? 'active' : 'far'
      const freeUnits = bundle ? 0 : Math.floor(units / p.group) * (p.group - p.pay)
      const next = bundle ? nextTier(p, units) : null
      const untilNext = bundle ? (next ? next.minUnits - units : 0) : p.group - (units % p.group)
      const percent = bundle ? (tierFor(p, units)?.percent ?? 0) : 0
      out.push({ id: part.id, productId: part.productId, kind: p.kind, label: applied?.label ?? p.label, products: part.products, units, missing: missing || (active ? 0 : target - (units % target)), target, active, savedMinor: saved, state, freeUnits, untilNext, percent, nextPercent: next?.percent ?? 0 })
    }
  }
  return out
}
