/**
 * The browser side of the admin's KA-CHING (components in app/[lang]/(admin)/admin/SalesAlerts.tsx), kept free of
 * React so it can be tested: the sound preference, the cursor, and the claims that make every order ring once and
 * toast once across refreshes, reconnections and several tabs of the same browser (localStorage is shared by the
 * tabs; the claims are taken inside a Web Lock, so two tabs never both win).
 */
import { formatMoney, type Currency } from '@/lib/currency'

export type KeyValue = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const SOUND_URL = '/sounds/kaching-register.mp3'
export const CHANNEL = 'bt-admin-sales'
export const POLLER_LOCK = 'bt-admin-sales-poller'
const CLAIM_LOCK = 'bt-admin-sales-claim'
const K = { sound: 'bt-admin-sales-sound', cursor: 'bt-admin-sales-cursor', claims: 'bt-admin-sales-claims' }

/** An order older than this when first seen (e.g. placed while the admin was closed) is not announced. */
export const FRESH_MS = 10 * 60_000
const KEEP_CLAIMS_MS = 3 * 86_400_000
const MAX_CLAIMS = 500

export type SoundPref = 'on' | 'off' | null

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export const soundPref = (s: KeyValue): SoundPref => safe(() => (s.getItem(K.sound) as SoundPref) ?? null, null)
export const setSoundPref = (s: KeyValue, v: 'on' | 'off') => safe(() => s.setItem(K.sound, v), undefined)

export const readCursor = (s: KeyValue): number | null =>
  safe(() => {
    const v = s.getItem(K.cursor)
    return v && /^\d+$/.test(v) ? Number(v) : null
  }, null)
/** The cursor only moves forward (two pollers in a row, e.g. a tab closing and another taking over). */
export const saveCursor = (s: KeyValue, c: number) => safe(() => (c > (readCursor(s) ?? -1) ? s.setItem(K.cursor, String(c)) : undefined), undefined)

export const isFresh = (at: string, now: string) => Date.parse(now) - Date.parse(at) <= FRESH_MS

/**
 * Takes `key` (e.g. "seen:<order id>", "sound:<order id>", "toast:<order id>") if nobody has: true once per key,
 * whatever the tab. Old claims are dropped after a few days.
 */
export function claimNow(s: KeyValue, key: string, now = Date.now()): boolean {
  return safe(() => {
    const all = JSON.parse(s.getItem(K.claims) ?? '{}') as Record<string, number>
    if (all[key]) return false
    all[key] = now
    const kept = Object.entries(all)
      .filter(([, t]) => now - t < KEEP_CLAIMS_MS)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CLAIMS)
    s.setItem(K.claims, JSON.stringify(Object.fromEntries(kept)))
    return true
  }, false)
}

/** Gives a claim back (e.g. the sound, when this tab's browser refused to play it: another tab may). */
export function release(s: KeyValue, key: string) {
  safe(() => {
    const all = JSON.parse(s.getItem(K.claims) ?? '{}') as Record<string, number>
    delete all[key]
    s.setItem(K.claims, JSON.stringify(all))
  }, undefined)
}

type Locks = { request: (name: string, cb: () => Promise<boolean>) => Promise<boolean> }

/** claimNow inside a Web Lock shared by the tabs (where the browser has them). */
export async function claim(s: KeyValue, key: string, locks: Locks | undefined = typeof navigator !== 'undefined' ? (navigator as unknown as { locks?: Locks }).locks : undefined) {
  if (!locks) return claimNow(s, key)
  return locks.request(CLAIM_LOCK, async () => claimNow(s, key))
}

const METHOD = { card: 'card', bank_transfer: 'transfer bancar', cash_on_delivery: 'ramburs' } as const
export const methodLabel = (m: keyof typeof METHOD) => METHOD[m] ?? m

/** The order's value as the rest of the store writes it (1.620 lei, €1,195). */
export const money = (total: number, currency: string) => formatMoney(Math.round(total * 100), currency as Currency)
