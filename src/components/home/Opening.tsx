'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'
import { useScrollVars } from '@/components/motion/scroll-vars'
import { BalanceWaveVisual } from '@/components/scenes/BalanceWaveVisual'
import { SceneBuy } from '@/components/scenes/SceneBuy'
import { Arrow } from '@/components/ui/icons'
import { products } from '@/content/catalog'
import { formatMoney } from '@/lib/money'
import hero from '@/assets/img/balance-wave/lifestyle-canapea.webp'

/** Where the device sits in the photograph, as a fraction of its width and height. */
const DEVICE = { x: 0.735, y: 0.47 }

const words = { 'balance-wave': 'Relaxare', 'brainlink-pro': 'Focus', 'ochelari-biohack': 'Ecrane' } as const
const targets = { 'balance-wave': '#relaxare', 'brainlink-pro': '#brainlink', 'ochelari-biohack': '#ochelari' } as const

/**
 * The opening act, one pinned stage, one continuous shot:
 *   the photograph → the camera pushes toward the device while the room goes dark →
 *   three words in the dark → the device itself rises where the photo's device was
 *   heading and switches on → the lights come back up.
 * Every value is a function of scroll position (see globals.css, "OPENING").
 */
export function Opening() {
  const ref = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  useScrollVars(ref)

  // Aim the camera push at the device: map its position in the photo through object-fit: cover.
  useEffect(() => {
    const el = stage.current
    const img = el?.querySelector('img')
    if (!el || !img) return
    const ro = new ResizeObserver(() => {
      const cw = el.clientWidth
      const ch = el.clientHeight
      const s = Math.max(cw / hero.width, ch / hero.height)
      const [px, py] = getComputedStyle(img).objectPosition.split(' ').map((v) => parseFloat(v) / 100)
      const x = (cw - hero.width * s) * px + DEVICE.x * hero.width * s
      const y = (ch - hero.height * s) * py + DEVICE.y * hero.height * s
      el.style.setProperty('--dx', `${x}px`)
      el.style.setProperty('--dy', `${y}px`)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <section
      ref={ref}
      data-dark="0,0.935"
      data-theme="dark"
      data-hero=""
      data-states="hero:0-0.174 words:0.26-0.533 bwcopy:0.652-0.891"
      className="opening relative"
      aria-label="Biohack Tech"
    >
      {/* Anchors land on the readable moments of the pinned sequence. */}
      <span id="produse" aria-hidden className="opening-anchor" style={{ ['--at' as string]: 190 }} />
      <span id="relaxare" aria-hidden className="opening-anchor" style={{ ['--at' as string]: 355 }} />

      <div className="opening-stage sticky top-0 h-[100svh] overflow-hidden">
        <div aria-hidden className="opening-night absolute inset-0 bg-dark" />

        {/* The photograph */}
        <div ref={stage} className="opening-photo absolute inset-0">
          <div className="opening-settle absolute inset-0">
            <Image
              src={hero}
              alt="Femeie relaxată pe canapea, cu Balance Wave la gât"
              fill
              priority
              placeholder="blur"
              sizes="100vw"
              className="object-cover object-[68%_30%] max-sm:object-[74%_22%]"
            />
          </div>
          <div aria-hidden className="absolute inset-x-0 top-0 h-44 bg-[linear-gradient(180deg,rgba(8,17,19,.78)_0%,rgba(8,17,19,.5)_40%,rgba(8,17,19,0)_100%)]" />
          <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,17,19,.72)_0%,rgba(8,17,19,.28)_42%,rgba(8,17,19,0)_62%)] max-md:hidden" />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-[46%] bg-[linear-gradient(0deg,rgba(8,17,19,.9)_0%,rgba(8,17,19,.5)_40%,rgba(8,17,19,0)_100%)] max-md:h-[62%]" />
          <div aria-hidden className="opening-dusk absolute inset-0 bg-dark" />
        </div>

        {/* 1 · Headline */}
        <div className="opening-hero wrap absolute inset-x-0 bottom-0 pb-[clamp(64px,13vh,140px)] text-white">
          <h1 className="text-[clamp(46px,6.6vw,96px)] leading-[0.96] tracking-[-0.045em] !text-white">
            <span className="line-mask">
              <span>Minte limpede.</span>
            </span>
            <span className="line-mask">
              <span className="[animation-delay:.1s]">Corp relaxat.</span>
            </span>
          </h1>
          <div className="hero-rise mt-7 flex flex-wrap items-center gap-x-8 gap-y-5 [animation-delay:.4s] max-sm:mt-5">
            <a href="#produse" className="cta">
              Vezi produsele <Arrow />
            </a>
            <p className="max-w-[17em] text-[16px] leading-snug text-white/85">Trei produse simple, pentru fiecare zi.</p>
          </div>
        </div>

        {/* 2 · Three words in the dark */}
        <nav aria-labelledby="opening-q" className="opening-words wrap absolute inset-x-0 top-1/2 -translate-y-1/2 text-white">
          <p id="opening-q" className="font-mono text-[12px] tracking-[0.14em] text-white/75 uppercase">
            Ce vrei să îmbunătățești?
          </p>
          <ul className="mt-5">
            {products.map((p) => (
              <li key={p.id}>
                <a href={targets[p.id]} className="group flex items-baseline gap-5 py-1.5 max-sm:flex-col max-sm:gap-0">
                  <span className="text-[clamp(52px,8.6vw,124px)] leading-[0.95] font-medium tracking-[-0.055em] transition-colors duration-200 group-hover:text-cyan">
                    {words[p.id]}
                  </span>
                  <span className="text-[16px] text-white/80 md:text-[17px]">
                    {p.name} · {formatMoney(p.price)}
                    <Arrow className="ml-2 inline h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* 3 · Balance Wave */}
        <div className="opening-bw absolute inset-0">
          <BalanceWaveVisual />
          <div className="opening-bw-copy wrap relative pt-[calc(var(--nav-h)+clamp(24px,6vh,72px))]">
            <SceneBuy productId="balance-wave" headingId="bw-title" tone="dark" line="Se poartă la gât. Câteva minute de lumină roșie, apoi se oprește singur." />
          </div>
        </div>

        <a href="#produse" className="opening-cue absolute right-[max(var(--gut),calc((100vw-1152px)/2+var(--gut)))] bottom-10 flex flex-col items-center gap-3 max-md:hidden" aria-label="Derulează la produse">
          <span className="font-mono text-[11.5px] tracking-[0.14em] text-white/80 uppercase [writing-mode:vertical-rl]">Derulează</span>
          <span className="scroll-cue-line" aria-hidden />
        </a>
      </div>
    </section>
  )
}
