/**
 * Leads: the contact details a visitor gives before checkout, on the price-gated funnel (acces.<domain>) to
 * see the price, or in the checkout's contact step. Shared by the form (what the visitor reads and is checked
 * against) and the server (what is stored as proof), so the recorded text is the text on screen.
 *
 * The price gate is a conversion experiment, not a secret: prices are public on the main site.
 */

import { GATED_HOST_LABEL, isGatedHostname } from './landing-hosts'

/** Where the price-gated funnel lives: acces.<domain> (acces.localhost locally). Any other Host is the main site. */
export const GATED_SUBDOMAIN = GATED_HOST_LABEL
export const isGatedHost = (host: string | null | undefined) => isGatedHostname(host)

/** The price-gated funnel's origin for a site URL: https://biohack-tech.ro → https://acces.biohack-tech.ro. */
export function gatedOrigin(siteUrl: string) {
  const u = new URL(siteUrl)
  return `${u.protocol}//${GATED_SUBDOMAIN}.${u.host.replace(/^www\./, '')}`
}

export type Funnel = 'visible_price' | 'gated_price'
export const funnelForHost = (host: string | null | undefined): Funnel => (isGatedHost(host) ? 'gated_price' : 'visible_price')

/** First-party cookies. Set only after the visitor submits a form (or by a recovery link they received). */
export const GATE_COOKIE = 'bt_gate'
export const VISITOR_COOKIE = 'bt_vid'
export const GATE_DAYS = 90

/** Why we ask, shown under the form. Changing it means a new version (stored with each lead). */
export const LEAD_PRIVACY_TEXTS = {
  'lead-2026-10-14':
    'Folosim numele, emailul și telefonul ca să îți arătăm prețul și oferta și să păstrăm alegerea ta pe acest dispozitiv. Nu primești reclame și nu te sunăm fără acordul tău.',
  'lead-2026-10-14b': 'Folosim datele ca să îți arătăm prețul și oferta.',
} as const
export type LeadPrivacyVersion = keyof typeof LEAD_PRIVACY_TEXTS
export const LEAD_PRIVACY_VERSION: LeadPrivacyVersion = 'lead-2026-10-14b'
export const LEAD_PRIVACY_TEXT = LEAD_PRIVACY_TEXTS[LEAD_PRIVACY_VERSION]

export type LeadContact = { name: string; email: string; phone: string }
export type LeadErrors = Partial<Record<keyof LeadContact, string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function normalizeContact(raw: Partial<Record<keyof LeadContact, unknown>>): LeadContact {
  const s = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
  return { name: s(raw.name, 80), email: s(raw.email, 120).toLowerCase(), phone: s(raw.phone, 30) }
}

/** The same rules as the checkout's contact step. */
export function validateContact(c: LeadContact, required: (keyof LeadContact)[] = ['name', 'email', 'phone']): LeadErrors {
  const e: LeadErrors = {}
  if (required.includes('name') && c.name.length < 2) e.name = 'Scrie-ne numele tău.'
  if (!c.email) {
    if (required.includes('email')) e.email = 'Scrie adresa de email.'
  } else if (!EMAIL.test(c.email)) e.email = 'Verifică adresa de email. Exemplu: nume@exemplu.ro'
  const digits = c.phone.replace(/\D/g, '')
  if (!digits) {
    if (required.includes('phone')) e.phone = 'Scrie numărul de telefon.'
  } else if (digits.length < 9 || digits.length > 15) e.phone = 'Verifică numărul de telefon. Exemplu: 0722 123 456'
  return e
}

/** One cookie's value from a Cookie header (route handlers may get a plain Request, without `cookies`). */
export function cookieFrom(header: string | null | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(/;\s*/)) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i) === name) {
      try {
        return decodeURIComponent(part.slice(i + 1))
      } catch {
        return undefined
      }
    }
  }
  return undefined
}

/** A promo code brought by a recovery link (the AI call's personal code), filled into the checkout. */
export const PROMO_COOKIE = 'bt_promo'
