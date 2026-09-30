import Image from 'next/image'
import Link from 'next/link'
import { Arrow } from '@/components/ui/icons'
import { productHref, products } from '@/content/catalog'
import { terms } from '@/config/site'
import { Price } from '@/components/cart/Price'
import { PromoNote } from '@/components/cart/PromoNote'

/**
 * All products side by side on one shelf line (two per row on tablets). Hover lifts a product and softens its
 * shadow. On phones the shelf swipes.
 */
export function Lineup({ title = 'Toate produsele.', headingLevel = 2 }: { title?: string; headingLevel?: 1 | 2 }) {
  const H = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <section aria-labelledby="lineup-title" className="pt-[var(--sec)] pb-[calc(var(--sec)*0.6)]">
      <div className="wrap">
        <H id="lineup-title" className="text-[clamp(44px,6vw,88px)] leading-[0.95] tracking-[-0.05em]">
          {title}
        </H>
      </div>

      <ul className="wrap mt-12 grid grid-cols-2 gap-6 gap-y-12 lg:grid-cols-4 max-md:mr-0 max-md:flex max-md:snap-x max-md:snap-mandatory max-md:scroll-px-[var(--gut)] max-md:gap-4 max-md:overflow-x-auto max-md:pr-[var(--gut)] max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden">
        {products.map((p) => (
          <li key={p.id} className="max-md:w-[72%] max-md:flex-none max-md:snap-start">
            <Link href={productHref(p)} className="group block">
              <span className="relative block aspect-[5/4] border-b border-line">
                <span aria-hidden className="shade absolute bottom-[4%] left-[18%] h-4 w-[64%] rounded-[50%]" />
                <span className="lift absolute inset-x-[6%] top-[8%] bottom-[8%]">
                  <Image src={p.cutout.src} alt="" fill sizes="(min-width: 1024px) 280px, (min-width: 768px) 45vw, 72vw" className="object-contain object-bottom" />
                </span>
              </span>
              <span className="mt-5 flex flex-col items-start gap-x-4 xl:flex-row xl:items-baseline xl:justify-between">
                <span className="text-[clamp(22px,2vw,28px)] leading-tight font-medium tracking-[-0.03em] text-ink">{p.name}</span>
                <span className="text-[17px] whitespace-nowrap text-ink tabular-nums max-lg:mt-0.5">
                  <Price productId={p.id} />
                </span>
              </span>
              <span className="mt-1 flex items-center justify-between gap-3 text-[15.5px] text-muted">
                {p.purpose}
                <span className="flex items-center gap-1.5 font-medium whitespace-nowrap text-ink">
                  <span className="lg:sr-only">Vezi produsul</span> <Arrow className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </span>
              <PromoNote productId={p.id} className="mt-3" />
            </Link>
          </li>
        ))}
      </ul>

      <ul className="wrap mt-14 flex flex-wrap gap-x-8 gap-y-2 text-[15px] text-text max-sm:mt-10">
        <li>✓ Livrare gratuită în România</li>
        <li>✓ Retur în {terms.returnDays} zile</li>
        <li>✓ Garanție {terms.warrantyYears} ani</li>
        <li>✓ Îți răspundem {terms.responseTime}</li>
      </ul>
    </section>
  )
}
