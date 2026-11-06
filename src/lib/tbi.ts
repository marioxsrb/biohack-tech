/**
 * "Cumpără în rate prin tbi bank": the prices a basket really costs on the Shopify store and the indicative
 * monthly instalment. The store publishes its price rules at /products/calm?view=tbi-data (theme template
 * product.tbi-data.liquid); the theme's simulator (assets/bt-tbi.js) applies the same rules in the browser,
 * the server applies them here, so a request is always valued with the store's prices, never the browser's.
 * Amounts in lei unless the name says otherwise (Shopify prices are in bani).
 */

export type TbiProductRules = {
  title: string
  /** The product price in bani (what Shopify shows without discounts). */
  price: number
  /** Calm: the Black Friday ladder (metafield biohack.bf_scara). */
  ladder?: TbiLadder | null
  /** A unit price in bani applied between two moments (Unix seconds), e.g. Focus −500 lei in Black Friday. */
  bf?: { unit: number; from: number; to: number } | null
  /** Buy X get Y free (Amber 2+2 in Black Friday, then 2+1), each window in Unix seconds. */
  deals?: { buy: number; get: number; from: number; to: number }[]
  /** 10% at 2 and 20% from 3 pieces of the same product (Calm, Focus). */
  tiers?: boolean
}
export type TbiLadder = {
  utc_offset?: string
  reduceri_cantitate?: Record<string, number>
  etape?: { de_la: string; pana_la: string; pret: number }[]
  bf_2plus?: { min?: number; pct?: number }
}

/**
 * tbi bank's terms (Setări temă → Rate TBI, published with the price rules): fixed annual interest, the analysis fee
 * and the life insurance (a share of the credit per month) that tbi adds to the financed amount, the periods, the
 * amounts it finances and the longest period by amount ([from lei, max months], ascending).
 * Since 6 Nov 2026 the store shows TBI's own quotes (/api/tbi/calculations); these terms are only the estimate used when
 * TBI does not answer, and for the indicative instalment in the GHL note (29% and 95 lei, like TBI's "Promo 0" scheme).
 */
export type TbiTerms = {
  annualPct: number
  commission: number
  insurancePct: number
  includeCosts: boolean
  periods: number[]
  min: number
  max: number
  limits: [number, number][]
}
export const TBI_TERMS: TbiTerms = {
  annualPct: 29,
  commission: 95,
  insurancePct: 0.532,
  includeCosts: true,
  periods: [6, 12, 18, 24, 36, 48, 60],
  min: 200,
  max: 30000,
  limits: [
    [0, 12],
    [1000, 36],
    [3000, 60],
  ],
}
export type TbiPriceRules = { products: Record<string, TbiProductRules>; terms?: Partial<TbiTerms> }
/** The store's terms over the defaults (a missing or malformed value keeps the default). */
export function tbiTerms(t?: Partial<TbiTerms> | null): TbiTerms {
  const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d)
  const periods = Array.isArray(t?.periods) && t.periods.every((p) => Number.isInteger(p) && p > 0) && t.periods.length ? [...t.periods].sort((a, b) => a - b) : TBI_TERMS.periods
  const limits = Array.isArray(t?.limits) && t.limits.every((l) => Array.isArray(l) && l.length === 2 && l.every((x) => Number.isFinite(x))) ? [...t.limits].sort((a, b) => a[0] - b[0]) : TBI_TERMS.limits
  return {
    annualPct: n(t?.annualPct, TBI_TERMS.annualPct),
    commission: n(t?.commission, TBI_TERMS.commission),
    insurancePct: n(t?.insurancePct, TBI_TERMS.insurancePct),
    includeCosts: typeof t?.includeCosts === 'boolean' ? t.includeCosts : TBI_TERMS.includeCosts,
    periods,
    min: n(t?.min, TBI_TERMS.min),
    max: n(t?.max, TBI_TERMS.max),
    limits,
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100

/** The ladder step running at `now` (the dates are local time with the ladder's UTC offset). */
export function ladderStep(l: TbiLadder | null | undefined, now: number) {
  if (!l?.etape) return null
  const off = (l.utc_offset ?? '+0200').replace(/^([+-]\d\d)(\d\d)$/, '$1:$2')
  return l.etape.find((e) => {
    const a = Date.parse(`${e.de_la.replace(' ', 'T')}:00${off}`)
    const b = Date.parse(`${e.pana_la.replace(' ', 'T')}:59${off}`) + 1000
    return now >= a && now < b
  }) ?? null
}

/** What `qty` pieces of one product cost now, in lei, the way the store's cart prices them. */
export function lineTotal(rules: TbiPriceRules, handle: string, qty: number, now = Date.now()): number | null {
  const p = rules.products[handle]
  if (!p || !Number.isInteger(qty) || qty < 1) return null
  const t = now / 1000
  const price = p.price / 100
  if (p.ladder) {
    const st = ladderStep(p.ladder, now)
    if (st) {
      const b2 = p.ladder.bf_2plus ?? {}
      return round2(st.pret * (qty >= (b2.min ?? 2) ? 100 - (b2.pct ?? 0) : 100) / 100 * qty)
    }
    const rc = p.ladder.reduceri_cantitate ?? { 2: 10, 3: 20 }
    const pct = qty >= 3 ? (rc['3'] ?? 20) : qty === 2 ? (rc['2'] ?? 10) : 0
    return round2((price * (100 - pct)) / 100 * qty)
  }
  let unit = price
  if (p.tiers) unit = (price * (100 - (qty >= 3 ? 20 : qty === 2 ? 10 : 0))) / 100
  if (p.bf && t >= p.bf.from && t < p.bf.to && p.bf.unit / 100 < unit) unit = p.bf.unit / 100
  const deal = p.deals?.find((d) => t >= d.from && t < d.to)
  const paid = deal ? qty - deal.get * Math.floor(qty / (deal.buy + deal.get)) : qty
  return round2(unit * paid)
}

export type TbiItem = { handle: string; qty: number }
export type TbiQuoteLine = TbiItem & { title: string; total: number; unit: number }

/** The basket's lines and total (null when a product is unknown). */
export function quote(rules: TbiPriceRules, items: TbiItem[], now = Date.now()) {
  const lines: TbiQuoteLine[] = []
  for (const it of items) {
    const total = lineTotal(rules, it.handle, it.qty, now)
    if (total === null) return null
    lines.push({ ...it, title: rules.products[it.handle].title, total, unit: round2(total / it.qty) })
  }
  return { lines, total: round2(lines.reduce((s, l) => s + l.total, 0)) }
}

/** The periods tbi offers for an amount (the longest allowed by `limits`; at least the shortest period). */
export function allowedPeriods(amount: number, terms: TbiTerms = TBI_TERMS): number[] {
  let max = Infinity
  for (const [from, months] of terms.limits) if (amount >= from) max = months
  const ok = terms.periods.filter((p) => p <= max)
  return ok.length ? ok : [Math.min(...terms.periods)]
}

export type TbiInstalment = { credit: number; costs: number; exact: number; monthly: number; total: number }

/**
 * The indicative instalment: the credit (amount minus down payment) plus the analysis fee and the insurance
 * (credit × insurance % × months), as an annuity at the fixed annual rate. `exact` is unrounded; `monthly` is
 * rounded up to the leu and `total` = monthly × months (what the page shows).
 */
export function instalment(credit: number, months: number, terms: TbiTerms = TBI_TERMS): TbiInstalment {
  if (!(credit > 0) || !(months > 0)) return { credit: 0, costs: 0, exact: 0, monthly: 0, total: 0 }
  const costs = terms.includeCosts ? terms.commission + (credit * terms.insurancePct * months) / 100 : 0
  const p = credit + costs
  const r = terms.annualPct / 100 / 12
  const exact = r === 0 ? p / months : (p * r) / (1 - (1 + r) ** -months)
  const monthly = Math.ceil(exact - 1e-9)
  return { credit, costs: Math.round(costs * 100) / 100, exact, monthly, total: monthly * months }
}

/** The monthly instalment rounded up to the leu (instalment().monthly). */
export const monthlyRate = (amount: number, months: number, terms: TbiTerms = TBI_TERMS) => instalment(amount, months, terms).monthly

/** The longest period the amount allows (only amounts within min..max can be financed). */
export function longestPeriod(amount: number, terms: TbiTerms = TBI_TERMS): number | null {
  if (amount < terms.min || amount > terms.max) return null
  return Math.max(...allowedPeriods(amount, terms))
}
