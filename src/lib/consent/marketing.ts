import { COMMUNICATIONS_CONSENT_TEXT, COMMUNICATIONS_CONSENT_TEXT_EN } from './communications'

/** What the website popup says under the email field: sending the address is the consent (shown before it). */
export const WELCOME_CONSENT_TEXT = 'Primești pe email codul de 10% și, ocazional, oferte și noutăți Biohack Tech. Te poți dezabona oricând, din orice email.'
export const WELCOME_CONSENT_TEXT_EN = 'You get the 10% code by email and, now and then, Biohack Tech offers and news. You can unsubscribe at any time, from any email.'

/**
 * The email marketing consent, as the checkbox shows it. Shared by the checkout (what the visitor reads)
 * and the server (what is recorded as proof), so the stored text is exactly the text on screen.
 *
 * Changing the wording means a new version: add it here, keep the old ones (past consents refer to them).
 */
export const MARKETING_CONSENT_TEXTS = {
  'mkt-2026-09-29':
    'Vreau să primesc emailuri de la Biohack Tech cu noutăți, oferte și recomandări, inclusiv un memento dacă nu finalizez comanda. Mă pot dezabona oricând.',
  // Since 14.10.2026: the one communications box, which names email and AI calls (see ./communications).
  'comms-2026-10-14': COMMUNICATIONS_CONSENT_TEXT,
  // Since 15.10.2026: the website's 10% popup (email only; AI calls are never implied by it).
  'welcome-2026-10-15': WELCOME_CONSENT_TEXT,
} as const

export type MarketingConsentVersion = keyof typeof MARKETING_CONSENT_TEXTS

export const MARKETING_CONSENT_VERSION: MarketingConsentVersion = 'comms-2026-10-14'
export const MARKETING_CONSENT_TEXT = MARKETING_CONSENT_TEXTS[MARKETING_CONSENT_VERSION]

/**
 * What an English visitor reads for the current version. It is a translation of the Romanian text above,
 * which stays the recorded proof: the consent and its version are the same in both languages.
 */
export const MARKETING_CONSENT_TEXT_EN = COMMUNICATIONS_CONSENT_TEXT_EN
