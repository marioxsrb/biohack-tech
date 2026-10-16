import Image from 'next/image'
import { AddToCartButton } from '@/components/cart/AddToCartButton'
import { Price } from '@/components/cart/Price'
import { Faq } from '@/components/ui/Faq'
import { Check } from '@/components/ui/icons'
import carteAutoare from '@/assets/img/carte/diana-palotas.webp'
import carteCoperta from '@/assets/img/carte/coperta.webp'
import { bookCopy } from '@/content/book'
import { isPurchasable, type Product } from '@/content/catalog'
import type { Locale } from '@/i18n/locales'
import { ui } from '@/i18n/ui'
import { ShippingFee } from './ShippingFee'

/** The cover's gold, for the book's page only (the devices keep the store's cyan). */
const GOLD = 'text-[#a07a2c]'
const PAPER = 'bg-[#f7f3ec]'
const h2 = 'text-[clamp(30px,3.2vw,46px)] leading-[1.05] tracking-[-0.04em]'
const eyebrow = `text-[13px] font-semibold tracking-[0.16em] uppercase ${GOLD}`

/**
 * Below the buy area of Diana L. Palotaș's book: an editorial page instead of the devices' product story. The book
 * in its own words (description, preface), what is inside (the real contents), the author, how the print book and the
 * PDF reach the customer, the details and the closing purchase. Text: content/book.ts; nothing invented.
 */
export function BookSections({ product, locale }: { product: Product; locale: Locale }) {
  const b = bookCopy(locale)
  const purchasable = isPurchasable(product)
  return (
    <>
      {/* The book in its own words. */}
      <section aria-labelledby="book-about" className="wrap">
        <div className={`grid gap-12 rounded-[28px] ${PAPER} px-[clamp(24px,6vw,88px)] py-[clamp(48px,7vw,104px)] md:grid-cols-12`}>
          <div className="md:col-span-5">
            <p className={eyebrow}>{b.about.eyebrow}</p>
            <h2 id="book-about" className={`mt-4 ${h2} text-ink`}>
              {b.about.title}
            </h2>
            {locale === 'en' && <p className="mt-4 text-[15px] text-muted">“{b.titleEn}”</p>}
          </div>
          <div className="md:col-span-6 md:col-start-7">
            {b.about.paragraphs.map((p) => (
              <p key={p} className="mb-5 text-[18px] leading-[1.65] text-text last:mb-0">
                {p}
              </p>
            ))}
            <figure className="mt-10 border-l-2 border-[#c9a45c] pl-6">
              <blockquote className="text-[clamp(24px,2.4vw,32px)] leading-[1.25] tracking-[-0.025em] text-ink">„{b.quotes[0]}”</blockquote>
              <figcaption className="mt-3 text-[14px] text-muted">{b.author.name}</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* The preface, a few lines of it. */}
      <section aria-label={locale === 'en' ? 'From the preface' : 'Din prefață'} className="wrap py-[calc(var(--sec)*0.8)]">
        <div className="mx-auto grid max-w-[980px] gap-8 md:grid-cols-3">
          {b.quotes.slice(1).map((q) => (
            <blockquote key={q} className="text-[17px] leading-[1.6] text-text">
              <span aria-hidden className={`block text-[44px] leading-none ${GOLD}`}>
                “
              </span>
              {q}
            </blockquote>
          ))}
        </div>
      </section>

      {/* What is inside: the book's own contents. */}
      <section aria-labelledby="book-contents" className="on-dark bg-dark py-[var(--sec)] text-white">
        <div className="wrap">
          <div className="grid gap-8 md:grid-cols-12">
            <div className="md:col-span-4">
              <p className="text-[13px] font-semibold tracking-[0.16em] text-[#d8b878] uppercase">{b.contents.eyebrow}</p>
              <h2 id="book-contents" className={`mt-4 ${h2} text-white`}>
                {b.contents.title}
              </h2>
              <p className="mt-5 max-w-[26em] text-[17px] leading-relaxed text-white/75">{b.contents.intro}</p>
            </div>
            <ol className="grid gap-x-10 md:col-span-8 sm:grid-cols-2">
              {b.contents.chapters.map((c) => (
                <li key={c.n} className="flex gap-5 border-t border-white/12 py-5">
                  <span className="w-9 flex-none font-mono text-[14px] text-[#d8b878]">{c.n}</span>
                  <span>
                    <span className="block text-[18px] leading-snug tracking-[-0.01em] text-white">{c.title}</span>
                    {c.topics && <span className="mt-1.5 block text-[14.5px] leading-snug text-white/60">{c.topics.join(' · ')}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <p className="mt-8 text-[15px] text-white/60 md:ml-[33.3%]">{b.contents.extra}</p>
        </div>
      </section>

      {/* The author. */}
      <section aria-labelledby="book-author" className="wrap py-[var(--sec)]">
        <div className="grid items-center gap-12 md:grid-cols-12">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[24px] md:col-span-5">
            <Image src={carteAutoare} alt={b.author.alt} fill placeholder="blur" sizes="(min-width: 768px) 40vw, 100vw" className="object-cover object-top" />
          </div>
          <div className="md:col-span-6 md:col-start-7">
            <p className={eyebrow}>{b.author.eyebrow}</p>
            <h2 id="book-author" className={`mt-4 ${h2} text-ink`}>
              {b.author.name}
            </h2>
            <p className="mt-2 text-[16px] font-medium text-text">{b.author.role}</p>
            <p className="mt-6 max-w-[34em] text-[18px] leading-[1.65] text-text">{b.author.bio}</p>
          </div>
        </div>
      </section>

      {/* Print + digital: how the book and the PDF reach the customer, by payment method. */}
      <section aria-labelledby="book-delivery" className={`${PAPER} py-[var(--sec)]`}>
        <div className="wrap">
          <p className={eyebrow}>{b.delivery.eyebrow}</p>
          <h2 id="book-delivery" className={`mt-4 max-w-[16em] ${h2} text-ink`}>
            {b.delivery.title}
          </h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {b.delivery.steps.map((s, i) => (
              <li key={s.title} className="rounded-[20px] bg-white p-6 shadow-[0_1px_0_rgba(11,19,22,.04)]">
                <span className={`font-mono text-[13px] ${GOLD}`}>0{i + 1}</span>
                <p className="mt-3 text-[19px] font-medium tracking-[-0.015em] text-ink">{s.title}</p>
                <p className="mt-2 text-[15.5px] leading-relaxed text-text">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-[#e6dccb] pt-6">
            <p className="text-[15.5px] text-text">
              {b.delivery.fee}: <ShippingFee className="font-semibold text-ink" />
            </p>
            <p className="max-w-[44em] text-[15px] text-muted">{b.delivery.note}</p>
          </div>
        </div>
      </section>

      {/* Details and questions. */}
      <section aria-labelledby="book-specs" className="py-[calc(var(--sec)*0.8)]">
        <div className="wrap grid grid-cols-1 gap-y-14 md:grid-cols-12 md:gap-x-6">
          <div className="md:col-span-5">
            <h2 id="book-specs" className="text-[26px] tracking-[-0.03em]">
              {locale === 'en' ? 'Details' : 'Detalii'}
            </h2>
            <dl className="mt-6">
              {b.specs.map((s) => (
                <div key={s.label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 border-t border-mist-2 py-3.5 text-[15.5px] last:border-b">
                  <dt className="text-muted">{s.label}</dt>
                  <dd className="text-ink">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="md:col-span-6 md:col-start-7">
            <h2 className="text-[26px] tracking-[-0.03em]">{locale === 'en' ? 'Questions' : 'Întrebări frecvente'}</h2>
            <div className="mt-6">
              <Faq items={b.faqs} />
            </div>
          </div>
        </div>
      </section>

      {/* Closing purchase. */}
      <section id="buy-again" aria-labelledby="book-buy-again" className="wrap pb-[var(--sec)]">
        <div className="relative grid items-center gap-10 overflow-hidden rounded-[28px] bg-ink px-[clamp(24px,6vw,72px)] py-[clamp(40px,6vw,72px)] text-white md:grid-cols-12">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_90%_at_0%_100%,rgba(193,154,74,.25),transparent_60%)]" />
          <div className="relative flex justify-center md:col-span-5">
            <Image src={carteCoperta} alt={product.cutout.alt} placeholder="blur" sizes="280px" className="w-[min(260px,62vw)] rounded-[6px] shadow-[0_40px_80px_-24px_rgba(0,0,0,.7)]" />
          </div>
          <div className="relative md:col-span-6 md:col-start-7">
            <p className="text-[16px] font-medium text-[#d8b878]">{b.author.name}</p>
            <h2 id="book-buy-again" className="mt-2 text-[clamp(32px,3.4vw,48px)] leading-[1.02] tracking-[-0.04em] text-white">
              {b.closing.title}
            </h2>
            <p className="mt-4 max-w-[30em] text-[17px] leading-relaxed text-white/75">{b.closing.text}</p>
            <p className="mt-6 text-[26px] font-medium tracking-[-0.02em] text-white">
              <Price productId={product.id} />
              {purchasable && <span className="ml-3 align-middle text-[14px] font-normal tracking-normal text-white/60">{ui[locale].vat}</span>}
            </p>
            <div className="mt-6">
              <AddToCartButton productId={product.id} />
            </div>
            <ul className="mt-6 grid gap-2 text-[14.5px] text-white/75">
              {b.highlights.slice(0, 2).map((h) => (
                <li key={h} className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-[#d8b878]" aria-hidden /> {h}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  )
}
