/**
 * The store's currencies. Prices are set in lei (config/prices.ts, /admin/setari); euro and dollar prices are the
 * lei price converted at the National Bank of Romania's rate and rounded to a whole euro or dollar, per unit,
 * so a product always has a clean price (€1,195, $1,341). Promotions and codes are then computed in that
 * currency by the same engine, on the browser and on the server alike, so the total shown is the total charged.
 *
 * Romanian pages are always in lei; English pages offer euro (default) or dollar. Shared by server and browser,
 * dependency-free.
 */
export const CURRENCIES = ['RON', 'EUR', 'USD'] as const
export type Currency = (typeof CURRENCIES)[number]
export type ForeignCurrency = Exclude<Currency, 'RON'>
export const isCurrency = (v: unknown): v is Currency => typeof v === 'string' && (CURRENCIES as readonly string[]).includes(v)
export const isForeign = (c: Currency): c is ForeignCurrency => c !== 'RON'

/** Lei for one unit of each foreign currency (BNR), and the day they were published. */
export type Rates = { EUR: number; USD: number; date: string }

/** Used only until the first BNR rate is loaded (15.10.2026 values); every real conversion uses fetched rates. */
export const FALLBACK_RATES: Rates = { EUR: 5.337, USD: 4.7571, date: '2026-10-15' }

let current: Rates = FALLBACK_RATES
/** The rates in force (set from the store settings on the server and from the page in the browser). */
export const rates = () => current
export function setRates(r: Partial<Rates> | null | undefined) {
  if (r && validRate(r.EUR) && validRate(r.USD)) current = { EUR: r.EUR, USD: r.USD, date: typeof r.date === 'string' ? r.date : current.date }
}
const validRate = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0.5 && n < 50

/** A unit price in lei (bani) as a whole euro or dollar amount (cents), rounded to the nearest unit. */
export function convertUnit(bani: number, to: Currency, r: Rates = current): number {
  if (to === 'RON') return bani
  return Math.max(1, Math.round(bani / 100 / r[to])) * 100
}

/** Any amount in lei (bani) in another currency (cents), to the cent: fixed promo values, minimum orders. */
export function convertAmount(bani: number, to: Currency, r: Rates = current): number {
  return to === 'RON' ? bani : Math.round(bani / r[to])
}

/** Lei for one unit of the currency (1 for lei): stored on each order, for reports and the invoice. */
export const rateFor = (c: Currency, r: Rates = current) => (c === 'RON' ? 1 : r[c])

export const SYMBOL: Record<Currency, string> = { RON: 'lei', EUR: '€', USD: '$' }

const fmtCache = new Map<string, Intl.NumberFormat>()
const nf = (locale: string, frac: number) => {
  const key = `${locale}:${frac}`
  let f = fmtCache.get(key)
  if (!f) fmtCache.set(key, (f = new Intl.NumberFormat(locale, { useGrouping: 'always', minimumFractionDigits: frac, maximumFractionDigits: frac })))
  return f
}

/**
 * "6.380 lei" (Romanian convention), "€1,195" / "$1,341" (symbol first, English grouping). Cents only when the
 * amount has them (a promotion share can).
 */
export function formatMoney(minor: number, currency: Currency): string {
  const value = minor / 100
  const frac = Number.isInteger(value) ? 0 : 2
  if (currency === 'RON') return `${nf('ro-RO', frac).format(value)} lei`
  const sign = value < 0 ? '−' : ''
  return `${sign}${SYMBOL[currency]}${nf('en-GB', frac).format(Math.abs(value))}`
}

/** A promo code's lei amounts (fixed value, minimum order) in another currency; percent codes stay as they are. */
export function ruleIn<R extends { kind: 'percent' | 'fixed'; value: number; minOrderMinor: number }>(r: R, c: Currency): R {
  if (c === 'RON') return r
  return { ...r, value: r.kind === 'fixed' ? convertAmount(r.value, c) : r.value, minOrderMinor: convertAmount(r.minOrderMinor, c) }
}

/** Payment methods per currency and country: lei in Romania can use all of them; anything else pays by card. */
export const cardOnly = (currency: Currency, country: string) => currency !== 'RON' || country !== 'RO'

// The browser reads the rates the page carries (window.__BT_STORE__, set before any script by the root layout).
if (typeof window !== 'undefined') setRates((window as unknown as { __BT_STORE__?: { fx?: Partial<Rates> } }).__BT_STORE__?.fx)
