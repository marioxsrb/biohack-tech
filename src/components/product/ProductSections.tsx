import Image from 'next/image'
import Link from '@/components/ui/Link'
import { AddToCartButton } from '@/components/cart/AddToCartButton'
import { Price } from '@/components/cart/Price'
import { Faq } from '@/components/ui/Faq'
import { Arrow, External } from '@/components/ui/icons'
import { isPurchasable, type Product } from '@/content/catalog'
import type { ProductContent, Story } from '@/content/product-content'
import type { Locale } from '@/i18n/locales'
import { ui } from '@/i18n/ui'

type Props = { product: Product; content: ProductContent; locale: Locale }

const COPY = {
  ro: { short: 'Pe scurt', chooseFrame: 'Alege rama', studies: 'Vezi studiile', newTab: ' (se deschide într-o filă nouă)', details: 'Detalii', faq: 'Întrebări frecvente', chooseVariant: 'Alege varianta' },
  en: { short: 'In short', chooseFrame: 'Choose the frame', studies: 'See the studies', newTab: ' (opens in a new tab)', details: 'Details', faq: 'Questions', chooseVariant: 'Choose an option' },
}
type Copy = (typeof COPY)['ro']

/**
 * Below the buy area, in one fixed rhythm for every product: a large photograph,
 * three short benefits, how it's used, (Amber) the four frames, the technology once,
 * a moment or two from real life, the details, and the product again with its button.
 */
export function ProductSections({ product, content: c, locale }: Props) {
  const t = COPY[locale]
  return (
    <>
      <Cinematic story={c.scene} />
      <Benefits items={c.benefits} t={t} />
      {/* On the Romanian Calm page the use steps live under the evening story (components/calm/CalmUse). */}
      {c.use && !(locale === 'ro' && product.id === 'balance-wave') && <Use use={c.use} />}
      {c.lookbook && <Lookbook lookbook={c.lookbook} t={t} />}
      {c.explain && <Explain explain={c.explain} t={t} />}
      {c.moments.length > 0 && (
        <div className="py-[calc(var(--sec)*0.5)]">
          {c.moments.map((s, i) => (
            <Moment key={s.title} story={s} flip={i % 2 === 1} />
          ))}
        </div>
      )}
      <Details content={c} t={t} />
      <BuyAgain product={product} t={t} locale={locale} />
    </>
  )
}

const h2 = 'text-[clamp(30px,3.2vw,46px)] leading-[1.03] tracking-[-0.04em]'

/** The first photograph: large and inset, its headline set into the darkest part. */
function Cinematic({ story }: { story: Story }) {
  return (
    <section className="wrap max-sm:px-0">
      <div className="relative isolate flex h-[78svh] max-h-[780px] min-h-[480px] items-end overflow-hidden rounded-[24px] text-white max-sm:h-[72svh] max-sm:rounded-none">
        <Image src={story.image.src} alt={story.image.alt} fill placeholder="blur" sizes="(min-width: 1152px) 1104px, 100vw" className="-z-10 object-cover" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-[72%] bg-[linear-gradient(0deg,rgba(8,17,19,.88),rgba(8,17,19,.62)_45%,rgba(8,17,19,0))]" />
        <div className="w-full p-[clamp(24px,5vw,56px)]">
          <h2 className="max-w-[12em] text-[clamp(34px,4.6vw,64px)] leading-[0.98] tracking-[-0.045em] !text-white">{story.title}</h2>
          <p className="mt-4 max-w-[30em] text-[17px] leading-relaxed text-white/85">{story.text}</p>
        </div>
      </div>
    </section>
  )
}

/** Three short benefits, each with a check. Nothing else. */
function Benefits({ items, t }: { items: ProductContent['benefits']; t: Copy }) {
  return (
    <section aria-label={t.short} className="wrap pt-[calc(var(--sec)*0.6)] pb-[calc(var(--sec)*0.3)]">
      <ul className="grid gap-x-6 gap-y-6 sm:grid-cols-3">
        {items.map((b) => (
          <li key={b.title} className="border-t border-line pt-5 max-sm:pt-4">
            <p className="text-[21px] leading-snug font-medium tracking-[-0.02em] text-ink">{b.title}</p>
            <p className="mt-1.5 max-w-[22em] text-[16.5px] leading-relaxed text-text">{b.text}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** How it's used: the product on a white panel beside three numbered steps. */
function Use({ use }: { use: NonNullable<ProductContent['use']> }) {
  return (
    <section aria-labelledby="use-title" className="wrap py-[calc(var(--sec)*0.5)]">
      <div className="grid grid-cols-1 items-center overflow-hidden rounded-[28px] bg-paper md:grid-cols-12">
        <div className="relative aspect-[4/3] md:col-span-6 md:aspect-auto md:h-full md:min-h-[440px]">
          <Image src={use.image.src} alt={use.image.alt} fill sizes="(min-width: 1152px) 552px, (min-width: 768px) 50vw, 100vw" className="object-contain p-[12%] md:p-[14%]" />
        </div>
        <div className="p-[clamp(24px,5vw,64px)] md:col-span-6 max-md:pt-0">
          <h2 id="use-title" className={h2}>
            {use.title}
          </h2>
          <ol className="mt-8 space-y-5">
            {use.steps.map((s, i) => (
              <li key={s} className="flex items-baseline gap-4">
                <span aria-hidden className="flex h-9 w-9 flex-none translate-y-[-2px] items-center justify-center self-start rounded-full bg-mist text-[15px] font-semibold text-ink tabular-nums">
                  {i + 1}
                </span>
                <span className="pt-1 text-[19px] leading-snug tracking-[-0.01em] text-ink">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

/** Amber: the four frames together, large, with one line. */
function Lookbook({ lookbook, t }: { lookbook: NonNullable<ProductContent['lookbook']>; t: Copy }) {
  return (
    <section aria-labelledby="lookbook-title" className="wrap py-[calc(var(--sec)*0.5)]">
      <div className="grid grid-cols-1 items-center gap-y-6 md:grid-cols-12 md:gap-x-6">
        <div className="md:col-span-4">
          <h2 id="lookbook-title" className={h2}>
            {lookbook.title}
          </h2>
          <p className="mt-4 max-w-[24em] text-[17px] leading-relaxed text-text">{lookbook.text}</p>
          <Link href="#cumpara" className="tlink mt-6">
            {t.chooseFrame} <Arrow />
          </Link>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] md:col-span-8 max-sm:-mx-[var(--gut)] max-sm:rounded-none">
          <Image src={lookbook.image.src} alt={lookbook.image.alt} fill placeholder="blur" sizes="(min-width: 1152px) 736px, (min-width: 768px) 66vw, 100vw" className="object-cover" />
        </div>
      </div>
    </section>
  )
}

/** The technology, once, in plain words. The image sits on its own background colour. */
function Explain({ explain, t }: { explain: NonNullable<ProductContent['explain']>; t: Copy }) {
  return (
    <section aria-labelledby="explain-title" className="wrap py-[calc(var(--sec)*0.5)]">
      <div className="grid grid-cols-1 items-center gap-y-8 md:grid-cols-12 md:gap-x-6">
        <div
          className="relative aspect-[4/3] overflow-hidden rounded-[24px] md:col-span-7 max-sm:-mx-[var(--gut)] max-sm:rounded-none"
          style={explain.imageBg ? { background: explain.imageBg } : undefined}
        >
          <Image
            src={explain.image.src}
            alt={explain.image.alt}
            fill
            sizes="(min-width: 1152px) 640px, (min-width: 768px) 58vw, 100vw"
            className={explain.imageBg ? 'object-contain p-[4%]' : 'object-cover'}
          />
        </div>
        <div className="md:col-span-5 md:pl-6">
          <h2 id="explain-title" className={h2}>
            {explain.title}
          </h2>
          <div className="mt-5 space-y-4 text-[17px] leading-relaxed text-text">
            {explain.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          {explain.studies && (
            <details className="faq group mt-4">
              <summary className="tlink min-h-11 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                {t.studies} <Arrow className="transition-transform duration-200 group-open:rotate-90" />
              </summary>
              <div className="faq-body">
                <ul className="pb-1">
                  {explain.studies.map((s) => (
                    <li key={s.href}>
                      <a href={s.href} target="_blank" rel="noopener noreferrer" className="group/l inline-flex min-h-11 items-center gap-2 py-1 text-[15px] text-text hover:text-ink">
                        <External className="h-4 w-4 flex-none text-muted group-hover/l:text-cyan-700" />
                        <span className="underline decoration-line underline-offset-4">{s.label}</span>
                        <span className="sr-only">{t.newTab}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          )}
        </div>
      </div>
    </section>
  )
}

/** A photograph with a headline and one or two sentences beside it. */
function Moment({ story, flip }: { story: Story; flip: boolean }) {
  return (
    <section className="wrap py-[calc(var(--sec)*0.5)]">
      <div className="grid grid-cols-1 items-center gap-y-7 md:grid-cols-12 md:gap-x-6">
        <div className={`relative aspect-[4/3] overflow-hidden rounded-[24px] md:col-span-7 max-sm:-mx-[var(--gut)] max-sm:rounded-none ${flip ? 'md:order-2 md:col-start-6' : ''}`}>
          <Image src={story.image.src} alt={story.image.alt} fill placeholder="blur" sizes="(min-width: 1152px) 640px, (min-width: 768px) 58vw, 100vw" className="object-cover" />
        </div>
        <div className={`md:col-span-5 ${flip ? 'md:order-1 md:col-start-1 md:pr-6' : 'md:col-start-8 md:pl-6'}`}>
          <h2 className={`${h2} max-w-[11em]`}>{story.title}</h2>
          <p className="mt-5 text-[18px] leading-relaxed text-text">{story.text}</p>
        </div>
      </div>
    </section>
  )
}

/** Specifications and a short FAQ, side by side: reference material, set quietly. */
function Details({ content: c, t }: { content: ProductContent; t: Copy }) {
  return (
    <section aria-labelledby="specs-title" className="py-[calc(var(--sec)*0.8)]">
      <div className="wrap grid grid-cols-1 gap-y-14 md:grid-cols-12 md:gap-x-6">
        <div className="md:col-span-5">
          <h2 id="specs-title" className="text-[26px] tracking-[-0.03em]">
            {t.details}
          </h2>
          <dl className="mt-6">
            {c.specs.map((s) => (
              <div key={s.label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 border-t border-mist-2 py-3.5 text-[15.5px] last:border-b">
                <dt className="text-muted">{s.label}</dt>
                <dd className="text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="md:col-span-6 md:col-start-7">
          <h2 className="text-[26px] tracking-[-0.03em]">{t.faq}</h2>
          <div className="mt-6">
            <Faq items={c.faqs} />
          </div>
        </div>
      </div>
    </section>
  )
}

/** Closing purchase: the product, large, on a white panel, with its price and one button. */
function BuyAgain({ product, t, locale }: { product: Product; t: Copy; locale: Locale }) {
  const img = product.cutout
  const bleed = img.bleed === 'bottom'
  const purchasable = isPurchasable(product)
  return (
    <section id="buy-again" aria-labelledby="buy-again-title" className="wrap pb-[var(--sec)]">
      <div className="grid grid-cols-1 items-center overflow-hidden rounded-[28px] bg-paper md:grid-cols-12">
        <div className={`relative aspect-[16/10] md:col-span-7 ${bleed ? 'order-2 mx-[8%] mt-2 md:order-1 md:mt-12 md:self-end' : 'm-[6%]'}`}>
          <Image src={img.src} alt={img.alt} fill sizes="(min-width: 1152px) 560px, (min-width: 768px) 50vw, 90vw" className={`object-contain ${bleed ? 'object-bottom' : ''}`} />
        </div>
        <div className={`p-[clamp(24px,5vw,56px)] md:col-span-5 ${bleed ? 'order-1 md:order-2' : 'max-md:pt-0'}`}>
          <p className="text-[16px] font-medium text-cyan-700">{product.purpose}</p>
          <h2 id="buy-again-title" className="mt-1 text-[clamp(32px,3.4vw,48px)] leading-none tracking-[-0.04em]">
            {product.name}
          </h2>
          <p className="mt-4 text-[24px] font-medium tracking-[-0.02em] text-ink">
            <Price productId={product.id} />
            {purchasable && <span className="ml-3 align-middle text-[14px] font-normal tracking-normal text-muted">{ui[locale].vat}</span>}
          </p>
          <div className="mt-6">
            {product.variants && purchasable ? (
              <Link href="#cumpara" className="cta">
                {product.chooseLabel ?? t.chooseVariant} <Arrow />
              </Link>
            ) : (
              <AddToCartButton productId={product.id} />
            )}
          </div>
          <p className="mt-4 text-[15px] text-text">
            {ui[locale].freeDelivery} · {ui[locale].returns}
          </p>
        </div>
      </div>
    </section>
  )
}
