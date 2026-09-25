'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef } from 'react'
import { useScrollVars } from '@/components/motion/scroll-vars'
import { Arrow } from '@/components/ui/icons'
import { productHref, products } from '@/content/catalog'
import { terms } from '@/config/site'
import { formatMoney } from '@/lib/money'

/**
 * The resolution: the three things you just met, rising onto one shelf in turn.
 * Hover lifts a product off the shelf. On phones the shelf swipes.
 */
export function Lineup({ title = 'Toate trei.', headingLevel = 2 }: { title?: string; headingLevel?: 1 | 2 }) {
  const ref = useRef<HTMLElement>(null)
  useScrollVars(ref)
  const H = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <section ref={ref} aria-labelledby="lineup-title" className="lineup pt-[var(--sec)] pb-[calc(var(--sec)*0.6)]">
      <div className="wrap">
        <H id="lineup-title" className="text-[clamp(44px,6vw,88px)] leading-[0.95] tracking-[-0.05em]">
          {title}
        </H>
      </div>

      <ul className="wrap mt-12 grid grid-cols-3 gap-6 max-md:mr-0 max-md:flex max-md:snap-x max-md:snap-mandatory max-md:scroll-px-[var(--gut)] max-md:gap-4 max-md:overflow-x-auto max-md:pr-[var(--gut)] max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden">
        {products.map((p, i) => (
          <li key={p.id} className="max-md:w-[72%] max-md:flex-none max-md:snap-start">
            <Link href={productHref(p)} className="lineup-item group block">
              <span className="relative block aspect-[5/4] border-b border-line">
                <span className="lineup-object absolute inset-x-[6%] top-[8%] bottom-[12%]" style={{ ['--start' as string]: 24 + i * 5 }}>
                  <span className="lineup-lift absolute inset-0">
                    <Image src={p.cutout.src} alt={p.cutout.alt} fill sizes="(min-width: 768px) 340px, 72vw" className="object-contain object-bottom" />
                  </span>
                  <span aria-hidden className="lineup-shadow" />
                </span>
              </span>
              <span className="mt-5 flex items-baseline justify-between gap-4">
                <span className="text-[clamp(22px,2vw,28px)] leading-tight font-medium tracking-[-0.03em] text-ink">{p.name}</span>
                <span className="text-[17px] text-ink tabular-nums">{formatMoney(p.price)}</span>
              </span>
              <span className="mt-1 flex items-center justify-between text-[15.5px] text-muted">
                {p.purpose}
                <span className="flex items-center gap-1.5 font-medium text-ink">
                  Vezi produsul <Arrow className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <ul className="wrap mt-14 flex flex-wrap gap-x-8 gap-y-2 text-[15px] text-text max-sm:mt-10">
        <li>✓ Livrare gratuită în România</li>
        <li>✓ Retur în {terms.returnDays} zile</li>
        <li>✓ Garanție {terms.warrantyYears} ani</li>
        <li>✓ Plată cu cardul</li>
      </ul>
    </section>
  )
}
