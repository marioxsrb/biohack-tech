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
export type TbiPriceRules = { products: Record<string, TbiProductRules> }

export type TbiTerms = { annualPct: number; periods: number[]; min: number; max: number }
export const TBI_TERMS: TbiTerms = { annualPct: 21, periods: [6, 12, 18, 24, 36, 48, 60], min: 200, max: 30000 }

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

/** The indicative monthly instalment: an annuity at a fixed annual rate, rounded up to the leu. */
export function monthlyRate(amount: number, months: number, annualPct = TBI_TERMS.annualPct): number {
  if (!(amount > 0) || !(months > 0)) return 0
  const r = annualPct / 100 / 12
  return Math.ceil(r === 0 ? amount / months : (amount * r) / (1 - (1 + r) ** -months))
}

/** The longest period the amount allows (only amounts within min..max can be financed). */
export function longestPeriod(amount: number, terms: TbiTerms = TBI_TERMS): number | null {
  if (amount < terms.min || amount > terms.max || !terms.periods.length) return null
  return Math.max(...terms.periods)
}
