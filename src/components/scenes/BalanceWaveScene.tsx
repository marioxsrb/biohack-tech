'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef } from 'react'
import { AddToCartButton } from '@/components/cart/AddToCartButton'
import { useScrollVars } from '@/components/motion/scroll-vars'
import { Arrow } from '@/components/ui/icons'
import { getProduct, productHref } from '@/content/catalog'
import { formatMoney } from '@/lib/money'

/** Annotation anchors, as fractions of the device image (631×478). */
const notes = [
  { x: 0.3, y: 0.26, side: 'left', title: 'Lumină roșie', detail: 'din ambele părți' },
  { x: 0.72, y: 0.22, side: 'right', title: '5–20 minute', detail: 'pe ședință' },
  { x: 0.74, y: 0.64, side: 'right', title: 'Se oprește singur', detail: 'la final' },
] as const

/**
 * Scene 3. The room dims, the device rises from the lower edge and switches on:
 * desaturated to red, with a soft red bloom behind it. Hairline notes draw in once
 * it's on. At the end the lights come back up into the next scene.
 * Everything follows --pin (scroll position inside the sticky stage).
 */
export function BalanceWaveScene({ mode = 'home' }: { mode?: 'home' | 'page' }) {
  const ref = useRef<HTMLElement>(null)
  const product = getProduct('balance-wave')!
  useScrollVars(ref)

  return (
    <section ref={ref} id="balance-wave" aria-labelledby="bw-title" className="bw-scene relative h-[210vh] max-sm:h-[190vh]">
      <div className="bw-stage sticky top-0 flex h-[100svh] flex-col overflow-hidden">
        <div aria-hidden className="bw-bloom pointer-events-none absolute inset-0" />
        <p aria-hidden className="bw-giant pointer-events-none absolute inset-x-0 top-[14%] text-center leading-none font-medium tracking-[-0.06em] whitespace-nowrap select-none max-md:top-[30%]">
          Balance Wave
        </p>

        <div className="bw-copy wrap relative z-10 w-full pt-[calc(var(--nav-h)+clamp(28px,6vh,72px))]">
          <div className="max-w-[26rem]">
            <p className="bw-soft font-mono text-[11.5px] tracking-[0.14em] uppercase">Pentru relaxare</p>
            <h2 id="bw-title" className="mt-3 text-[clamp(36px,4vw,56px)] leading-[1] tracking-[-0.045em] ![color:var(--ink)]">
              Câteva minute de lumină, la gât.
            </h2>
            <p className="bw-soft mt-4 text-[16.5px] leading-relaxed max-sm:text-[15.5px]">
              Îl așezi, alegi durata și te relaxezi. Se oprește singur.
            </p>
            <p className="bw-soft mt-4 font-mono text-[11.5px] tracking-[0.12em] uppercase md:hidden">Lumină roșie · 5–20 min · Oprire automată</p>
            {mode === 'home' && (
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                <span className="text-[19px] font-medium tabular-nums">{formatMoney(product.price)}</span>
                <Link href={productHref(product)} className="tlink ![color:var(--ink)]">
                  Vezi Balance Wave <Arrow />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* The device, anchored to the lower edge: its cable is cropped in the source photo. */}
        <div className="bw-device relative z-0 mx-auto mt-auto w-[min(760px,92vw)]">
          <div className="relative aspect-[631/478]">
            <Image src={product.cutout.src} alt={product.cutout.alt} fill sizes="(min-width: 768px) 760px, 92vw" className="bw-device-img object-contain object-bottom" />
            {/* Hairline notes reach past the device's edge, so the text never sits on the white device. Hidden on phones. */}
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
                  <span className="block text-[14px] font-medium text-white">{n.title}</span>
                  <span className="block font-mono text-[11.5px] tracking-[0.1em] text-white/70 uppercase">{n.detail}</span>
                </span>
              </span>
            ))}
          </div>
        </div>

        {mode === 'page' && (
          <div className="absolute right-[var(--gut)] bottom-8 z-10 max-md:hidden">
            <AddToCartButton productId={product.id} size="sm" />
          </div>
        )}
      </div>
    </section>
  )
}
