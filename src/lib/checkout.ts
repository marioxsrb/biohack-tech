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


export type BuyerType = 'pf' | 'pj'
export type PaymentMethod = 'card' | 'transfer'

/** Every text field of the form, flat, so the form can bind them uniformly. */
export type OrderFields = {
  firstName: string
  lastName: string
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
  /** Optional, unticked by default: product news and usage tips by email. */
  marketingConsent: boolean
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

/** The unfinished checkout form, in sessionStorage only (gone when the tab closes). */
export const DRAFT_KEY = 'biohack-checkout-draft'

export type FieldName = keyof OrderFields | 'acceptedTerms' | 'paymentMethod'
export type FieldErrors = Partial<Record<FieldName, string>>

export const emptyOrder: OrderForm = {
  buyerType: 'pf',
  marketingConsent: false,
  firstName: '',
  lastName: '',
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
  firstName: 60,
  lastName: 60,
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
  out.marketingConsent = r.marketingConsent === true
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

/** Validation messages, in the visitor's language. The server validates with Romanian (the default). */
const MSG = {
  ro: {
    firstName: 'Completează prenumele.',
    lastName: 'Completează numele.',
    emailEmpty: 'Completează adresa de email.',
    email: 'Verifică adresa de email. Exemplu: nume@exemplu.ro',
    phoneEmpty: 'Completează numărul de telefon, pentru curier.',
    phone: 'Verifică numărul de telefon. Exemplu: 0722 123 456',
    company: 'Completează denumirea firmei.',
    cuiEmpty: 'Completează codul fiscal (CUI).',
    cui: 'Verifică codul fiscal. Poate începe cu RO, urmat de cifre.',
    office: 'Completează adresa sediului: strada și numărul.',
    address: 'Completează adresa: strada și numărul.',
    city: 'Completează localitatea.',
    county: 'Alege județul.',
    postalCode: 'Codul poștal are 6 cifre.',
    shipAddress: 'Completează adresa de livrare: strada și numărul.',
    paymentMethod: 'Această metodă de plată nu este disponibilă încă. Alege alta.',
    acceptedTerms: 'Bifează acordul cu termenii ca să plasezi comanda.',
  },
  en: {
    firstName: 'Enter your first name.',
    lastName: 'Enter your last name.',
    emailEmpty: 'Enter your email address.',
    email: 'Check your email address. Example: name@example.com',
    phoneEmpty: 'Enter your phone number, for the courier.',
    phone: 'Check your phone number. Example: 0722 123 456',
    company: 'Enter the company name.',
    cuiEmpty: 'Enter the tax code (CUI).',
    cui: 'Check the tax code. It can start with RO, followed by digits.',
    office: 'Enter the registered office address: street and number.',
    address: 'Enter your address: street and number.',
    city: 'Enter the town or city.',
    county: 'Choose the county.',
    postalCode: 'The postcode has 6 digits.',
    shipAddress: 'Enter the delivery address: street and number.',
    paymentMethod: 'This payment method is coming soon. Please choose another one.',
    acceptedTerms: 'Tick the box to accept the terms and place your order.',
  },
}

export function validateOrder(o: OrderForm, acceptedTerms: boolean, available?: Record<PaymentMethod, boolean>, locale: 'ro' | 'en' = 'ro'): FieldErrors {
  const m = MSG[locale]
  const e: FieldErrors = {}
  if (o.firstName.length < 1) e.firstName = m.firstName
  if (o.lastName.length < 1) e.lastName = m.lastName
  if (!o.email) e.email = m.emailEmpty
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(o.email)) e.email = m.email
  const digits = o.phone.replace(/\D/g, '')
  if (!digits) e.phone = m.phoneEmpty
  else if (digits.length < 9 || digits.length > 15) e.phone = m.phone

  if (o.buyerType === 'pj') {
    if (o.company.length < 2) e.company = m.company
    if (!o.cui) e.cui = m.cuiEmpty
    else if (!isValidCui(o.cui)) e.cui = m.cui
  }

  const office = o.buyerType === 'pj'
  if (o.address.length < 5) e.address = office ? m.office : m.address
  if (o.city.length < 2) e.city = m.city
  if (!isCounty(o.county)) e.county = m.county
  if (!/^\d{6}$/.test(o.postalCode)) e.postalCode = m.postalCode

  if (!o.sameAddress) {
    if (o.shipAddress.length < 5) e.shipAddress = m.shipAddress
    if (o.shipCity.length < 2) e.shipCity = m.city
    if (!isCounty(o.shipCounty)) e.shipCounty = m.county
    if (!/^\d{6}$/.test(o.shipPostalCode)) e.shipPostalCode = m.postalCode
  }

  if (available && !available[o.paymentMethod]) e.paymentMethod = m.paymentMethod
  if (!acceptedTerms) e.acceptedTerms = m.acceptedTerms
  return e
}
