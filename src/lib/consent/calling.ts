import { COMMUNICATIONS_CONSENT_TEXT } from './communications'

/**
 * Consent to be called by Biohack Tech's AI assistant: an optional, unticked box whose text names the calls
 * explicitly (today the communications box, which names email too), never needed to see a price or to order.
 * Romanian law (Legea 506/2004, art. 12) allows commercial calls made by an automated system only with the
 * subscriber's prior express consent, so nothing else (the terms, a form, an order, an earlier email-only consent) counts as this one.
 *
 * Shared by the forms (what the visitor reads) and the server (what is recorded as proof). Changing the
 * wording means a new version: add it here and keep the old ones.
 */
export const CALL_CONSENT_TEXTS = {
  'call-2026-10-14':
    'Sunt de acord să fiu sunat la acest număr de asistentul AI al Biohack Tech, despre produsul ales, dacă nu finalizez comanda. Apelul este făcut de un sistem automat. Pot refuza oricând, inclusiv în timpul apelului.',
  // Since 14.10.2026: the one communications box, whose text names the AI calls explicitly (see ./communications).
  'comms-2026-10-14': COMMUNICATIONS_CONSENT_TEXT,
} as const

export type CallConsentVersion = keyof typeof CALL_CONSENT_TEXTS
export const CALL_CONSENT_VERSION: CallConsentVersion = 'comms-2026-10-14'
export const CALL_CONSENT_TEXT = CALL_CONSENT_TEXTS[CALL_CONSENT_VERSION]

/**
 * A Romanian phone number in E.164 (+40 and 9 digits), or null. Only Romanian numbers are called: their
 * local time is known, so the calling window can be respected.
 */
export function romanianE164(raw: string | null | undefined): string | null {
  if (!raw) return null
  let d = raw.replace(/[\s().-]/g, '')
  if (d.startsWith('+')) d = d.slice(1)
  else if (d.startsWith('00')) d = d.slice(2)
  else if (d.startsWith('0')) d = `40${d.slice(1)}`
  if (!/^\d+$/.test(d)) return null
  return /^40[237]\d{8}$/.test(d) ? `+${d}` : null
}
