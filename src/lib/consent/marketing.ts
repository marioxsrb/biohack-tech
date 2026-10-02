/**
 * The email marketing consent, as the checkbox shows it. Shared by the checkout (what the visitor reads)
 * and the server (what is recorded as proof), so the stored text is exactly the text on screen.
 *
 * Changing the wording means a new version: add it here, keep the old ones (past consents refer to them).
 */
export const MARKETING_CONSENT_TEXTS = {
  'mkt-2026-09-29':
    'Vreau să primesc emailuri de la Biohack Tech cu noutăți, oferte și recomandări, inclusiv un memento dacă nu finalizez comanda. Mă pot dezabona oricând.',
} as const

export type MarketingConsentVersion = keyof typeof MARKETING_CONSENT_TEXTS

export const MARKETING_CONSENT_VERSION: MarketingConsentVersion = 'mkt-2026-09-29'
export const MARKETING_CONSENT_TEXT = MARKETING_CONSENT_TEXTS[MARKETING_CONSENT_VERSION]

/**
 * What an English visitor reads for the current version. It is a translation of the Romanian text above,
 * which stays the recorded proof: the consent and its version are the same in both languages.
 */
export const MARKETING_CONSENT_TEXT_EN =
  'I want to receive emails from Biohack Tech with news, offers and tips, including a reminder if I leave my order unfinished. I can unsubscribe at any time.'
