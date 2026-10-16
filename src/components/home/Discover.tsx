import Image from 'next/image'
import Link from '@/components/ui/Link'
import { AddToCartButton } from '@/components/cart/AddToCartButton'
import { Price } from '@/components/cart/Price'
import { PromoNote } from '@/components/cart/PromoNote'
import { Arrow } from '@/components/ui/icons'
import { BOOK_ID, getProduct, isBook, productHref, type Product, type ProductId } from '@/content/catalog'
import { getLocale, getUi } from '@/i18n/server'
import type { Locale } from '@/i18n/locales'
import type { Ui } from '@/i18n/ui'

/**
 * The one place the three products are introduced. An editorial, asymmetric shelf: a wide stage and a
 * narrow one on the first row, the third product across the whole second row, each on its own quiet colour. Every tile says
 * when it is used, what it is, the price, the offer, and one next step.
 */
const SHELF: { id: ProductId; when: Record<Locale, string>; tint: string; wide: boolean; full?: boolean }[] = [
  { id: 'balance-wave', when: { ro: 'Pentru liniște · seara', en: 'For calm · evenings' }, tint: '#f4e9e6', wide: true },
  { id: 'brainlink-pro', when: { ro: 'Pentru focus · la birou', en: 'For focus · at work' }, tint: '#e5f1f4', wide: false },
  { id: 'ochelari-biohack', when: { ro: 'Pentru seri calme · la ecrane', en: 'For calmer evenings · at screens' }, tint: '#f5ecdc', wide: true, full: true },
]

/** With Diana L. Palotaș's book in the store: Amber shares the second row with it (wide and narrow, like the first). */
const BOOK_TILE: (typeof SHELF)[number] = { id: BOOK_ID, when: { ro: 'Pentru minte · de citit', en: 'For the mind · to read' }, tint: '#f7f3ec', wide: false }
const shelf = () => (getProduct(BOOK_ID) ? [...SHELF.slice(0, 2), { ...SHELF[2], full: false }, BOOK_TILE] : SHELF)

const COPY = {
  ro: {
    title: 'Produsele NEUROS',
    intro: 'Pentru mai mult calm, somn mai lin și focus. Livrare gratuită în România. Până la 20% reducere când iei mai multe.',
    view: (name: string) => `${name}: vezi produsul`,
  },
  en: {
    title: 'NEUROS products',
    intro: 'For more calm, easier sleep and focus. Free worldwide delivery. Up to 20% off when you buy more than one.',
    view: (name: string) => `${name}: view the product`,
  },
}

export async function Discover() {
  const locale = await getLocale()
  const t = COPY[locale]
  const ui = await getUi()
  return (
    <section id="produse" aria-labelledby="produse-title" className="wrap scroll-mt-[calc(var(--nav-h)+16px)] pt-[calc(var(--sec)*0.8)]">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
        <h2 id="produse-title" className="max-w-[12em] text-[clamp(34px,4vw,54px)] leading-[1] tracking-[-0.045em]">
          {t.title}
        </h2>
        <p className="max-w-[26em] text-[17px] leading-relaxed text-text">{t.intro}</p>
      </div>

      <ul className="mt-10 grid gap-5 lg:grid-cols-12">
        {shelf().map((s) => (
          <Tile key={s.id} p={getProduct(s.id, locale)!} when={s.when[locale]} tint={s.tint} wide={s.wide} full={s.full} view={t.view} ui={ui} />
        ))}
      </ul>

      <ul className="mt-8 grid gap-x-6 gap-y-2 text-[15px] text-text sm:grid-cols-2 lg:flex lg:justify-between">
        <li>✓ {ui.payment}</li>
        <li>✓ {ui.freeDeliveryRo}</li>
        <li>✓ {ui.changeMind}</li>
        <li>✓ {ui.warranty}</li>
      </ul>
    </section>
  )
}

function Tile({ p, when, tint, wide, full, view, ui }: { p: Product; when: string; tint: string; wide: boolean; full?: boolean; view: (name: string) => string; ui: Ui }) {
  const choose = !!p.variants?.length
  const head = (
    <>
      <p className="text-[14px] font-semibold tracking-[0.01em] text-cyan-700">{when}</p>
      <h3 className={`mt-2 text-[clamp(30px,2.8vw,38px)] leading-[1] tracking-[-0.04em] ${isBook(p.id) ? 'whitespace-pre-line' : 'whitespace-nowrap'}`}>
        {/* The book by its title (its full name, "Cartea „…”", is for the cart and the invoice). */}
        <Link href={productHref(p)} className="hover:underline hover:decoration-1 hover:underline-offset-4">
          {isBook(p.id) ? p.model.replace('Vreau. ', 'Vreau.\n') : p.name}
        </Link>
      </h3>
      <p className="mt-2 max-w-[22em] text-[15.5px] leading-snug text-text">{p.kind}</p>
    </>
  )
  const buy = (
    <div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[22px] font-medium tracking-[-0.02em] text-ink tabular-nums">
          <Price productId={p.id} />
        </span>
        <PromoNote productId={p.id} />
      </p>
      <div className="relative z-20 mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        {choose ? (
          <Link href={`${productHref(p)}#cumpara`} className="cta sm">
            {p.chooseLabel} <Arrow />
          </Link>
        ) : (
          <AddToCartButton productId={p.id} size="sm" />
        )}
        <Link href={productHref(p)} className="inline-flex min-h-11 items-center px-1 text-[14.5px] font-medium text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
          {ui.details}
        </Link>
      </div>
    </div>
  )
  const image = (
    <Image
      src={p.cutout.src}
      alt={p.cutout.alt}
      fill
      fetchPriority="low"
      sizes={wide ? '(min-width: 1152px) 360px, (min-width: 640px) 50vw, 90vw' : '(min-width: 1152px) 440px, (min-width: 1024px) 40vw, 90vw'}
      className={`object-contain transition-transform duration-500 ease-[var(--ease-brand)] group-hover:scale-[1.04] ${p.cutout.bleed === 'bottom' ? 'object-bottom' : ''}`}
    />
  )
  const pad = 'p-[clamp(22px,2.6vw,36px)]'
  // Wide: text and price on the left, the product large on the right. Narrow: text, product, price.
  // Either way the price and the action sit on the tile's lower edge, so rows line up.
  return (
    <li style={{ background: tint }} className={`group relative overflow-hidden rounded-[28px] ${full ? 'lg:col-span-12' : wide ? 'lg:col-span-7' : 'lg:col-span-5'}`}>
      {wide ? (
        <div className="grid h-full sm:grid-cols-2">
          <div className={`relative z-10 flex flex-col ${pad}`}>
            {head}
            <div className="mt-auto pt-6 sm:pt-8">{buy}</div>
          </div>
          <Link href={productHref(p)} aria-label={view(p.name)} className={`relative block min-h-[190px] cursor-pointer sm:min-h-[260px] ${p.cutout.bleed === 'bottom' ? 'mx-[6%] mt-[6%]' : 'm-[8%]'}`}>
            {image}
          </Link>
        </div>
      ) : (
        <div className={`flex h-full flex-col ${pad}`}>
          <div className="relative z-10">{head}</div>
          <Link href={productHref(p)} aria-label={view(p.name)} className="relative my-4 block min-h-[170px] flex-1 cursor-pointer sm:my-6 sm:min-h-[200px]">
            {image}
          </Link>
          <div className="relative z-10">{buy}</div>
        </div>
      )}
    </li>
  )
}
