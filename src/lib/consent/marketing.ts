import { COMMUNICATIONS_CONSENT_TEXT, COMMUNICATIONS_CONSENT_TEXT_EN, EMAIL_ONLY_CONSENT_TEXT, EMAIL_ONLY_CONSENT_TEXT_EN } from './communications'

/** What the website popup says under the email field: sending the address is the consent (shown before it). */
export const WELCOME_CONSENT_TEXT = 'Primești pe email codul de 10% și, ocazional, oferte și noutăți Biohack Tech. Te poți dezabona oricând, din orice email.'
/** The same consent under the gift boxes (20.10.2026): the code is the gift's, not always 10%. */
export const WELCOME_GIFT_CONSENT_TEXT = 'Primești pe email codul cadoului tău și, ocazional, oferte și noutăți Biohack Tech. Te poți dezabona oricând, din orice email.'
/** Under the product popups when they give the product's voucher (POPUP_VOUCHERS, prepared 23.10.2026, off). */
export const WELCOME_VOUCHER_CONSENT_TEXT = 'Primești pe email voucherul tău și, din când în când, oferte și noutăți Biohack Tech. Te dezabonezi oricând, din orice email.'
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
  'welcome-cadou-2026-10-20': WELCOME_GIFT_CONSENT_TEXT,
  'welcome-voucher-2026-10-23': WELCOME_VOUCHER_CONSENT_TEXT,
  // Since 16.10.2026: the international site's box (email only, no AI calls), in the language the visitor read.
  'email-2026-10-16': EMAIL_ONLY_CONSENT_TEXT,
  'email-en-2026-10-16': EMAIL_ONLY_CONSENT_TEXT_EN,
  'welcome-en-2026-10-16': WELCOME_CONSENT_TEXT_EN,
} as const

export type MarketingConsentVersion = keyof typeof MARKETING_CONSENT_TEXTS

export const MARKETING_CONSENT_VERSION: MarketingConsentVersion = 'comms-2026-10-14'
export const MARKETING_CONSENT_TEXT = MARKETING_CONSENT_TEXTS[MARKETING_CONSENT_VERSION]

/**
 * What an English visitor reads for the current version. It is a translation of the Romanian text above,
 * which stays the recorded proof: the consent and its version are the same in both languages.
 */
export const MARKETING_CONSENT_TEXT_EN = COMMUNICATIONS_CONSENT_TEXT_EN

/** The version a ticked box is recorded under: the international site's email-only box, or the usual one. */
export const consentVersionFor = (site: 'ro' | 'net', locale: 'ro' | 'en'): MarketingConsentVersion =>
  site === 'net' ? (locale === 'en' ? 'email-en-2026-10-16' : 'email-2026-10-16') : MARKETING_CONSENT_VERSION
