'use client'

import Image from 'next/image'
import { useRef } from 'react'
import { useScrollVars } from '@/components/motion/scroll-vars'
import { getProduct } from '@/content/catalog'
import { SceneBuy } from './SceneBuy'

/** Annotation anchors, as fractions of the device image (631×478). */
const notes = [
  { x: 0.3, y: 0.26, side: 'left', title: 'Lumină roșie', detail: 'din ambele părți' },
  { x: 0.72, y: 0.22, side: 'right', title: '5–20 minute', detail: 'pe ședință' },
  { x: 0.74, y: 0.64, side: 'right', title: 'Se oprește singur', detail: 'la final' },
] as const

/**
 * Scene 3. A fixed gradient takes the page from mist to dark (no animated colour, so text
 * is never caught mid-transition). On the dark stage the device rises and switches on:
 * a grey layer crossfades to the lit photo, a red bloom grows, notes draw in, then the
 * scene holds still long enough to read and buy.
 */
export function BalanceWaveScene({ mode = 'home' }: { mode?: 'home' | 'page' }) {
  const ref = useRef<HTMLDivElement>(null)
  const product = getProduct('balance-wave')!
  useScrollVars(ref)

  return (
    <section id="balance-wave" aria-labelledby="bw-title" className="relative bg-dark">
      {/* Anchor target: lands on the lit, readable state rather than the start of the scene. */}
      <span id="balance-wave-buy" aria-hidden className="absolute top-[calc(28vh+56vh)] left-0" />
      <div
        aria-hidden
        className={`h-[28vh] ${
          mode === 'home'
            ? 'bg-[linear-gradient(180deg,var(--color-mist),#9aa6ab_40%,#2a383c_78%,var(--color-dark))]'
            : 'bg-[linear-gradient(180deg,var(--color-paper),#9aa6ab_40%,#2a383c_78%,var(--color-dark))]'
        }`}
      />

      <div ref={ref} className="bw-scene relative h-[200vh] max-sm:h-[180vh]">
        <div className="bw-stage sticky top-0 flex h-[100svh] flex-col overflow-hidden bg-dark">
          <div aria-hidden className="bw-bloom pointer-events-none absolute inset-0" />
          <p
            aria-hidden
            className="bw-giant pointer-events-none absolute inset-x-0 top-[16%] text-center leading-none font-medium tracking-[-0.06em] whitespace-nowrap select-none max-md:top-[34%]"
          >
            Balance Wave
          </p>

          <div className="bw-copy wrap relative z-10 w-full pt-[calc(var(--nav-h)+clamp(24px,5vh,64px))]">
            <SceneBuy
              productId="balance-wave"
              headingId="bw-title"
              tone="dark"
              line="Se poartă la gât. Câteva minute de lumină roșie, apoi se oprește singur."
              showLink={mode === 'home'}
            />
          </div>

          {/* The device, anchored to the lower edge: its cable is cropped in the source photo. */}
          <div className="bw-device relative z-0 mx-auto mt-auto w-[min(700px,90vw)] max-sm:w-[82vw]">
            <div className="relative aspect-[631/478]">
              {/* Off: a static grey copy. On: the lit photo fades in over it. Opacity only, no animated filters. */}
              <Image src={product.cutout.src} alt="" aria-hidden fill sizes="(min-width: 768px) 700px, 82vw" className="object-contain object-bottom brightness-[.82] grayscale" />
              <Image src={product.cutout.src} alt={product.cutout.alt} fill sizes="(min-width: 768px) 700px, 82vw" className="bw-lit object-contain object-bottom" />
              {notes.map((n) => (
                <span
                  key={n.title}
                  aria-hidden
                  className={`bw-note bw-note-${n.side} max-md:hidden`}
                  style={
                    n.side === 'left'
                      ? { right: `${(1 - n.x) * 100}%`, top: `${n.y * 100}%`, width: `calc(${n.x * 100}% + 40px)` }
                      : { left: `${n.x * 100}%`, top: `${n.y * 100}%`, width: `calc(${(1 - n.x) * 100}% + 40px)` }
                  }
                >
                  <span className="bw-note-dot" />
                  <span className="bw-note-line" />
                  <span className="bw-note-text">
                    <span className="block text-[15px] font-medium text-white">{n.title}</span>
                    <span className="block font-mono text-[11.5px] tracking-[0.1em] text-white/70 uppercase">{n.detail}</span>
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
