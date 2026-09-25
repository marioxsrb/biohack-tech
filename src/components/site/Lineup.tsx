import Image from 'next/image'
import Link from 'next/link'
import { Arrow } from '@/components/ui/icons'
import { productHref, products } from '@/content/catalog'
import { terms } from '@/config/site'
import { formatMoney } from '@/lib/money'

/**
 * Closing scene: the three products standing on one hairline shelf, as objects.
 * Hover lifts a product off the shelf and its shadow softens. On phones the shelf swipes.
 */
export function Lineup({ title = 'Toate trei.', headingLevel = 2 }: { title?: string; headingLevel?: 1 | 2 }) {
  const H = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <section aria-labelledby="lineup-title" className="bg-mist pt-[var(--sec)] pb-16">
      <div className="wrap">
        <H id="lineup-title" className="text-[clamp(44px,6vw,88px)] leading-[0.95] tracking-[-0.05em]">
          {title}
        </H>
      </div>

      <ul className="lineup wrap mt-12 grid grid-cols-3 gap-6 max-md:mr-0 max-md:flex max-md:snap-x max-md:snap-mandatory max-md:gap-4 max-md:overflow-x-auto max-md:scroll-px-[var(--gut)] max-md:pr-[var(--gut)] max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden">
        {products.map((p) => (
          <li key={p.id} className="max-md:w-[72%] max-md:flex-none max-md:snap-start">
            <Link href={productHref(p)} className="lineup-item group block">
              <span className="lineup-stage relative block aspect-[5/4]">
                <span aria-hidden className="lineup-shadow" />
                <span className="lineup-object absolute inset-x-[6%] top-[8%] bottom-[14%]">
                  <Image src={p.cutout.src} alt={p.cutout.alt} fill sizes="(min-width: 768px) 340px, 72vw" data-kind={p.cutout.kind} className={`object-contain object-bottom ${p.cutout.kind === 'studio' ? 'mix-blend-multiply' : ''}`} />
                </span>
              </span>
              <span className="mt-5 flex items-baseline justify-between gap-4">
                <span className="text-[clamp(22px,2vw,28px)] leading-tight font-medium tracking-[-0.03em] text-ink">{p.name}</span>
                <span className="text-[16px] text-ink tabular-nums">{formatMoney(p.price)}</span>
              </span>
              <span className="mt-1 flex items-center justify-between text-[15px] text-muted">
                {p.purpose}
                <Arrow className="h-4 w-4 text-ink transition-transform duration-200 group-hover:translate-x-1" />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <ul className="wrap mt-16 flex flex-wrap gap-x-8 gap-y-2 font-mono text-[11.5px] tracking-[0.12em] text-muted uppercase max-sm:mt-12">
        <li>Livrare gratuită în România</li>
        <li>Retur în {terms.returnDays} zile</li>
        <li>Garanție {terms.warrantyYears} ani</li>
        <li>Plată cu cardul</li>
      </ul>
    </section>
  )
}
