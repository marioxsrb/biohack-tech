import Image from 'next/image'
import Link from 'next/link'
import { Price } from '@/components/cart/Price'
import { Arrow } from '@/components/ui/icons'
import { getProduct, productHref } from '@/content/catalog'
import { chooser } from '@/content/home'

/**
 * "Ce vrei să schimbi?": four needs in plain words, each leading to one product, with how it is used.
 * One photograph for the whole section. Not a quiz: one click, and a way out to ask a person.
 */
export function Chooser() {
  return (
    <section id="alege" aria-labelledby="alege-title" className="wrap scroll-mt-[calc(var(--nav-h)+16px)] pt-[var(--sec)]">
      <div className="grid gap-y-8 lg:grid-cols-12 lg:gap-x-10">
        <div className="lg:col-span-5">
          <h2 id="alege-title" className="text-[clamp(34px,4vw,54px)] leading-[1] tracking-[-0.045em]">
            {chooser.title}
          </h2>
          <p className="mt-4 max-w-[24em] text-[18px] leading-relaxed text-text">{chooser.intro}</p>
          <div className="relative mt-8 aspect-[4/3] overflow-hidden rounded-[20px] max-lg:hidden">
            <Image src={chooser.image.src} alt={chooser.image.alt} fill placeholder="blur" sizes="(min-width: 1152px) 440px, 40vw" className="object-cover object-[65%_50%]" />
          </div>
        </div>
        <ul className="border-t border-line lg:col-span-7">
          {chooser.needs.map((n) => {
            const p = getProduct(n.productId)!
            return (
              <li key={n.productId} className="border-b border-line">
                <Link href={productHref(p)} className="group grid gap-x-6 gap-y-1 py-6 sm:grid-cols-[1fr_auto] sm:items-center">
                  <span>
                    <span className="block text-[21px] leading-snug font-medium tracking-[-0.02em] text-ink">{n.need}</span>
                    <span className="mt-1 block max-w-[30em] text-[15.5px] leading-snug text-muted">{n.how}</span>
                  </span>
                  <span className="mt-2 flex items-center gap-3 sm:mt-0 sm:justify-end">
                    <span className="sm:text-right">
                      <span className="block text-[16px] font-semibold whitespace-nowrap text-ink group-hover:text-cyan-700">{p.name}</span>
                      <span className="block text-[14.5px] whitespace-nowrap text-muted tabular-nums">
                        <Price productId={p.id} />
                      </span>
                    </span>
                    <span aria-hidden className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-paper text-ink shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors group-hover:bg-ink group-hover:text-white">
                      <Arrow className="h-4 w-4" />
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
          <li className="pt-5 text-[15.5px] text-text">
            Nu ești sigur?{' '}
            <Link href="#contact" className="font-semibold text-ink underline underline-offset-4 hover:text-cyan-700">
              Întreabă-ne
            </Link>{' '}
            și îți recomandăm noi.
          </li>
        </ul>
      </div>
    </section>
  )
}
