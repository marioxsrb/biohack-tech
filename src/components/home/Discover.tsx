'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Arrow } from '@/components/ui/icons'
import Link from 'next/link'
import { productHref, products } from '@/content/catalog'
import { formatMoney } from '@/lib/money'

/** Scene anchors on the homepage, in catalog order. */
export const sceneIds = { 'balance-wave': 'balance-wave-buy', 'brainlink-pro': 'brainlink-buy', 'ochelari-biohack': 'ochelari' } as const

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
          <span id="produse" aria-hidden className="block scroll-mt-[calc(var(--nav-h)+32px)]" />
          <p id="descopera-title" className="discover-fg font-mono text-[12px] tracking-[0.14em] uppercase">
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
                  className="discover-word group flex items-center justify-between gap-4 py-1.5"
                >
                  <span className="flex items-baseline gap-4 md:gap-6">
                    <span className="font-mono text-[12px] tracking-[0.1em] text-cyan-700 max-sm:hidden" aria-hidden>
                      0{i + 1}
                    </span>
                    <span>
                      <span className="discover-term block text-[clamp(52px,9vw,128px)] leading-[0.95] font-medium tracking-[-0.055em]">{words[p.id]}</span>
                      {/* Which product the word means, and what it costs. */}
                      <span className="discover-term mt-1 block text-[16px] font-normal tracking-normal text-muted md:text-[17px]">
                        {p.name} · {formatMoney(p.price)}
                      </span>
                    </span>
                  </span>
                  {/* On phones each word carries its product, since there is no hover. */}
                  <span className="relative h-16 w-24 flex-none md:hidden" aria-hidden>
                    <Image src={p.cutout.src} alt="" fill sizes="96px" className="object-contain" />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Desktop: the product that answers the word under the pointer. It's a real link. */}
        <div className="relative hidden aspect-square md:col-span-5 md:block">
          {products.map((p, i) => (
            <Link
              key={p.id}
              href={productHref(p)}
              data-active={active === i}
              tabIndex={active === i ? 0 : -1}
              aria-hidden={active !== i}
              className="discover-product group absolute inset-0 flex flex-col justify-center"
            >
              <span className="relative block aspect-[4/3] w-full">
                <Image src={p.cutout.src} alt="" fill sizes="(min-width: 1152px) 460px, 40vw" className="object-contain transition-transform duration-300 group-hover:-translate-y-1" />
              </span>
              <span className="mt-6 flex items-center justify-between border-t border-line pt-4 text-[16px]">
                <span className="font-medium text-ink">Vezi {p.name}</span>
                <Arrow className="h-4 w-4 text-ink transition-transform duration-200 group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
