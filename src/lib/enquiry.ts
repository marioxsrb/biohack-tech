/** The contact form's fields and rules, shared by the form and the server. */
export const ENQUIRY_TOPICS = {
  produse: 'Întrebare despre produse',
  alegere: 'Ce produs mi se potrivește',
  comanda: 'O comandă plasată',
  retur: 'Retur sau garanție',
  altceva: 'Altceva',
} as const
export type EnquiryTopic = keyof typeof ENQUIRY_TOPICS

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

export function validateEnquiry(e: EnquiryInput): Partial<Record<EnquiryField, string>> {
  const err: Partial<Record<EnquiryField, string>> = {}
  if (e.name.length < 2) err.name = 'Scrie-ne cum te numești.'
  else if (e.name.length > ENQUIRY_LIMITS.name) err.name = 'Numele este prea lung.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.email) || e.email.length > ENQUIRY_LIMITS.email) err.email = 'Adresa de email nu pare corectă.'
  if (e.phone && (e.phone.replace(/\D/g, '').length < 9 || e.phone.length > ENQUIRY_LIMITS.phone)) err.phone = 'Numărul de telefon nu pare corect.'
  if (e.message.length < 10) err.message = 'Scrie-ne câteva cuvinte despre ce ai nevoie.'
  else if (e.message.length > ENQUIRY_LIMITS.message) err.message = `Mesajul poate avea cel mult ${ENQUIRY_LIMITS.message} de caractere.`
  return err
}
