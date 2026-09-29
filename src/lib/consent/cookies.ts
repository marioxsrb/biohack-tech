/**
 * Cookie consent: the model, shared by the banner, the script loader, the analytics calls and the tests.
 *
 * Categories:
 *   necessary  always on: cart, checkout draft, payment (Stripe on the checkout page), this choice itself.
 *   analytics  off until the visitor says yes.
 *   marketing  off until the visitor says yes. Separate from email marketing consent, which is asked at
 *              checkout and never inferred from this.
 *
 * The choice is stored in the visitor's browser (localStorage, strictly necessary to remember it) under a
 * random id, and logged on our server with that id only: no IP, no user agent.
 */
export const COOKIE_POLICY_VERSION = '2026-09-29'
/** A choice is asked again after this long, or when the policy version changes. */
export const CONSENT_MAX_AGE_DAYS = 365
export const CONSENT_STORAGE_KEY = 'bt-consent-v1'

export type OptionalCategory = 'analytics' | 'marketing'
export type ConsentChoice = Record<OptionalCategory, boolean>
export type ConsentAction = 'accept_all' | 'reject_all' | 'custom'

export type StoredConsent = ConsentChoice & {
  /** Random, pseudonymous: links this browser's choice to its server log entry, nothing else. */
  id: string
  version: string
  /** First decision in this browser. */
  at: string
  /** Latest decision (the same as `at` until the visitor changes it). */
  updatedAt: string
}

export const NONE: ConsentChoice = { analytics: false, marketing: false }
export const ALL: ConsentChoice = { analytics: true, marketing: true }

/** A stored choice counts only if it is well-formed, for the current policy, and recent enough. */
export function parseConsent(raw: string | null, now = Date.now()): StoredConsent | null {
  if (!raw) return null
  try {
    const c = JSON.parse(raw) as Partial<StoredConsent>
    if (typeof c.id !== 'string' || typeof c.analytics !== 'boolean' || typeof c.marketing !== 'boolean') return null
    if (c.version !== COOKIE_POLICY_VERSION || typeof c.updatedAt !== 'string' || typeof c.at !== 'string') return null
    const updated = Date.parse(c.updatedAt)
    if (!Number.isFinite(updated) || now - updated > CONSENT_MAX_AGE_DAYS * 86_400_000) return null
    return { id: c.id, version: c.version, analytics: c.analytics, marketing: c.marketing, at: c.at, updatedAt: c.updatedAt }
  } catch {
    return null
  }
}

export function nextConsent(prev: StoredConsent | null, choice: ConsentChoice, id: string, now = new Date()): StoredConsent {
  const iso = now.toISOString()
  return { id: prev?.id ?? id, version: COOKIE_POLICY_VERSION, analytics: choice.analytics, marketing: choice.marketing, at: prev?.at ?? iso, updatedAt: iso }
}

export const actionFor = (c: ConsentChoice): ConsentAction => (c.analytics && c.marketing ? 'accept_all' : !c.analytics && !c.marketing ? 'reject_all' : 'custom')

/** Categories granted before and refused now: their scripts must go (the page reloads without them). */
export const withdrawn = (before: ConsentChoice | null, after: ConsentChoice): OptionalCategory[] =>
  before ? (['analytics', 'marketing'] as const).filter((k) => before[k] && !after[k]) : []
