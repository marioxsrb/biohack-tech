import Link from '@/components/ui/Link'
import { BookCover } from '@/components/book/BookCover'
import { Price } from '@/components/cart/Price'
import { Arrow } from '@/components/ui/icons'
import { bookCopy } from '@/content/book'
import { BOOK_ID, getProduct, productHref } from '@/content/catalog'
import { getLocale, getUi } from '@/i18n/server'

const COPY = {
  ro: { eyebrow: 'Din universul Biohack Tech', by: 'de Diana L. Palotaș', meta: 'Ediție fizică + PDF · 10 capitole · Sibiu, 2026', cta: 'Descoperă cartea' },
  en: { eyebrow: 'From the Biohack Tech world', by: 'by Diana L. Palotaș', meta: 'Print + PDF · 10 chapters · in Romanian', cta: 'Discover the book' },
}

/**
 * Under the three NEUROS products, never among them: Diana L. Palotaș's book as a quiet editorial aside. Warm paper,
 * a lot of air, the cover as an object, the title set large, one sentence, one line from the preface and one way on
 * (to the book's page). The devices keep the store's colour and weight; this section stays lighter than they are.
 * Nothing renders until the book is released (content/catalog).
 */
export async function BookFeature() {
  const locale = await getLocale()
  const product = getProduct(BOOK_ID, locale)
  if (!product) return null
  const t = COPY[locale]
  const b = bookCopy(locale)
  const ui = await getUi()
  return (
    <section aria-labelledby="carte-title" className="wrap pt-[calc(var(--sec)*0.7)]">
      <div className="relative grid items-center gap-x-12 gap-y-14 overflow-hidden rounded-[28px] bg-[#f7f3ec] px-[clamp(24px,6vw,96px)] py-[clamp(56px,7.5vw,112px)] md:grid-cols-12">
        <div aria-hidden className="pointer-events-none absolute -left-[10%] top-1/2 h-[120%] w-[60%] -translate-y-1/2 bg-[radial-gradient(closest-side,rgba(201,164,92,.18),transparent)]" />

        <Link href={productHref(product)} className="relative flex justify-center md:col-span-5" tabIndex={-1} aria-hidden>
          <BookCover width="clamp(176px, 19vw, 236px)" sizes="(min-width: 768px) 236px, 176px" alt={product.cutout.alt} />
        </Link>

        <div className="relative md:col-span-6 md:col-start-7">
          <p className="text-[12.5px] font-semibold tracking-[0.18em] text-[#a07a2c] uppercase">{t.eyebrow}</p>
          <h2 id="carte-title" className="mt-5 text-[clamp(34px,3.7vw,52px)] leading-[1.02] tracking-[-0.04em] text-ink">
            Știu. Vreau.
            <br />
            DE CE NU POT?
          </h2>
          <p className="mt-3 text-[18px] text-text">
            {product.purpose} <span className="text-muted">· {t.by}</span>
          </p>
          <span aria-hidden className="mt-7 block h-px w-12 bg-[#c9a45c]" />
          <p className="mt-7 max-w-[30em] text-[17px] leading-[1.65] text-text">{b.about.paragraphs[0]}</p>
          <blockquote className="mt-6 max-w-[30em] text-[17px] leading-snug text-ink">„{b.quotes[0]}”</blockquote>
          <p className="mt-6 text-[13.5px] tracking-[0.02em] text-muted">{t.meta}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link href={productHref(product)} className="group inline-flex min-h-12 items-center gap-2.5 rounded-full bg-ink px-6 text-[15.5px] font-semibold text-white transition-colors hover:bg-black">
              {t.cta} <Arrow className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <p className="text-[15px] text-text">
              <Price productId={product.id} className="font-semibold text-ink" />
              <span className="ml-2 text-[13px] text-muted">{ui.vat}</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
