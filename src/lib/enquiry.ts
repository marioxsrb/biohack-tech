/** The contact form's fields and rules, shared by the form and the server. */
export const ENQUIRY_TOPICS = {
  produse: 'Întrebare despre produse',
  alegere: 'Ce produs mi se potrivește',
  comanda: 'O comandă plasată',
  retur: 'Retur sau garanție',
  altceva: 'Altceva',
} as const
export type EnquiryTopic = keyof typeof ENQUIRY_TOPICS

/** The topics as an English visitor reads them. The stored topic is the key; the CRM keeps the Romanian label. */
export const ENQUIRY_TOPICS_EN: Record<EnquiryTopic, string> = {
  produse: 'A question about the products',
  alegere: 'Which product suits me',
  comanda: 'An order I placed',
  retur: 'Returns or warranty',
  altceva: 'Something else',
}

export type EnquiryInput = { name: string; email: string; phone: string; topic: EnquiryTopic; message: string }
export type EnquiryField = keyof EnquiryInput

export const ENQUIRY_LIMITS = { name: 120, email: 160, phone: 30, message: 3000 } as const

const text = (v: unknown) => (typeof v === 'string' ? v.normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim() : '')

/** Trims and collapses; never truncates silently (too-long input is rejected by validateEnquiry). */
export function normalizeEnquiry(raw: Record<string, unknown>): EnquiryInput {
  const topic = text(raw.topic)
  return {
    name: text(raw.name).replace(/\s+/g, ' '),
    email: text(raw.email).toLowerCase(),
    phone: text(raw.phone).replace(/[^\d+ ()-]/g, ''),
    topic: (topic in ENQUIRY_TOPICS ? topic : 'altceva') as EnquiryTopic,
    message: text(raw.message).replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n'),
  }
}

const ENQUIRY_MSG = {
  ro: {
    name: 'Scrie-ne cum te numești.',
    nameLong: 'Numele este prea lung.',
    email: 'Adresa de email nu pare corectă.',
    phone: 'Numărul de telefon nu pare corect.',
    message: 'Scrie-ne câteva cuvinte despre ce ai nevoie.',
    messageLong: `Mesajul poate avea cel mult ${ENQUIRY_LIMITS.message} de caractere.`,
  },
  en: {
    name: 'Tell us your name.',
    nameLong: 'The name is too long.',
    email: 'Check your email address.',
    phone: 'Check your phone number.',
    message: 'Write us a few words about what you need.',
    messageLong: `The message can have up to ${ENQUIRY_LIMITS.message} characters.`,
  },
}

export function validateEnquiry(e: EnquiryInput, locale: 'ro' | 'en' = 'ro'): Partial<Record<EnquiryField, string>> {
  const m = ENQUIRY_MSG[locale]
  const err: Partial<Record<EnquiryField, string>> = {}
  if (e.name.length < 2) err.name = m.name
  else if (e.name.length > ENQUIRY_LIMITS.name) err.name = m.nameLong
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.email) || e.email.length > ENQUIRY_LIMITS.email) err.email = m.email
  if (e.phone && (e.phone.replace(/\D/g, '').length < 9 || e.phone.length > ENQUIRY_LIMITS.phone)) err.phone = m.phone
  if (e.message.length < 10) err.message = m.message
  else if (e.message.length > ENQUIRY_LIMITS.message) err.message = m.messageLong
  return err
}
