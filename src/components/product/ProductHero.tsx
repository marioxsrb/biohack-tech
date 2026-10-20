'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AddToCartButton } from '@/components/cart/AddToCartButton'
import { BuyNowButton } from '@/components/cart/BuyNowButton'
import { Price } from '@/components/cart/Price'
import { QuantityStepper } from '@/components/cart/QuantityStepper'
import { Check } from '@/components/ui/icons'
import { getProduct, isPurchasable, variantLabel, type ProductId } from '@/content/catalog'
import { useLocale } from '@/i18n/LocaleProvider'
import { Availability, BundleOffer, ContactOrder, Highlights, PriceBlock, SocialProof, TrustRow } from './BuyBox'
import { Gallery } from './Gallery'
import { BusinessStrip } from '@/components/b2b/BusinessStrip'
import { CalmEvening } from '@/components/calm/CalmEvening'
import { CalmUse } from '@/components/calm/CalmUse'
import { FocusStory } from '@/components/focus/FocusStory'
import { AmberStory } from '@/components/amber/AmberStory'
import dynamic from 'next/dynamic'
import { terms } from '@/config/site'
import { BULK_OFFER } from '@/config/promotions'

// The camera try-on loads only when opened (its tracker is several megabytes).
const AmberTryOn = dynamic(() => import('@/components/amber/AmberTryOn').then((m) => m.AmberTryOn), { ssr: false })

const COPY = {
  ro: {
    images: (name: string) => `Imagini ${name}`,
    quantity: 'Cantitate',
    pending: 'Prețul în lei apare în curând. Scrie-ne și îți răspundem în cel mult 24 de ore.',
  },
  en: {
    images: (name: string) => `${name} images`,
    quantity: 'Quantity',
    pending: 'The price in lei is coming soon. Write to us and we reply within 24 hours.',
  },
}

type Props = {
  productId: ProductId
  intro: string
  highlights: string[]
  /** Replaces the photo gallery (the book shows its cover as an object on a quiet stage). */
  media?: ReactNode
  /** Replaces the product name in the heading (the book: its title, set on two lines, and its author). */
  title?: ReactNode
}

/**
 * The first screen of a product page: the gallery (about 58%) and everything needed to buy (about 42%),
 * in the order a customer decides: who else bought, what it's for, name, one sentence, four facts, the
 * price, the variant, availability and quantity, the bundle offers (they set the quantity), then four
 * buttons in rows of 1, 2, 1: "Comandă acum" (straight to the checkout, card preselected; transfer and
 * cash on delivery one click away there), phone and WhatsApp, "Adaugă în coș". Then the store promises.
 * On a phone the same order runs under the gallery.
 */
export function ProductHero({ productId, intro, highlights, media, title }: Props) {
  const locale = useLocale()
  const t = COPY[locale]
  const product = getProduct(productId, locale)!
  const purchasable = isPurchasable(product)
  // Romanian Calm only: the evening headline, and the story that sits between the trust row and the business strip.
  const calmStory = locale === 'ro' && product.id === 'balance-wave'
  const focusStory = locale === 'ro' && product.id === 'brainlink-pro'
  const amberStory = locale === 'ro' && product.id === 'ochelari-biohack'
  const [tryOn, setTryOn] = useState(false)

  const [selected, setSelected] = useState<Record<string, string>>(() => product.variants?.[0]?.options ?? {})
  const [quantity, setQuantity] = useState(1)
  const [barVisible, setBarVisible] = useState(false)
  const buyRef = useRef<HTMLDivElement>(null)

  const variant = product.variants?.find((v) => Object.entries(v.options).every(([k, val]) => selected[k] === val))
  const images = variant?.images ?? product.images

  // Phones and tablets: a compact purchase bar whenever no buy button is on screen.
  useEffect(() => {
    const main = buyRef.current
    if (!main || !purchasable) return
    const seen = new Map<Element, boolean>()
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => seen.set(e.target, e.isIntersecting))
        setBarVisible(![...seen.values()].some(Boolean))
      },
      { threshold: 0.6 },
    )
    io.observe(main)
    const closing = document.getElementById('buy-again')
    if (closing) io.observe(closing)
    return () => io.disconnect()
  }, [purchasable])

  // Keep the page's last lines clear of the bar.
  useEffect(() => {
    const root = document.documentElement
    if (barVisible) root.dataset.buybar = ''
    else delete root.dataset.buybar
    return () => void delete root.dataset.buybar
  }, [barVisible])

  // A frame chosen elsewhere (the homepage, the final section) arrives as #variant-id.
  useEffect(() => {
    const apply = () => {
      const v = product.variants?.find((x) => x.id === window.location.hash.slice(1))
      if (!v) return
      setSelected(v.options)
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      document.getElementById('cumpara')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
    }
    apply()
    window.addEventListener('hashchange', apply)
    return () => window.removeEventListener('hashchange', apply)
  }, [product])

  const available = (optionId: string) =>
    new Set(
      (product.variants ?? [])
        .filter((v) => Object.entries(selected).every(([k, val]) => k === optionId || v.options[k] === val))
        .map((v) => v.options[optionId]),
    )

  const choose = (optionId: string, valueId: string) => {
    const next = { ...selected, [optionId]: valueId }
    // A combination that doesn't exist (cat eye in maro): keep the new choice, take the first variant that has it.
    const exact = product.variants?.some((v) => Object.entries(next).every(([k, val]) => v.options[k] === val))
    if (!exact) {
      const fallback = product.variants?.find((v) => v.options[optionId] === valueId)
      if (fallback) return setSelected(fallback.options)
    }
    setSelected(next)
  }

  // A variant chosen below the buy area (the collection, the try-on): select it and bring the buy area into view.
  const pick = (variantId: string) => {
    const v = product.variants?.find((x) => x.id === variantId)
    if (!v) return
    setSelected(v.options)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById('cumpara')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-y-5 md:grid-cols-12 md:gap-x-10 md:gap-y-8 lg:gap-x-14">
        <div className="md:col-span-7">
          {media ?? <Gallery key={variant?.id ?? product.id} images={images} label={t.images(product.name)} wide={!!product.variants} />}
        </div>

        <div className="md:col-span-5 md:pt-2">
          <SocialProof className="mb-3 md:mb-4" />
          {!calmStory && <p className="text-[16px] font-medium text-cyan-700">{product.purpose}</p>}
          <h1 className="mt-1 text-[clamp(38px,4.2vw,58px)] leading-[0.98] tracking-[-0.045em]">{title ?? product.name}</h1>
          <p className="mt-3 max-w-[32em] text-[17px] leading-snug text-text">
            {calmStory ? 'Te ajută să lași stresul zilei în urmă și să treci mai ușor spre somn. Câteva minute, apoi se oprește singur.' : product.tagline}
          </p>

          <Highlights items={highlights} className="mt-5" />

          <div className="mt-6">
            <PriceBlock productId={product.id} variantId={variant?.id} purchasable={purchasable} />
          </div>

          {product.options?.map((opt) => {
            const avail = available(opt.id)
            const current = opt.values.find((v) => v.id === selected[opt.id])
            const values = opt.values.filter((v) => opt.id === 'model' || avail.has(v.id))
            return (
              <fieldset key={opt.id} className="mt-6">
                <legend className="text-[15px] text-text">
                  {opt.label}: <strong className="font-semibold text-ink">{current?.label}</strong>
                </legend>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {values.map((val) => {
                    const on = selected[opt.id] === val.id
                    return (
                      <button
                        key={val.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => choose(opt.id, val.id)}
                        className={`flex min-h-12 items-center gap-2.5 rounded-full py-2 pr-5 pl-4 text-[15.5px] font-medium transition-[background-color,color,box-shadow] duration-150 ${
                          on ? 'bg-ink text-white' : 'bg-paper text-ink shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-ink)]'
                        }`}
                      >
                        {val.swatch && (
                          <span
                            aria-hidden
                            className={`h-5 w-5 flex-none rounded-full ${on ? 'shadow-[0_0_0_2px_#fff]' : 'shadow-[inset_0_0_0_1px_rgba(0,0,0,.15)]'}`}
                            style={{ background: val.swatch }}
                          />
                        )}
                        {val.label}
                        {on && <Check className="h-4 w-4" aria-hidden />}
                      </button>
                    )
                  })}
                </div>
                {current?.hint && <p className="mt-2.5 text-[14px] leading-snug text-muted">{current.hint}</p>}
              </fieldset>
            )
          })}

          {amberStory && (
            <button type="button" onClick={() => setTryOn(true)} className="btn-secondary mt-5 w-full">
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              Probează-i live, pe cameră
            </button>
          )}
          {tryOn && variant && (
            <AmberTryOn
              frame={variant.id.replace(/-(rosu|pachet)$/, '')}
              lens={variant.id.endsWith('-rosu') ? 'rosu' : 'galben'}
              onClose={() => setTryOn(false)}
            />
          )}

          {purchasable ? (
            <>
              {/* Availability on the left, quantity on the right: both decide what the buttons below order. */}
              <div className="mt-6 flex items-center justify-between gap-4">
                <Availability className="min-w-0" productId={product.id} />
                <QuantityStepper value={quantity} onChange={setQuantity} label={t.quantity} size="sm" />
              </div>

              <BundleOffer productId={product.id} variantId={variant?.id} quantity={quantity} onQuantity={setQuantity} className="mt-5" />

              {/* Four buttons in rows of 1, 2, 1: order (card or transfer preselected), phone and WhatsApp, add to cart. */}
              <div ref={buyRef} className="mt-5 grid gap-2.5">
                <BuyNowButton productId={product.id} variantId={variant?.id} quantity={quantity} pay="online" title={calmStory ? 'Vreau serile mai liniștite' : undefined} />
                <ContactOrder productId={product.id} variantId={variant?.id} quantity={quantity} />
                <AddToCartButton productId={product.id} variantId={variant?.id} quantity={quantity} tone="secondary" className="!min-h-[52px] w-full" onAdded={() => setQuantity(1)} />
              </div>

              {calmStory && (
                <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
                  Plată la livrare. Garanție {terms.warrantyYears} ani. Recomandat de Diana Palotaș, fondatoarea Neuros Europe, psiholog cu peste 20 de ani de experiență.
                </p>
              )}

              <TrustRow className="mt-7" productId={product.id} />
              {!calmStory && (BULK_OFFER.products as string[]).includes(product.id) && <BusinessStrip locale={locale} compact className="mt-6" />}
            </>
          ) : (
            <div className="mt-6 grid gap-2.5">
              <AddToCartButton productId={product.id} className="w-full" />
              <p className="max-w-[30em] text-[15px] text-text">{t.pending}</p>
              <ContactOrder productId={product.id} quantity={1} />
            </div>
          )}

          {!calmStory && <p className="mt-7 max-w-[32em] border-t border-mist-2 pt-6 text-[16.5px] leading-relaxed text-text">{intro}</p>}
        </div>

        {focusStory && (
          <div className="min-w-0 md:col-span-12">
            <FocusStory pairCta={<BuyNowButton productId={product.id} variantId={variant?.id} quantity={2} pay="online" title="Comandă 2 bucăți" className="w-full" />} />
          </div>
        )}

        {amberStory && (
          <div className="min-w-0 md:col-span-12">
            <AmberStory productId={product.id} onPick={pick} />
          </div>
        )}

        {calmStory && (
          <div className="min-w-0 md:col-span-12">
            <CalmEvening
              cta={<BuyNowButton productId={product.id} variantId={variant?.id} quantity={quantity} pay="online" title="Vreau serile mai liniștite" className="!w-auto max-md:!w-full" />}
              note={<p className="text-[13.5px] leading-relaxed text-muted">Plată la livrare. Garanție {terms.warrantyYears} ani.</p>}
            />
            <CalmUse pairCta={<BuyNowButton productId={product.id} variantId={variant?.id} quantity={2} pay="online" title="Comandă 2 bucăți" className="w-full" />} />
            {(BULK_OFFER.products as string[]).includes(product.id) && <BusinessStrip locale={locale} compact className="mt-8" />}
          </div>
        )}
      </div>

      {purchasable && (
        <div
          data-sticky-bar
      className={`fixed inset-x-0 bottom-0 z-[200] border-t border-line bg-paper/95 backdrop-blur-md transition-transform duration-300 ease-[var(--ease-brand)] lg:hidden ${
            barVisible ? 'translate-y-0' : 'translate-y-full'
          }`}
          aria-hidden={!barVisible}
          inert={!barVisible}
        >
          <div className="wrap flex items-center gap-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-ink">{product.name}</p>
              <p className="truncate text-[13.5px] text-muted">
                <Price productId={product.id} variantId={variant?.id} />
                {variant && ` · ${variantLabel(product, variant)}`}
              </p>
            </div>
            <BuyNowButton productId={product.id} variantId={variant?.id} quantity={quantity} pay="online" look="bar" className="!min-h-12 !px-5" />
          </div>
        </div>
      )}
    </>
  )
}
