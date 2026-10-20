'use client'

/**
 * Before the 10% offer on the NEUROS Amber pages: an evening desk seen through your own eyes (monitor, laptop,
 * phone, all cold blue light) and a bar to drag from left to right. Behind the bar the light turns warm, as through
 * the Amber lens. At the end of the bar the gift (the 10% window) opens.
 */
import Image from 'next/image'
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

import { Close } from '@/components/ui/icons'
import birou from '@/assets/img/glasses/birou-noapte-pov.webp'

const DONE_AT = 0.96

export function AmberGate({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [p, setP] = useState(0)
  const [dragging, setDragging] = useState(false)
  const track = useRef<HTMLDivElement>(null)

  const at = (clientX: number) => {
    const r = track.current!.getBoundingClientRect()
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width))
  }
  const finish = (v: number) => {
    if (v >= DONE_AT) {
      setP(1)
      setTimeout(onDone, 450)
    } else setP(0)
  }
  const down = (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    setP(at(e.clientX))
  }
  const move = (e: ReactPointerEvent) => dragging && setP(at(e.clientX))
  const up = (e: ReactPointerEvent) => {
    setDragging(false)
    finish(at(e.clientX))
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="amber-gate-title"
      className="relative w-full max-w-[880px] overflow-hidden rounded-[24px] bg-ink shadow-[0_40px_100px_-30px_rgba(0,0,0,.6)]"
    >
      <div className="relative aspect-[16/10] w-full max-sm:aspect-square">
        <Image src={birou} alt="Un birou seara, văzut prin ochii tăi: monitor, laptop și telefon, toate cu lumină albastră" fill priority sizes="(max-width: 640px) 100vw, 880px" className="object-cover" />
        {/* Through the lens: the same photo, warm, revealed up to the bar. */}
        <div
          aria-hidden
          className={`absolute inset-0 ${dragging ? '' : 'transition-[clip-path] duration-500 ease-[var(--ease-brand)]'}`}
          style={{ clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }}
        >
          <Image src={birou} alt="" fill sizes="(max-width: 640px) 100vw, 880px" className="object-cover [filter:sepia(1)_saturate(2.4)_hue-rotate(-14deg)_brightness(0.92)]" />
          <span className="absolute inset-y-0 right-0 w-[2px] bg-white/70 shadow-[0_0_18px_rgba(255,196,0,.9)]" />
        </div>
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,17,19,.72)_0%,rgba(8,17,19,0)_38%,rgba(8,17,19,0)_62%,rgba(8,17,19,.78)_100%)]" />

        <button type="button" onClick={onClose} aria-label="Închide" className="absolute top-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25">
          <Close className="h-4 w-4" />
        </button>

        <div className="absolute inset-x-0 top-0 p-[clamp(20px,4vw,40px)] pr-16">
          <h2 id="amber-gate-title" className="max-w-[14em] text-[clamp(26px,3.6vw,42px)] leading-[1.04] font-semibold tracking-[-0.035em] !text-white text-balance">
            Evită lumina albastră ca să dormi mai bine.
          </h2>
          <p className="mt-2 text-[16px] text-white/85 md:text-[17px]">Trage bara și vezi seara prin NEUROS Amber. La capăt te așteaptă un cadou.</p>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-[clamp(16px,3.5vw,32px)]">
          <div
            ref={track}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => (setDragging(false), setP(0))}
            className="relative h-16 touch-none rounded-full bg-white/15 backdrop-blur-md select-none"
          >
            <div aria-hidden className={`absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#f5b400,#ffd23f)] ${dragging ? '' : 'transition-[width] duration-500 ease-[var(--ease-brand)]'}`} style={{ width: `calc(64px + ${p} * (100% - 64px))` }} />
            <span aria-hidden className={`absolute inset-0 flex items-center justify-center pl-12 text-[15px] font-semibold tracking-[0.01em] text-white transition-opacity ${p > 0.15 ? 'opacity-0' : 'opacity-100'}`}>
              Trage bara spre dreapta →
            </span>
            {p >= DONE_AT && <span className="absolute inset-0 flex items-center justify-center text-[15px] font-semibold text-ink">Cadoul tău se deschide…</span>}
            <div
              role="slider"
              tabIndex={0}
              aria-label="Trage bara ca să primești cadoul"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(p * 100)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'End') {
                  e.preventDefault()
                  const v = e.key === 'End' ? 1 : Math.min(1, p + 0.1)
                  setP(v)
                  if (v >= DONE_AT) finish(v)
                }
                if (e.key === 'ArrowLeft') setP(Math.max(0, p - 0.1))
              }}
              className={`absolute top-1 left-1 flex h-14 w-14 cursor-grab items-center justify-center rounded-full bg-white text-ink shadow-[0_6px_20px_rgba(0,0,0,.35)] outline-none focus-visible:ring-4 focus-visible:ring-white/50 active:cursor-grabbing ${dragging ? '' : 'transition-[left] duration-500 ease-[var(--ease-brand)]'}`}
              style={{ left: `calc(4px + ${p} * (100% - 64px))` }}
            >
              {/* A pair of glasses. */}
              <svg aria-hidden viewBox="0 0 32 16" className="h-5 w-9">
                <circle cx="8" cy="9" r="5.5" fill="#ffc400" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="24" cy="9" r="5.5" fill="#ffc400" stroke="currentColor" strokeWidth="1.8" />
                <path d="M13.5 8.5c1.6-1.4 3.4-1.4 5 0M2.5 8 .8 5.5M29.5 8l1.7-2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
