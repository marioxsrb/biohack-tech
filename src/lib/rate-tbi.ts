/**
 * "Cumpără în rate prin TBI Bank" on the Shopify store (biohack-tech.ro, theme snippet bt-rate-tbi).
 * TBI gives no API: the site only collects the request, the team sends the TBI "Link 2 Pay" by SMS and email.
 * This file is the request's shape and validation, shared by the route and the tests. Amounts are lei.
 */

export const RATE_TBI_PRODUCTS = {
  calm: { title: 'NEUROS Calm', normalLei: 6380 },
  focus: { title: 'NEUROS Focus', normalLei: 3225 },
} as const
export type RateTbiProduct = keyof typeof RATE_TBI_PRODUCTS

export const RATE_TBI_MAX_QTY = 10

export type RateTbiRequest = {
  name: string
  firstName: string
  phone: string
  email: string
  product: RateTbiProduct
  qty: number
  city: string
  /** The order value the page computed (the Black Friday step or the active discount), in lei. */
  valueLei: number
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
 * The value must be a real price for that product and quantity: at most the full price, at least 40% of it
 * (the deepest step of the Calm ladder with 20% at two pieces is 3.120 of 6.380 lei per piece).
 */
export function plausibleValue(product: RateTbiProduct, qty: number, valueLei: number): boolean {
  const full = RATE_TBI_PRODUCTS[product].normalLei * qty
  return Number.isFinite(valueLei) && valueLei >= full * 0.4 && valueLei <= full
}

export type RateTbiParse = { ok: true; request: RateTbiRequest } | { ok: false; fields: Record<string, string> }

export function parseRateTbi(body: Record<string, unknown>): RateTbiParse {
  const fields: Record<string, string> = {}
  const name = text(body.name, 80)
  if (name.length < 3 || !/\p{L}/u.test(name)) fields.name = 'Scrie numele complet.'
  const phone = normalizeRoMobile(body.phone)
  if (!phone) fields.phone = 'Scrie un număr de mobil din România, de exemplu 07xx xxx xxx.'
  const email = text(body.email, 120).toLowerCase()
  if (!EMAIL.test(email)) fields.email = 'Scrie o adresă de email validă.'
  const product = (typeof body.product === 'string' && body.product in RATE_TBI_PRODUCTS ? body.product : null) as RateTbiProduct | null
  if (!product) fields.product = 'Alege produsul.'
  const qty = Number(body.qty)
  if (!Number.isInteger(qty) || qty < 1 || qty > RATE_TBI_MAX_QTY) fields.qty = `Alege între 1 și ${RATE_TBI_MAX_QTY} bucăți.`
  const city = text(body.city, 60)
  if (city.length < 2) fields.city = 'Scrie orașul.'
  if (body.consent !== true) fields.consent = 'Bifează acordul ca să trimitem cererea.'
  const valueLei = Math.round(Number(body.value) * 100) / 100
  if (product && !fields.qty && !plausibleValue(product, qty, valueLei)) fields.value = 'Valoarea comenzii nu a putut fi calculată. Reîncarcă pagina.'
  if (Object.keys(fields).length || !product || !phone) return { ok: false, fields }

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
      product,
      qty,
      city,
      valueLei,
      page,
      utm,
      eventId,
      marketing: body.marketing === true,
      fbp: cookie(body.fbp),
      fbc: cookie(body.fbc),
    },
  }
}

/** 6240 → "6.240", 3227.5 → "3.227,50" (the Romanian way the team types it into Link 2 Pay). */
export function lei(value: number): string {
  const [i, d] = value.toFixed(2).split('.')
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return d === '00' ? int : `${int},${d}`
}
