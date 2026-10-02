import Image from 'next/image'
import Link from '@/components/ui/Link'
import { Arrow } from '@/components/ui/icons'
import { productHref, productsIn } from '@/content/catalog'
import { getLocale, getUi } from '@/i18n/server'
import { Price } from '@/components/cart/Price'
import { PromoNote } from '@/components/cart/PromoNote'

/**
 * All products side by side on one shelf line (two per row on tablets). Hover lifts a product and softens its
 * shadow. On phones the shelf swipes.
 */
const COPY = {
  ro: { title: 'Toate produsele.', view: 'Vezi produsul' },
  en: { title: 'All products.', view: 'View the product' },
}

export async function Lineup({ title, headingLevel = 2 }: { title?: string; headingLevel?: 1 | 2 }) {
  const locale = await getLocale()
  const t = COPY[locale]
  const ui = await getUi()
  const products = productsIn(locale)
  const H = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <section aria-labelledby="lineup-title" className="pt-[var(--sec)] pb-[calc(var(--sec)*0.6)]">
      <div className="wrap">
        <H id="lineup-title" className="text-[clamp(44px,6vw,88px)] leading-[0.95] tracking-[-0.05em]">
          {title ?? t.title}
        </H>
      </div>

      <ul className="wrap mt-12 grid grid-cols-2 gap-6 gap-y-12 lg:grid-cols-4 max-md:mr-0 max-md:flex max-md:snap-x max-md:snap-mandatory max-md:scroll-px-[var(--gut)] max-md:gap-4 max-md:overflow-x-auto max-md:pr-[var(--gut)] max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden">
        {products.map((p, i) => (
          <li key={p.id} className="max-md:w-[72%] max-md:flex-none max-md:snap-start">
            <Link href={productHref(p)} className="group block">
              <span className="relative block aspect-[5/4] border-b border-line">
                <span aria-hidden className="shade absolute bottom-[4%] left-[18%] h-4 w-[64%] rounded-[50%]" />
                <span className="lift absolute inset-x-[6%] top-[8%] bottom-[8%]">
                  <Image src={p.cutout.src} alt="" fill sizes="(min-width: 1024px) 280px, (min-width: 768px) 45vw, 72vw" loading={i < 2 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : 'auto'} className="object-contain object-bottom" />
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
                  <span className="lg:sr-only">{t.view}</span> <Arrow className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </span>
              <PromoNote productId={p.id} className="mt-3" />
            </Link>
          </li>
        ))}
      </ul>

      <ul className="wrap mt-14 flex flex-wrap gap-x-8 gap-y-2 text-[15px] text-text max-sm:mt-10">
        <li>✓ {ui.freeDeliveryRo}</li>
        <li>✓ {ui.returns}</li>
        <li>✓ {ui.warranty}</li>
        <li>✓ {ui.replyTime}</li>
      </ul>
    </section>
  )
}
