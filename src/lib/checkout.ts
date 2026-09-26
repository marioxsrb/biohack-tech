/**
 * Checkout model and validation, shared by the form (client) and the API route (server).
 * The server always re-runs normalizeOrder + validateOrder; the browser's checks are a courtesy.
 */

export const COUNTIES = [
  'Alba', 'Arad', 'Argeș', 'Bacău', 'Bihor', 'Bistrița-Năsăud', 'Botoșani', 'Brașov', 'Brăila', 'București',
  'Buzău', 'Caraș-Severin', 'Călărași', 'Cluj', 'Constanța', 'Covasna', 'Dâmbovița', 'Dolj', 'Galați', 'Giurgiu',
  'Gorj', 'Harghita', 'Hunedoara', 'Ialomița', 'Iași', 'Ilfov', 'Maramureș', 'Mehedinți', 'Mureș', 'Neamț',
  'Olt', 'Prahova', 'Satu Mare', 'Sălaj', 'Sibiu', 'Suceava', 'Teleorman', 'Timiș', 'Tulcea', 'Vaslui',
  'Vâlcea', 'Vrancea',
] as const

/** sessionStorage keys: the unfinished form, and the last bank-transfer order (for its confirmation page). */
export const DRAFT_KEY = 'biohack-checkout-draft'
export const TRANSFER_KEY = 'biohack-transfer-order'

export type BuyerType = 'pf' | 'pj'
export type PaymentMethod = 'card' | 'transfer'

/** Every text field of the form, flat, so the form can bind them uniformly. */
export type OrderFields = {
  name: string
  email: string
  phone: string
  /** Company (persoană juridică) only. */
  company: string
  cui: string
  regCom: string
  /** Billing address: home address for individuals, registered office for companies. */
  address: string
  city: string
  county: string
  postalCode: string
  /** Delivery address, used only when it differs from billing. */
  shipAddress: string
  shipCity: string
  shipCounty: string
  shipPostalCode: string
  notes: string
}

export type OrderForm = OrderFields & {
  buyerType: BuyerType
  /** Deliver to the billing address. */
  sameAddress: boolean
  paymentMethod: PaymentMethod
}

export type CartRequestLine = { productId: string; variantId?: string; quantity: number }

/** What the browser sends. Prices, names and totals are never part of it. */
export type CheckoutPayload = {
  lines: CartRequestLine[]
  order: OrderForm
  acceptedTerms: boolean
  /** One id per checkout attempt, so a double submit can't create two orders. */
  attemptId: string
}

export type FieldName = keyof OrderFields | 'acceptedTerms' | 'paymentMethod'
export type FieldErrors = Partial<Record<FieldName, string>>

export const emptyOrder: OrderForm = {
  buyerType: 'pf',
  name: '',
  email: '',
  phone: '',
  company: '',
  cui: '',
  regCom: '',
  address: '',
  city: '',
  county: '',
  postalCode: '',
  sameAddress: true,
  shipAddress: '',
  shipCity: '',
  shipCounty: '',
  shipPostalCode: '',
  notes: '',
  paymentMethod: 'card',
}

const LIMITS: Record<keyof OrderFields, number> = {
  name: 120,
  email: 160,
  phone: 30,
  company: 160,
  cui: 16,
  regCom: 40,
  address: 200,
  city: 80,
  county: 40,
  postalCode: 10,
  shipAddress: 200,
  shipCity: 80,
  shipCounty: 40,
  shipPostalCode: 10,
  notes: 400,
}

const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '')

/** Coerces anything (a stored draft, a request body) into a well-formed OrderForm. */
export function normalizeOrder(raw: unknown): OrderForm {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out = { ...emptyOrder }
  for (const k of Object.keys(LIMITS) as (keyof OrderFields)[]) out[k] = clean(r[k], LIMITS[k])
  out.email = out.email.toLowerCase()
  out.cui = out.cui.toUpperCase().replace(/\s/g, '')
  out.buyerType = r.buyerType === 'pj' ? 'pj' : 'pf'
  out.sameAddress = r.sameAddress !== false
  out.paymentMethod = r.paymentMethod === 'transfer' ? 'transfer' : 'card'
  return out
}

/**
 * Romanian fiscal code (CUI/CIF) check digit. Accepts an optional "RO" prefix.
 * Algorithm: weights 7,5,3,2,1,7,5,3,2 applied right-aligned to the digits before the
 * control digit; (sum * 10) mod 11, with 10 counting as 0, must equal the control digit.
 */
export function isValidCui(input: string): boolean {
  const digits = input.toUpperCase().replace(/^RO/, '').replace(/\s/g, '')
  if (!/^\d{2,10}$/.test(digits)) return false
  const control = Number(digits.at(-1))
  const body = digits.slice(0, -1).padStart(9, '0')
  const weights = [7, 5, 3, 2, 1, 7, 5, 3, 2]
  const sum = [...body].reduce((acc, d, i) => acc + Number(d) * weights[i], 0)
  const expected = ((sum * 10) % 11) % 10
  return expected === control
}

const isCounty = (c: string) => (COUNTIES as readonly string[]).includes(c)

export function validateOrder(o: OrderForm, acceptedTerms: boolean, available?: Record<PaymentMethod, boolean>): FieldErrors {
  const e: FieldErrors = {}
  if (o.name.split(' ').filter(Boolean).length < 2) e.name = 'Scrie numele și prenumele.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(o.email)) e.email = 'Adresa de email nu pare corectă. Exemplu: nume@exemplu.ro'
  const digits = o.phone.replace(/\D/g, '')
  if (digits.length < 9 || digits.length > 15) e.phone = 'Scrie un număr de telefon valid, ca să te poată suna curierul.'

  if (o.buyerType === 'pj') {
    if (o.company.length < 2) e.company = 'Scrie denumirea firmei.'
    if (!isValidCui(o.cui)) e.cui = 'Codul fiscal nu pare corect. Verifică cifrele (poate începe cu RO).'
  }

  const office = o.buyerType === 'pj'
  if (o.address.length < 5) e.address = office ? 'Scrie adresa sediului.' : 'Scrie strada și numărul.'
  if (o.city.length < 2) e.city = 'Scrie localitatea.'
  if (!isCounty(o.county)) e.county = 'Alege județul.'
  if (!/^\d{6}$/.test(o.postalCode)) e.postalCode = 'Codul poștal are 6 cifre.'

  if (!o.sameAddress) {
    if (o.shipAddress.length < 5) e.shipAddress = 'Scrie strada și numărul pentru livrare.'
    if (o.shipCity.length < 2) e.shipCity = 'Scrie localitatea.'
    if (!isCounty(o.shipCounty)) e.shipCounty = 'Alege județul.'
    if (!/^\d{6}$/.test(o.shipPostalCode)) e.shipPostalCode = 'Codul poștal are 6 cifre.'
  }

  if (available && !available[o.paymentMethod]) e.paymentMethod = 'Această metodă de plată nu este disponibilă încă. Alege alta.'
  if (!acceptedTerms) e.acceptedTerms = 'Ca să continui, bifează că accepți termenii.'
  return e
}

/** One-line addresses, for payment metadata and order notifications. */
export const billingAddress = (o: OrderForm) => `${o.address}, ${o.city}, jud. ${o.county}, ${o.postalCode}`
export const shippingAddress = (o: OrderForm) =>
  o.sameAddress ? billingAddress(o) : `${o.shipAddress}, ${o.shipCity}, jud. ${o.shipCounty}, ${o.shipPostalCode}`
