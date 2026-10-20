/**
 * The one optional communications box (checkout): it names both channels, email and calls from
 * the AI assistant, so ticking it records two separate consents (email by address, calls by phone number), each
 * with this text and version as proof. Accepting the terms never implies it, and it is never needed to see a
 * price or to order. The conditions it refers to are the "Comunicări comerciale" section of the terms.
 *
 * Changing the wording means a new version (in MARKETING_CONSENT_TEXTS and CALL_CONSENT_TEXTS); past consents
 * keep the version they were given under.
 */
export const COMMUNICATIONS_CONSENT_VERSION = 'comms-2026-10-14'

/** The link words inside the label (they open the conditions). */
export const COMMUNICATIONS_LINK_TEXT = 'condițiile privind comunicările'
export const COMMUNICATIONS_CONSENT_TEXT = `Accept ${COMMUNICATIONS_LINK_TEXT} din partea Biohack Tech, prin email și apeluri de la asistentul AI.`

/** What an English visitor reads: a translation; the Romanian text above stays the recorded proof. */
export const COMMUNICATIONS_LINK_TEXT_EN = 'terms for communications'
export const COMMUNICATIONS_CONSENT_TEXT_EN = `I accept the ${COMMUNICATIONS_LINK_TEXT_EN} from Biohack Tech, by email and calls from its AI assistant.`

/**
 * The international site (biohack-tech.net) has no AI calls: its box names email only, with its own version,
 * and the text recorded is the one the visitor read (English or Romanian).
 */
export const EMAIL_ONLY_CONSENT_TEXT = `Accept ${COMMUNICATIONS_LINK_TEXT} din partea Biohack Tech, prin email, inclusiv un memento dacă nu finalizez comanda.`
export const EMAIL_ONLY_CONSENT_TEXT_EN = `I accept the ${COMMUNICATIONS_LINK_TEXT_EN} from Biohack Tech by email, including a reminder if I do not finish my order.`

/** Where the conditions are: the terms' own section (also linked from the footer). */
export const COMMUNICATIONS_TERMS_HREF = '/terms-of-service#comunicari'
