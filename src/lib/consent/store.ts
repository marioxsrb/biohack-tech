/**
 * The visitor's cookie choice in this browser, readable anywhere on the client (the analytics calls
 * check it before sending anything). Storage may be unavailable (private mode): then no choice is
 * remembered, nothing optional runs, and the banner simply appears again on the next visit.
 */
import { CONSENT_STORAGE_KEY, nextConsent, parseConsent, type ConsentChoice, type StoredConsent } from './cookies'

let current: StoredConsent | null = null
let loaded = false
const listeners = new Set<() => void>()

function read(): StoredConsent | null {
  try {
    return parseConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY))
  } catch {
    return null
  }
}

export const consentStore = {
  get(): StoredConsent | null {
    if (typeof window === 'undefined') return null
    if (!loaded) {
      loaded = true
      current = read()
    }
    return current
  },
  getServer: (): StoredConsent | null => null,
  /** Saves a decision and returns it (same id as before, new update time). */
  save(choice: ConsentChoice): StoredConsent {
    const next = nextConsent(consentStore.get(), choice, crypto.randomUUID())
    current = next
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next))
    } catch {}
    listeners.forEach((l) => l())
    return next
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => void listeners.delete(l)
  },
  /** True only with a stored, current decision that allows the category. */
  allows: (category: keyof ConsentChoice) => !!consentStore.get()?.[category],
}
