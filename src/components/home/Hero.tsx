'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useScrollVars } from '@/components/motion/scroll-vars'
import { Arrow } from '@/components/ui/icons'
import hero from '@/assets/img/balance-wave/lifestyle-canapea.webp'

/** Where the device sits in the photograph, as a fraction of its width and height. */
const DEVICE = { x: 0.77, y: 0.465 }

/**
 * Scene 1. One photograph that settles in on load and drifts slower than the page on
 * scroll; the headline rises line by line; a hairline annotation marks the device in the
 * photo and links to it. Gradients are local: left and bottom for the type, top for the bar.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null)
  useScrollVars(ref)

  // Map the device's position in the photo to the screen, through object-fit: cover.
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const img = el.querySelector('img')
    const place = () => {
      if (!img) return
      const cw = el.clientWidth
      const ch = el.clientHeight
      const s = Math.max(cw / hero.width, ch / hero.height)
      const w = hero.width * s
      const h = hero.height * s
      const [px, py] = getComputedStyle(img).objectPosition.split(' ').map((v) => parseFloat(v) / 100)
      setSpot({ x: (cw - w) * px + DEVICE.x * w, y: (ch - h) * py + DEVICE.y * h })
    }
    // Fires once on observe, then on every resize.
    const ro = new ResizeObserver(place)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <section ref={ref} className="hero relative isolate h-[100svh] max-h-[1000px] min-h-[620px] overflow-hidden bg-dark text-white">
      <div className="hero-media absolute inset-0 -z-10">
        <div ref={stage} className="hero-settle absolute inset-0">
          <Image
            src={hero}
            alt="Femeie relaxată pe canapea, cu Balance Wave la gât"
            fill
            priority
            placeholder="blur"
            sizes="100vw"
            className="object-cover object-[68%_30%] max-sm:object-[74%_22%]"
          />
          {spot && (
            <Link
              href="/products/balancewave"
              className="hotspot group absolute"
              style={{ left: spot.x, top: spot.y }}
              aria-label="Balance Wave, dispozitivul din fotografie"
            >
              <span className="hotspot-dot" aria-hidden />
              <span className="hotspot-line" aria-hidden />
              <span className="hotspot-label">
                <span className="block font-mono text-[11.5px] tracking-[0.12em] text-white/80 uppercase">În fotografie</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[15px] font-medium text-white">
                  Balance Wave <Arrow className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* Local shading: top for the navigation, left/bottom for the headline, bottom into the next scene. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-44 bg-[linear-gradient(180deg,rgba(8,17,19,.78)_0%,rgba(8,17,19,.5)_40%,rgba(8,17,19,0)_100%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(8,17,19,.72)_0%,rgba(8,17,19,.28)_42%,rgba(8,17,19,0)_62%)] max-md:hidden" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[46%] bg-[linear-gradient(0deg,var(--color-dark)_0%,rgba(8,17,19,.55)_40%,rgba(8,17,19,0)_100%)] max-md:h-[62%]" />

      <div className="hero-copy wrap absolute inset-x-0 bottom-0 pb-[clamp(64px,13vh,140px)]">
        <h1 className="text-[clamp(46px,6.6vw,96px)] leading-[0.96] tracking-[-0.045em] !text-white">
          <span className="line-mask">
            <span>Minte limpede.</span>
          </span>
          <span className="line-mask">
            <span className="[animation-delay:.12s]">Corp relaxat.</span>
          </span>
        </h1>
        <div className="hero-rise mt-7 flex flex-wrap items-center gap-x-8 gap-y-5 [animation-delay:.45s] max-sm:mt-5">
          <a href="#descopera" className="cta">
            Vezi produsele <Arrow />
          </a>
          <p className="max-w-[17em] text-[16px] leading-snug text-white/85">Trei produse simple, pentru fiecare zi.</p>
        </div>
      </div>

      <a href="#descopera" className="scroll-cue absolute right-[max(var(--gut),calc((100vw-1152px)/2+var(--gut)))] bottom-10 flex flex-col items-center gap-3 max-md:hidden" aria-label="Derulează la produse">
        <span className="font-mono text-[11.5px] tracking-[0.14em] text-white/80 uppercase [writing-mode:vertical-rl]">Derulează</span>
        <span className="scroll-cue-line" aria-hidden />
      </a>
    </section>
  )
}
