'use client'

import Image from 'next/image'
import { useRef } from 'react'
import { useScrollVars } from '@/components/motion/scroll-vars'
import { getProduct } from '@/content/catalog'
import { SceneBuy } from './SceneBuy'

/**
 * BrainLink, as a hardware campaign: one large headset floating over the page with a
 * soft contact shadow. Scroll lifts and levels it; the copy arrives once it has settled.
 * On the homepage it overlaps the end of the opening, so the headset rises while the
 * lights are still coming up.
 */
export function BrainLinkScene() {
  const ref = useRef<HTMLElement>(null)
  const p = getProduct('brainlink-pro')!
  useScrollVars(ref)

  return (
    <section
      ref={ref}
      id="brainlink"
      aria-labelledby="bl-title"
      className="bl relative z-10 -mt-[55vh] overflow-hidden pt-[40vh] pb-[var(--sec)] max-md:-mt-[45vh]"
    >
      <div className="wrap relative grid min-h-[92svh] grid-cols-1 items-center gap-y-8 md:grid-cols-12 md:gap-x-6">
        <div className="bl-copy relative md:col-span-5 md:row-start-1 max-md:order-2">
          <SceneBuy
            productId="brainlink-pro"
            headingId="bl-title"
            line="O cască ușoară și jocuri pe tabletă. Când ești atent, jocul înaintează."
          />
        </div>

        <div className="bl-hero relative md:col-span-7 md:col-start-6 md:row-start-1 max-md:order-1">
          <div className="relative aspect-[964/633] w-full">
            <Image src={p.cutout.src} alt={p.cutout.alt} fill sizes="(min-width: 768px) 640px, 92vw" className="object-contain" />
          </div>
          <span aria-hidden className="bl-shadow absolute -bottom-2 left-[20%] h-8 w-[60%] rounded-[50%]" />
        </div>
      </div>
    </section>
  )
}
