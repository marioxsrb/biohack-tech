/** Checkout validation, shared by the form (client) and the API route (server). */

export const COUNTIES = [
  'Alba', 'Arad', 'Argeș', 'Bacău', 'Bihor', 'Bistrița-Năsăud', 'Botoșani', 'Brașov', 'Brăila', 'București',
  'Buzău', 'Caraș-Severin', 'Călărași', 'Cluj', 'Constanța', 'Covasna', 'Dâmbovița', 'Dolj', 'Galați', 'Giurgiu',
  'Gorj', 'Harghita', 'Hunedoara', 'Ialomița', 'Iași', 'Ilfov', 'Maramureș', 'Mehedinți', 'Mureș', 'Neamț',
  'Olt', 'Prahova', 'Satu Mare', 'Sălaj', 'Sibiu', 'Suceava', 'Teleorman', 'Timiș', 'Tulcea', 'Vaslui',
  'Vâlcea', 'Vrancea',
] as const

export type Customer = {
  name: string
  email: string
  phone: string
  address: string
  city: string
  county: string
  postalCode: string
  notes: string
}

export type CheckoutPayload = {
  currency: string
  lines: { productId: string; variantId?: string; quantity: number }[]
  customer: Customer
  acceptedTerms: boolean
}

export const emptyCustomer: Customer = { name: '', email: '', phone: '', address: '', city: '', county: '', postalCode: '', notes: '' }

export type FieldErrors = Partial<Record<keyof Customer | 'acceptedTerms', string>>

const clean = (s: unknown, max = 200) => (typeof s === 'string' ? s.trim().slice(0, max) : '')

export function normalizeCustomer(raw: unknown): Customer {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    name: clean(r.name, 120),
    email: clean(r.email, 160).toLowerCase(),
    phone: clean(r.phone, 30),
    address: clean(r.address, 200),
    city: clean(r.city, 80),
    county: clean(r.county, 40),
    postalCode: clean(r.postalCode, 10),
    notes: clean(r.notes, 400),
  }
}

export function validateCustomer(c: Customer, acceptedTerms: boolean): FieldErrors {
  const e: FieldErrors = {}
  if (c.name.split(/\s+/).filter(Boolean).length < 2) e.name = 'Scrie numele și prenumele.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email)) e.email = 'Adresa de email nu pare corectă.'
  const digits = c.phone.replace(/[^\d]/g, '')
  if (digits.length < 9 || digits.length > 15) e.phone = 'Scrie un număr de telefon valid, ca să te poată suna curierul.'
  if (c.address.length < 5) e.address = 'Scrie strada și numărul.'
  if (c.city.length < 2) e.city = 'Scrie localitatea.'
  if (!(COUNTIES as readonly string[]).includes(c.county)) e.county = 'Alege județul.'
  if (!/^\d{6}$/.test(c.postalCode)) e.postalCode = 'Codul poștal are 6 cifre.'
  if (!acceptedTerms) e.acceptedTerms = 'Ca să continui, trebuie să accepți termenii.'
  return e
}
