'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { SaleAlert } from '@/server/admin/sales-feed'
import { CHANNEL, POLLER_LOCK, SOUND_URL, claim, isFresh, money, release, readCursor, saveCursor, setSoundPref, soundPref, type SoundPref } from '@/lib/sales-alerts'

type Toast = SaleAlert & { blocked: boolean }
type Locks = { request: (name: string, opts: { signal: AbortSignal }, cb: () => Promise<void>) => Promise<void> }

const POLL_MS = 5_000
const RETRY_MS = 30_000
const TOAST_MS = 15_000
const PENDING_MS = 2 * 60_000

const store = () => window.localStorage
const PREF_EVENT = 'bt-admin-sales-pref'

/** The sound preference as React state, shared live by every tab (localStorage + the storage event). */
function subscribePref(cb: () => void) {
  window.addEventListener('storage', cb)
  window.addEventListener(PREF_EVENT, cb)
  return () => {
    window.removeEventListener('storage', cb)
    window.removeEventListener(PREF_EVENT, cb)
  }
}
const prefSnapshot = () => soundPref(store()) ?? 'unset'
const serverPref = () => 'loading' as const
const activated = () => (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? true

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((done) => {
    const t = setTimeout(done, ms)
    signal.addEventListener('abort', () => (clearTimeout(t), done()), { once: true })
  })
}

/**
 * KA-CHING in /admin: a sound and a card for every order PLACED (card once paid, transfer and cash on delivery as
 * soon as they are created; server/admin/sales-feed.ts). One tab of the browser polls (a Web Lock) and tells the
 * others (BroadcastChannel); every order rings once and shows one card, whatever the tabs, refreshes or
 * reconnections (claims in localStorage, lib/sales-alerts.ts). The sound needs a click first (browser autoplay
 * rules): until then, or when the browser refuses, the card alone appears.
 */
export function SalesAlerts() {
  const snapshot = useSyncExternalStore(subscribePref, prefSnapshot, serverPref)
  const pref: SoundPref | 'loading' = snapshot === 'unset' ? null : snapshot
  const [toasts, setToasts] = useState<Toast[]>([])
  const audio = useRef<HTMLAudioElement | null>(null)
  const pending = useRef(new Map<string, { sale: SaleAlert; blocked: boolean; until: number }>())
  const channel = useRef<BroadcastChannel | null>(null)
  const tried = useRef(new Set<string>())

  const show = useCallback(async (sale: SaleAlert, blocked: boolean) => {
    if (!(await claim(store(), `toast:${sale.orderId}`))) return
    setToasts((t) => [{ ...sale, blocked }, ...t.filter((x) => x.orderId !== sale.orderId)].slice(0, 4))
    setTimeout(() => setToasts((t) => t.filter((x) => x.orderId !== sale.orderId)), TOAST_MS)
  }, [])

  /**
   * The sound, once across the tabs: the first tab allowed to play takes it; if its browser refuses after all, it
   * gives the turn back and asks the other tabs to try. True when this tab could not play it.
   */
  const ring = useCallback(async (sale: SaleAlert) => {
    if (soundPref(store()) !== 'on') return false
    if (!activated() || !audio.current) return true
    // Each tab tries an order's sound at most once (no ping-pong between two refusing tabs).
    if (tried.current.has(sale.orderId)) return true
    if (!(await claim(store(), `sound:${sale.orderId}`))) return false
    tried.current.add(sale.orderId)
    audio.current.currentTime = 0
    const ok = await audio.current.play().then(
      () => true,
      () => false,
    )
    if (!ok) {
      release(store(), `sound:${sale.orderId}`)
      channel.current?.postMessage({ type: 'ring', sale })
    }
    return !ok
  }, [])

  /** One order, in this tab: the sound if this tab may play it first, the card if this tab is the one in view. */
  const deliver = useCallback(
    async (sale: SaleAlert) => {
      const blocked = await ring(sale)
      if (document.visibilityState === 'visible') await show(sale, blocked)
      else pending.current.set(sale.orderId, { sale, blocked, until: Date.now() + PENDING_MS })
    },
    [ring, show],
  )

  useEffect(() => {
    audio.current = new Audio(SOUND_URL)
    audio.current.preload = 'auto'

    const ctrl = new AbortController()
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null
    channel.current = bc
    if (bc)
      bc.onmessage = (e) => {
        if (e.data?.type === 'sale') void deliver(e.data.sale as SaleAlert)
        if (e.data?.type === 'ring') void ring(e.data.sale as SaleAlert)
      }
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      for (const [id, x] of pending.current) {
        pending.current.delete(id)
        if (x.until > Date.now()) void show(x.sale, x.blocked)
      }
    }

    // The poller: one tab at a time (the lock passes to another tab when this one closes).
    const poll = async () => {
      let wait = POLL_MS
      while (!ctrl.signal.aborted) {
        try {
          const after = readCursor(store())
          const r = await fetch(`/api/admin/live${after === null ? '' : `?after=${after}`}`, { cache: 'no-store', signal: ctrl.signal })
          if (r.status === 401) return // signed out
          if (!r.ok) throw new Error(String(r.status))
          const d = (await r.json()) as { cursor: number; now: string; sales: SaleAlert[] }
          for (const sale of d.sales) {
            // Once per order, whatever happens; an order placed long ago (admin closed) is only marked as seen.
            if (!(await claim(store(), `seen:${sale.orderId}`)) || !isFresh(sale.at, d.now)) continue
            bc?.postMessage({ type: 'sale', sale })
            await deliver(sale)
          }
          saveCursor(store(), d.cursor)
          wait = POLL_MS
        } catch {
          if (ctrl.signal.aborted) return
          wait = RETRY_MS
        }
        await sleep(wait, ctrl.signal)
      }
    }
    const locks = (navigator as unknown as { locks?: Locks }).locks
    if (locks) locks.request(POLLER_LOCK, { signal: ctrl.signal }, poll).catch(() => {})
    else void poll()

    document.addEventListener('visibilitychange', onVisible)
    return () => {
      ctrl.abort()
      bc?.close()
      channel.current = null
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [deliver, ring, show])

  const choose = (v: 'on' | 'off') => {
    setSoundPref(store(), v)
    window.dispatchEvent(new Event(PREF_EVENT))
    // The click is the browser's permission to play: the sound once, so it is known and unlocked.
    if (v === 'on' && audio.current) {
      audio.current.currentTime = 0
      audio.current.play().catch(() => {})
    }
  }

  return (
    <>
      <div aria-live="polite" className="pointer-events-none fixed top-4 right-4 z-[500] flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-3">
        {toasts.map((t) => (
          <div key={t.orderId} role="status" className="pointer-events-auto overflow-hidden rounded-[16px] bg-paper shadow-[0_24px_60px_-20px_rgba(8,17,19,.45),0_0_0_1px_rgba(8,17,19,.06)]">
            <div className="flex items-start gap-3 p-4">
              <span aria-hidden className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-[17px] text-cyan-300">
                ✓
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold tracking-[0.1em] text-cyan-700 uppercase">{t.kind === 'upsell' ? 'Ofertă post-cumpărare' : 'Comandă nouă'}</p>
                <p className="mt-0.5 text-[16px] font-semibold text-ink">
                  {t.number} · {money(t.total, t.currency)}
                </p>
                <p className="mt-1 truncate text-[13.5px] text-text" title={t.items}>
                  {t.items}
                </p>
                <p className="mt-1 text-[13px] text-muted">
                  {t.paymentMethod === 'card' ? 'Card · plătită' : t.paymentMethod === 'bank_transfer' ? 'Transfer bancar · așteaptă plata' : 'Ramburs · la livrare'}
                  {t.currency !== 'RON' && ` · ≈ ${money(t.totalLei, 'RON')}`}
                </p>
                {t.blocked && <p className="mt-1 text-[12.5px] text-muted">Sunetul a fost blocat de browser: dă un click în pagină ca să-l permiți.</p>}
                <Link href={t.href} className="mt-2 inline-block text-[13.5px] font-semibold text-ink underline underline-offset-4">
                  Vezi comanda →
                </Link>
              </div>
              <button type="button" aria-label="Închide" onClick={() => setToasts((x) => x.filter((y) => y.orderId !== t.orderId))} className="-mt-1 -mr-1 rounded-[8px] px-2 py-1 text-[18px] leading-none text-muted hover:bg-mist hover:text-ink">
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {pref !== 'loading' && (
        <div className="fixed right-4 bottom-4 z-[500] max-md:bottom-3">
          {pref === null ? (
            <div className="flex items-center gap-2 rounded-full bg-ink py-1.5 pr-1.5 pl-4 text-[13px] text-white shadow-lg">
              <span>🔔 Sunet la fiecare comandă nouă?</span>
              <button type="button" onClick={() => choose('on')} className="rounded-full bg-cyan-300 px-3 py-1.5 font-semibold text-ink hover:bg-white">
                Activează sunetele de vânzări
              </button>
              <button type="button" onClick={() => choose('off')} aria-label="Nu acum" className="rounded-full px-2 py-1.5 text-white/60 hover:text-white">
                ×
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => choose(pref === 'on' ? 'off' : 'on')}
              aria-pressed={pref === 'on'}
              title={pref === 'on' ? 'Oprește sunetul la comenzile noi' : 'Pornește sunetul la comenzile noi'}
              className={`rounded-full px-3.5 py-2 text-[12.5px] font-medium shadow-md transition-colors ${pref === 'on' ? 'bg-ink text-white hover:bg-ink/90' : 'bg-paper text-muted ring-1 ring-line hover:text-ink'}`}
            >
              {pref === 'on' ? '🔔 Sunete vânzări pornite' : '🔕 Sunete vânzări oprite'}
            </button>
          )}
        </div>
      )}
    </>
  )
}
