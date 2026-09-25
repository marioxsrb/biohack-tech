'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Arrow } from '@/components/ui/icons'
import { products } from '@/content/catalog'
import { formatMoney } from '@/lib/money'

/** Scene anchors on the homepage, in catalog order. */
export const sceneIds = { 'balance-wave': 'balance-wave', 'brainlink-pro': 'brainlink', 'ochelari-biohack': 'ochelari' } as const

const words = { 'balance-wave': 'Relaxare', 'brainlink-pro': 'Focus', 'ochelari-biohack': 'Ecrane' } as const

/**
 * Scene 2. The section opens in the hero's dark and fades to mist, so there is no hard
 * edge between photograph and store. Three words index the three
 * products; hovering one brings that product forward, tapping one goes to its scene.
 */
export function Discover() {
  const [active, setActive] = useState(0)

  return (
    <section id="descopera" aria-labelledby="descopera-title" className="discover relative scroll-mt-0 overflow-hidden">
      <div className="wrap grid grid-cols-1 items-center gap-y-10 pt-[clamp(240px,40vh,420px)] pb-[var(--sec)] md:grid-cols-12 md:gap-x-6 max-sm:pt-[200px]">
        <div className="md:col-span-7">
          <p id="descopera-title" className="discover-fg font-mono text-[11.5px] tracking-[0.14em] uppercase">
            Ce vrei să îmbunătățești?
          </p>
          <ul className="mt-6 max-sm:mt-4">
            {products.map((p, i) => (
              <li key={p.id}>
                <a
                  href={`#${sceneIds[p.id]}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  data-active={active === i}
                  className="discover-word group flex items-center justify-between gap-4 py-1"
                >
                  <span className="flex items-baseline gap-4 md:gap-6">
                    <span className="font-mono text-[12px] tracking-[0.1em] text-cyan-700 max-sm:hidden">0{i + 1}</span>
                    <span className="text-[clamp(56px,9.4vw,136px)] leading-[0.95] font-medium tracking-[-0.055em]">{words[p.id]}</span>
                  </span>
                  {/* On phones each word carries its product, since there is no hover. */}
                  <span className="relative h-16 w-24 flex-none md:hidden">
                    <Image src={p.cutout.src} alt="" fill sizes="96px" data-kind={p.cutout.kind} className={`object-contain ${p.cutout.kind === 'studio' ? 'mix-blend-multiply' : ''}`} />
                  </span>
                  <span className="sr-only">: {p.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Desktop: the product that answers the word under the pointer. */}
        <div className="relative hidden aspect-square md:col-span-5 md:block" aria-hidden>
          {products.map((p, i) => (
            <div key={p.id} data-active={active === i} className="discover-product absolute inset-0 flex flex-col justify-center">
              <div className="relative aspect-[4/3] w-full">
                <Image src={p.cutout.src} alt="" fill sizes="(min-width: 1152px) 460px, 40vw" data-kind={p.cutout.kind} className={`object-contain ${p.cutout.kind === 'studio' ? 'mix-blend-multiply' : ''}`} />
              </div>
              <p className="mt-6 flex items-baseline justify-between border-t border-line pt-4 text-[15px]">
                <span className="font-medium text-ink">{p.name}</span>
                <span className="flex items-center gap-2 text-muted">
                  {formatMoney(p.price)} <Arrow className="h-3.5 w-3.5" />
                </span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
