'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PromoNote } from '@/components/cart/PromoNote'
import { Arrow, Lock } from '@/components/ui/icons'
import { getProduct, unitPrice, variantLabel, type ProductId } from '@/content/catalog'
import { terms } from '@/config/site'
import { itemOf, track } from '@/lib/analytics'
import type { LandingSlug } from '@/lib/landing-hosts'
import { formatLei } from '@/lib/money'
import { checkoutHref } from './checkout-link'

export type VariantNote = { big: string; text: string }

type Props = {
  slug: LandingSlug
  productId: ProductId
  title: string
  text: string
  cta: string
  /** Extra words per variant (NEUROS Flow: zones and what they are for). */
  notes?: Record<string, VariantNote>
  /** 'panel': product image beside the picker. 'columns': the variants side by side, large (configurations). */
  layout?: 'panel' | 'columns'
  defaultVariant?: string
}

/**
 * The purchase block of a landing: the variant picker (if any), the price of the chosen one, the offer,
 * one button to the checkout. Only ids travel in the link; the checkout and the server price everything
 * again. Colours come from the landing theme (--lp-*).
 */
export function LandingOffer({ slug, productId, title, text, cta, notes, layout = 'panel', defaultVariant }: Props) {
  const product = getProduct(productId)!
  const variants = product.variants ?? []
  const [variantId, setVariantId] = useState<string | undefined>(() => (variants.length ? (variants.find((v) => v.id === defaultVariant) ?? variants[0]).id : undefined))
  const variant = variants.find((v) => v.id === variantId)
  const price = unitPrice(product, variant)
  const image = variant?.images.find((i) => i.kind === 'cutout') ?? product.cutout
  const router = useRouter()

  useEffect(() => {
    track('view_item', { value: price ?? 0, items: [itemOf(product, variant, variant && variantLabel(product, variant))] })
    // One view_item per landing view (consent-aware: nothing is sent without it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const choose = (id: string) => {
    if (id === variantId) return
    setVariantId(id)
    const v = variants.find((x) => x.id === id)!
    track('select_variant', { value: unitPrice(product, v) ?? 0, items: [itemOf(product, v, variantLabel(product, v))] })
  }

  const href = checkoutHref(slug, product.id, variant?.id)
  const go = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    router.push(checkoutHref(slug, product.id, variant?.id, { search: window.location.search, host: window.location.host }))
  }

  const buy = (
    <>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[36px] font-medium tracking-[-0.03em] text-[var(--lp-ink)] tabular-nums" aria-live="polite">
        {price !== null ? formatLei(price) : 'Preț în curând'}
        {price !== null && <span className="text-[14px] font-normal tracking-normal text-[var(--lp-muted)]">{terms.vat}, livrare gratuită</span>}
      </p>
      {price !== null && <PromoNote productId={product.id} full className="mt-3 [&_.text-text]:!text-[var(--lp-muted)]" />}
      {price !== null && (
        <a href={href} onClick={go} className="cta mt-6 w-full sm:w-auto">
          <Lock /> {cta} <Arrow />
        </a>
      )}
      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-[14.5px] text-[var(--lp-muted)]">
        <li>Card sau transfer bancar</li>
        <li>{terms.returnDays} zile să te răzgândești</li>
        <li>Garanție {terms.warrantyYears} ani</li>
      </ul>
    </>
  )

  if (layout === 'columns') {
    return (
      <section id="comanda" aria-labelledby="offer-title" className="lp-wrap scroll-mt-20 py-[var(--sec)]">
        <h2 id="offer-title" className="text-[clamp(32px,3.8vw,52px)] leading-[1.02] tracking-[-0.04em] text-[var(--lp-ink)]">
          {title}
        </h2>
        <p className="mt-3 max-w-[36em] text-[17.5px] leading-relaxed text-[var(--lp-muted)]">{text}</p>
        <div role="radiogroup" aria-label="Configurație" className="mt-10 grid gap-4 md:grid-cols-3">
          {variants.map((v) => {
            const on = v.id === variantId
            const n = notes?.[v.id]
            const vp = unitPrice(product, v)
            return (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => choose(v.id)}
                className={`flex flex-col items-start rounded-[22px] p-5 text-left md:p-6 transition-[box-shadow,background-color] duration-200 ${
                  on ? 'bg-[var(--lp-panel)] shadow-[inset_0_0_0_2px_var(--lp-accent)]' : 'bg-transparent shadow-[inset_0_0_0_1px_var(--lp-line)] hover:shadow-[inset_0_0_0_1px_var(--lp-muted)]'
                }`}
              >
                <span className="flex w-full items-start justify-between">
                  <span className="text-[40px] leading-none font-medium tracking-[-0.05em] text-[var(--lp-ink)] tabular-nums md:text-[56px]">{n?.big ?? variantLabel(product, v)}</span>
                  <span aria-hidden className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full ${on ? 'bg-[var(--lp-accent)]' : 'shadow-[inset_0_0_0_1.5px_var(--lp-line)]'}`}>
                    {on && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                </span>
                <span className="mt-2 text-[17px] font-semibold text-[var(--lp-ink)]">{variantLabel(product, v)}</span>
                {n && <span className="mt-2 text-[15px] leading-snug text-[var(--lp-muted)]">{n.text}</span>}
                <span className="mt-auto pt-3 text-[22px] md:pt-6 font-medium tracking-[-0.02em] text-[var(--lp-ink)] tabular-nums">{vp !== null ? formatLei(vp) : ''}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-8 rounded-[22px] bg-[var(--lp-panel)] p-6 sm:p-8">
          <p className="text-[15px] text-[var(--lp-muted)]">
            Ai ales: <strong className="font-semibold text-[var(--lp-ink)]">{product.name}, {variant ? variantLabel(product, variant) : ''}</strong>
          </p>
          <div className="mt-2">{buy}</div>
        </div>
      </section>
    )
  }

  return (
    <section id="comanda" aria-labelledby="offer-title" className="lp-wrap scroll-mt-20 py-[var(--sec)]">
      <div className="grid overflow-hidden rounded-[28px] bg-[var(--lp-panel)] md:grid-cols-12">
        <div className="relative aspect-[4/3] md:col-span-6 md:aspect-auto md:min-h-[540px]">
          <Image
            key={image.src.src}
            src={image.src}
            alt={image.alt}
            fill
            sizes="(min-width: 1152px) 560px, (min-width: 768px) 50vw, 100vw"
            className={`lp-fade ${image.kind === 'cutout' ? `object-contain p-[12%] ${image.bleed === 'bottom' ? 'object-bottom pb-0' : ''}` : 'object-cover'}`}
          />
        </div>
        <div className="p-[clamp(24px,5vw,64px)] md:col-span-6 max-md:pt-2">
          <p className="text-[15px] font-semibold text-[var(--lp-accent)]">{product.name}</p>
          <h2 id="offer-title" className="mt-2 text-[clamp(30px,3.4vw,46px)] leading-[1.02] tracking-[-0.04em] text-[var(--lp-ink)]">
            {title}
          </h2>
          <p className="mt-3 max-w-[30em] text-[17px] leading-relaxed text-[var(--lp-muted)]">{text}</p>

          {variants.length > 0 && (
            <fieldset className="mt-7">
              <legend className="text-[15px] text-[var(--lp-muted)]">
                Rama: <strong className="font-semibold text-[var(--lp-ink)]">{variant ? variantLabel(product, variant) : ''}</strong>
              </legend>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {variants.map((v) => {
                  const on = v.id === variantId
                  const swatch = product.options?.flatMap((o) => o.values).find((val) => val.id === v.options.culoare)?.swatch
                  return (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => choose(v.id)}
                      className={`flex min-h-14 items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-left text-[15px] leading-snug font-medium text-[var(--lp-ink)] transition-[box-shadow,background-color] duration-150 sm:px-4 ${
                        on ? 'bg-[var(--lp-bg)] shadow-[inset_0_0_0_2px_var(--lp-accent)]' : 'shadow-[inset_0_0_0_1px_var(--lp-line)] hover:shadow-[inset_0_0_0_1px_var(--lp-muted)]'
                      }`}
                    >
                      {swatch && <span aria-hidden className="h-4 w-4 flex-none rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,.2)]" style={{ background: swatch }} />}
                      {variantLabel(product, v)}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          )}
          <div className="mt-7">{buy}</div>
        </div>
      </div>
    </section>
  )
}
