'use client'

/**
 * The main site's popup (and NEUROS Calm's): three gift boxes. The visitor opens one; the server draws what is
 * inside (100 lei, 12,33% or 10%), the other two show the remaining gifts, and the email form sends that gift's
 * code. An opened box is remembered on this browser, so reopening the window shows the same gift.
 */
import { useState } from 'react'

import { Close } from '@/components/ui/icons'

export type Gift = { id: string; gift: 'p10' | 'p1233' | 'lei100'; title: string; badge: string; detail: string }

const KEY = 'bt-gift'
const ALL: { gift: Gift['gift']; badge: string }[] = [
  { gift: 'lei100', badge: '−100 lei' },
  { gift: 'p1233', badge: '−12,33%' },
  { gift: 'p10', badge: '−10%' },
]
const COLORS = [
  { box: '#d23b3b', lid: '#b52e2e', ribbon: '#ffd23f' },
  { box: '#0e7490', lid: '#0b5f76', ribbon: '#ffd23f' },
  { box: '#f2c21b', lid: '#d9a90a', ribbon: '#d23b3b' },
]

export const savedGift = (): Gift | null => {
  try {
    const g = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Gift | null
    return g && typeof g.id === 'string' && typeof g.title === 'string' ? g : null
  } catch {
    return null
  }
}

function Box({ i, open, label }: { i: number; open: boolean; label?: string }) {
  const c = COLORS[i]
  return (
    <span className="relative block aspect-square w-full">
      {/* What was inside, rising out of the box. */}
      {label && (
        <span className={`absolute inset-x-0 top-[22%] z-20 flex justify-center transition-all delay-200 duration-700 ease-[var(--ease-brand)] ${open ? '-translate-y-[78%] opacity-100' : 'translate-y-0 opacity-0'}`}>
          <span className="rounded-full bg-white px-3 py-1.5 text-[clamp(14px,3.6vw,19px)] font-extrabold whitespace-nowrap text-ink shadow-[0_8px_24px_rgba(0,0,0,.35)]">{label}</span>
        </span>
      )}
      <svg viewBox="0 0 120 120" className="relative z-10 h-full w-full" aria-hidden>
        <rect x="18" y="52" width="84" height="58" rx="8" fill={c.box} />
        <rect x="54" y="52" width="12" height="58" fill={c.ribbon} />
        <g className={`transition-transform duration-500 ease-[var(--ease-brand)] [transform-box:fill-box] [transform-origin:20%_100%] ${open ? '-translate-x-[14px] translate-y-[6px] -rotate-[38deg]' : ''}`}>
          <rect x="12" y="36" width="96" height="20" rx="6" fill={c.lid} />
          <rect x="54" y="36" width="12" height="20" fill={c.ribbon} />
          <path d="M60 36c-6-14-24-18-26-8-2 8 14 10 26 8zM60 36c6-14 24-18 26-8 2 8-14 10-26 8z" fill={c.ribbon} />
        </g>
      </svg>
    </span>
  )
}

export function GiftGate({ onDone, onClose }: { onDone: (g: Gift) => void; onClose: () => void }) {
  const [won, setWon] = useState<Gift | null>(() => savedGift())
  const [picked, setPicked] = useState<number | null>(() => (savedGift() ? 1 : null))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const open = async (i: number) => {
    if (busy || won) return
    setBusy(true)
    setPicked(i)
    setError(false)
    const res = await fetch('/api/welcome/gift', { method: 'POST' }).catch(() => null)
    const g = (await res?.json().catch(() => null)) as (Gift & { ok?: boolean }) | null
    setBusy(false)
    if (!g?.ok) {
      setPicked(null)
      return setError(true)
    }
    const gift: Gift = { id: g.id, gift: g.gift, title: g.title, badge: g.badge, detail: g.detail }
    try {
      localStorage.setItem(KEY, JSON.stringify(gift))
    } catch {}
    setWon(gift)
  }

  // The chosen box holds the drawn gift; the other two the remaining ones, in order.
  const others = won ? ALL.filter((a) => a.gift !== won.gift) : []
  const labelFor = (i: number) => (!won ? undefined : i === picked ? won.badge : others[i < (picked ?? 0) ? i : i - 1]?.badge)

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="gift-title" className="relative w-full max-w-[640px] overflow-hidden rounded-[24px] bg-[radial-gradient(120%_90%_at_50%_0%,#163a44_0%,#0b1316_70%)] p-[clamp(22px,5vw,44px)] text-center shadow-[0_40px_100px_-30px_rgba(0,0,0,.6)]">
      <button type="button" onClick={onClose} aria-label="Închide" className="absolute top-3 right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
        <Close className="h-4 w-4" />
      </button>
      <p className="text-[13px] font-semibold tracking-[0.14em] text-[#5fe0cc] uppercase">{won ? 'Felicitări' : 'Un cadou pentru tine'}</p>
      <h2 id="gift-title" className="mx-auto mt-2 max-w-[16em] text-[clamp(28px,5vw,42px)] leading-[1.04] font-semibold tracking-[-0.035em] !text-white text-balance">
        {won ? `Ai câștigat ${won.title}!` : 'Alege o cutie.'}
      </h2>
      <p className="mx-auto mt-3 max-w-[30em] text-[16px] leading-snug text-white/75">
        {won ? `${won.detail}. Îți trimitem codul pe email.` : 'În ele sunt 100 lei, 12,33% și 10% reducere la prima comandă. Deschide una și vezi ce ai câștigat.'}
      </p>

      <div className="mt-[clamp(28px,6vw,48px)] grid grid-cols-3 gap-[clamp(10px,3vw,28px)] px-[clamp(0px,3vw,24px)]">
        {[0, 1, 2].map((i) => {
          const isPicked = picked === i
          const faded = won && !isPicked
          return (
            <button
              key={i}
              type="button"
              disabled={!!won || busy}
              onClick={() => open(i)}
              aria-label={won ? (isPicked ? `Cutia ta: ${won.title}` : `În cutia ${i + 1}: ${labelFor(i)}`) : `Deschide cutia ${i + 1}`}
              className={`group relative rounded-[18px] transition duration-300 ${won ? '' : 'hover:-translate-y-1.5 focus-visible:-translate-y-1.5'} ${faded ? 'opacity-45 saturate-50' : ''} ${busy && isPicked ? 'animate-[gift-shake_.5s_ease-in-out_infinite]' : ''} outline-none focus-visible:ring-4 focus-visible:ring-white/40`}
            >
              <Box i={i} open={!!won} label={labelFor(i)} />
              {!won && <span className="mt-2 block text-[14px] font-semibold text-white/80">Cutia {i + 1}</span>}
              {won && isPicked && <span className="mt-2 block text-[14px] font-semibold text-[#ffd23f]">Cadoul tău</span>}
            </button>
          )
        })}
      </div>

      {error && <p className="mt-5 text-[14px] text-[#ff9a9a]">Nu am putut deschide cutia. Încearcă din nou.</p>}
      {won && (
        <button type="button" onClick={() => onDone(won)} className="cta mx-auto mt-8 w-full max-w-[380px]">
          Vreau codul pe email
        </button>
      )}
    </div>
  )
}
