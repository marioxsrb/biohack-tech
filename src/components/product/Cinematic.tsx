'use client'

import Image from 'next/image'
import { useRef } from 'react'
import { useScrollVars } from '@/components/motion/scroll-vars'
import type { ProductContent } from '@/content/product-content'

/**
 * A photograph that opens to the edges of the screen as it comes up: it arrives as an
 * inset, rounded frame on the page surface and widens to full bleed, so there is no
 * hard edge where the page meets the picture.
 */
export function Cinematic({ story }: { story: ProductContent['stories'][number] }) {
  const ref = useRef<HTMLElement>(null)
  useScrollVars(ref)
  return (
    <section ref={ref} data-theme="dark" className="cine relative isolate flex h-[88svh] min-h-[560px] items-end overflow-hidden text-white">
      <div className="cine-frame absolute inset-0 -z-10">
        <Image src={story.image.src} alt={story.image.alt} fill placeholder="blur" sizes="100vw" className="cine-img object-cover" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[66%] bg-[linear-gradient(0deg,rgba(8,17,19,.86),rgba(8,17,19,.4)_45%,rgba(8,17,19,0))]" />
      </div>
      <div className="wrap w-full pb-[clamp(40px,8vh,88px)]">
        <h2 className="max-w-[12em] text-[clamp(36px,5vw,72px)] leading-[0.98] tracking-[-0.045em] !text-white">{story.title}</h2>
        <p className="mt-4 max-w-[30em] text-[17px] leading-relaxed text-white/85">{story.text}</p>
      </div>
    </section>
  )
}
