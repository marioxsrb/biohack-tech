/**
 * "Cumpără în rate prin tbi bank" on the Shopify store (biohack-tech.ro, theme assets/bt-tbi.js).
 * TBI gives no API yet: the site only collects the request, a colleague calls within 24 hours and sends the TBI link.
 * This file is the request's shape and validation, shared by the route and the tests. Amounts are lei.
 * A request is a basket (Calm, Focus, Amber, 1–10 pieces each), a period and an optional down payment;
 * the server values the basket itself (lib/tbi.ts), the browser's total is only a fallback.
 */
import { TBI_TERMS, type TbiItem } from '@/lib/tbi'

export const RATE_TBI_PRODUCTS = {
  calm: { title: 'NEUROS Calm', short: 'Calm', normalLei: 6380 },
  focus: { title: 'NEUROS Focus', short: 'Focus', normalLei: 3225 },
  amber: { title: 'NEUROS Amber', short: 'Amber', normalLei: 315 },
} as const
export type RateTbiProduct = keyof typeof RATE_TBI_PRODUCTS

export const RATE_TBI_MAX_QTY = 10

export type RateTbiRequest = {
  name: string
  firstName: string
  phone: string
  email: string
  items: { handle: RateTbiProduct; qty: number }[]
  /** Months the customer would like (one of TBI_TERMS.periods). */
  period: number
  /** Down payment in lei (0 when none). */
  advance: number
  city: string | null
  /** The total the page showed, in lei: used only when the store's prices cannot be read. */
  clientTotal: number | null
  page: string | null
  utm: Record<string, string>
  /** The browser pixel's event id, so Meta counts the Lead once (browser + Conversions API). */
  eventId: string
  /** Shopify's marketing consent at the moment of the request: the Conversions API Lead is sent only with it. */
  marketing: boolean
  fbp: string | null
  fbc: string | null
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const UTM_KEYS = ['source', 'medium', 'campaign', 'content', 'term'] as const

/** A Romanian mobile number as +407XXXXXXXX, or null. Accepts 07…, +407…, 00407…, with spaces, dots or dashes. */
export function normalizeRoMobile(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let d = raw.replace(/[\s.\-()]/g, '')
  if (d.startsWith('+40')) d = d.slice(3)
  else if (d.startsWith('0040')) d = d.slice(4)
  else if (d.startsWith('40') && d.length === 11) d = d.slice(2)
  else if (d.startsWith('0')) d = d.slice(1)
  return /^7\d{8}$/.test(d) ? `+40${d}` : null
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

/**
 * A total the browser sent is believable when it lies between 40% of the full price (the deepest
 * Black Friday step with every discount) and the full price.
 */
export function plausibleValue(items: TbiItem[], valueLei: number): boolean {
  const full = items.reduce((s, i) => s + (RATE_TBI_PRODUCTS[i.handle as RateTbiProduct]?.normalLei ?? 0) * i.qty, 0)
  return Number.isFinite(valueLei) && full > 0 && valueLei >= full * 0.4 && valueLei <= full
}

export type RateTbiParse = { ok: true; request: RateTbiRequest } | { ok: false; fields: Record<string, string> }

function parseItems(body: Record<string, unknown>): { handle: RateTbiProduct; qty: number }[] | null {
  // The first version of the form sent one product: { product, qty }.
  const raw = Array.isArray(body.items) ? body.items : typeof body.product === 'string' ? [{ handle: body.product, qty: body.qty }] : null
  if (!raw || raw.length < 1 || raw.length > Object.keys(RATE_TBI_PRODUCTS).length) return null
  const seen = new Set<string>()
  const out: { handle: RateTbiProduct; qty: number }[] = []
  for (const r of raw) {
    const h = r && typeof r === 'object' ? (r as Record<string, unknown>).handle : null
    const qty = Number(r && typeof r === 'object' ? (r as Record<string, unknown>).qty : NaN)
    if (typeof h !== 'string' || !(h in RATE_TBI_PRODUCTS) || seen.has(h)) return null
    if (!Number.isInteger(qty) || qty < 1 || qty > RATE_TBI_MAX_QTY) return null
    seen.add(h)
    out.push({ handle: h as RateTbiProduct, qty })
  }
  return out
}

export function parseRateTbi(body: Record<string, unknown>): RateTbiParse {
  const fields: Record<string, string> = {}
  const name = text(body.name, 80)
  if (name.length < 3 || !/\p{L}/u.test(name)) fields.name = 'Scrie numele complet.'
  const phone = normalizeRoMobile(body.phone)
  if (!phone) fields.phone = 'Scrie un număr de mobil din România, de exemplu 07xx xxx xxx.'
  const email = text(body.email, 120).toLowerCase()
  if (!EMAIL.test(email)) fields.email = 'Scrie o adresă de email validă.'
  const items = parseItems(body)
  if (!items) fields.items = `Alege cel puțin un produs, între 1 și ${RATE_TBI_MAX_QTY} bucăți.`
  if (body.consent !== true) fields.consent = 'Bifează acordul ca să trimitem cererea.'
  const period = body.period === undefined || body.period === null || body.period === '' ? 24 : Number(body.period)
  if (!TBI_TERMS.periods.includes(period)) fields.period = 'Alege perioada.'
  const advance = body.advance === undefined || body.advance === null || body.advance === '' ? 0 : Math.round(Number(body.advance))
  if (!Number.isFinite(advance) || advance < 0 || advance > 100000) fields.advance = 'Avansul nu este valid.'
  const rawTotal = body.total ?? body.value
  const clientTotal = rawTotal === undefined || rawTotal === null || rawTotal === '' ? null : Math.round(Number(rawTotal) * 100) / 100
  if (Object.keys(fields).length || !items || !phone) return { ok: false, fields }

  const utm: Record<string, string> = {}
  const rawUtm = body.utm && typeof body.utm === 'object' ? (body.utm as Record<string, unknown>) : {}
  for (const k of UTM_KEYS) {
    const v = text(rawUtm[k], 100)
    if (v) utm[k] = v
  }
  const page = typeof body.page === 'string' && /^\/[\w\-/.%]{0,160}$/.test(body.page) ? body.page : null
  const eventId = typeof body.eventId === 'string' && /^[\w-]{8,64}$/.test(body.eventId) ? body.eventId : `tbi-${crypto.randomUUID()}`
  const cookie = (v: unknown) => (typeof v === 'string' && /^fb\.\d+\.\d+\.[\w-]{1,120}$/.test(v) ? v : null)
  return {
    ok: true,
    request: {
      name,
      firstName: name.split(' ')[0],
      phone,
      email,
      items,
      period,
      advance,
      city: text(body.city, 60) || null,
      clientTotal: clientTotal !== null && Number.isFinite(clientTotal) ? clientTotal : null,
      page,
      utm,
      eventId,
      marketing: body.marketing === true,
      fbp: cookie(body.fbp),
      fbc: cookie(body.fbc),
    },
  }
}

/** 6240 → "6.240", 3227.5 → "3.227,50" (the Romanian way the team types it). */
export function lei(value: number): string {
  const [i, d] = value.toFixed(2).split('.')
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return d === '00' ? int : `${int},${d}`
}
