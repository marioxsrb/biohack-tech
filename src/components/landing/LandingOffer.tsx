'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Arrow } from '@/components/ui/icons'
import { getProduct, unitPrice, variantLabel, type ProductId } from '@/content/catalog'
import { terms } from '@/config/site'
import { itemOf, track } from '@/lib/analytics'
import type { LandingSlug } from '@/lib/landing-hosts'
import { formatLei } from '@/lib/money'
import { PromoNote } from '@/components/cart/PromoNote'
import { checkoutHref } from './checkout-link'

type Props = { slug: LandingSlug; productId: ProductId; title: string; text: string }

/**
 * The offer: the variant picker (when the product has variants), the price of the chosen one, and one
 * button to the checkout. The link carries ids only; the checkout and the server price everything again.
 */
export function LandingOffer({ slug, productId, title, text }: Props) {
  const product = getProduct(productId)!
  const variants = product.variants ?? []
  const [variantId, setVariantId] = useState<string | undefined>(() => defaultVariant(productId))
  const variant = variants.find((v) => v.id === variantId)
  const price = unitPrice(product, variant)
  const image = variant?.images.find((i) => i.kind === 'cutout') ?? product.cutout
  const router = useRouter()

  // One view_item per landing view (consent-aware: nothing is sent without it).
  useEffect(() => {
    track('view_item', { value: price ?? 0, items: [itemOf(product, variant, variant && variantLabel(product, variant))] })
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

  return (
    <section id="comanda" aria-labelledby="offer-title" className="lp-wrap scroll-mt-20 py-[var(--sec)]">
      <div className="grid overflow-hidden rounded-[28px] bg-[var(--lp-panel)] md:grid-cols-12">
        <div className="relative aspect-[4/3] md:col-span-6 md:aspect-auto md:min-h-[520px]">
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
          <p className="text-[15px] font-medium text-[var(--lp-accent)]">{product.name}</p>
          <h2 id="offer-title" className="mt-2 text-[clamp(32px,3.6vw,48px)] leading-[1.02] tracking-[-0.04em] text-[var(--lp-ink)]">
            {title}
          </h2>
          <p className="mt-3 max-w-[30em] text-[17px] leading-relaxed text-[var(--lp-muted)]">{text}</p>

          {variants.length > 0 && (
            <fieldset className="mt-7">
              <legend className="text-[15px] text-[var(--lp-muted)]">
                {product.options?.[0]?.id === 'zone' ? 'Configurație' : 'Rama'}:{' '}
                <strong className="font-semibold text-[var(--lp-ink)]">{variant ? variantLabel(product, variant) : ''}</strong>
              </legend>
              <div className={`mt-3 grid gap-2 ${variants.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {variants.map((v) => {
                  const on = v.id === variantId
                  const vp = unitPrice(product, v)
                  const swatch = product.options?.flatMap((o) => o.values).find((val) => val.id === v.options.culoare)?.swatch
                  return (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => choose(v.id)}
                      className={`flex min-h-14 flex-col items-start justify-center rounded-[14px] px-3 py-2.5 text-left sm:px-4 transition-[box-shadow,background-color] duration-150 ${
                        on ? 'bg-[var(--lp-bg)] shadow-[inset_0_0_0_2px_var(--lp-accent)]' : 'shadow-[inset_0_0_0_1px_var(--lp-line)] hover:shadow-[inset_0_0_0_1px_var(--lp-muted)]'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-[15px] leading-snug font-medium text-[var(--lp-ink)]">
                        {swatch && <span aria-hidden className="h-4 w-4 flex-none rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,.2)]" style={{ background: swatch }} />}
                        {variantLabel(product, v)}
                      </span>
                      {product.variablePrice && vp !== null && <span className="mt-0.5 text-[13.5px] text-[var(--lp-muted)] tabular-nums">{formatLei(vp)}</span>}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          )}

          <p className="mt-7 flex items-baseline gap-3 text-[34px] font-medium tracking-[-0.03em] text-[var(--lp-ink)] tabular-nums" aria-live="polite">
            {price !== null ? formatLei(price) : 'Preț în curând'}
            {price !== null && <span className="text-[14px] font-normal tracking-normal text-[var(--lp-muted)]">{terms.vat}</span>}
          </p>

          {price !== null && <PromoNote productId={product.id} full className="mt-3 [&_.text-text]:!text-[var(--lp-muted)]" />}
          {price !== null && (
            <a href={href} onClick={go} className="cta mt-5 w-full sm:w-auto">
              Comandă acum <Arrow />
            </a>
          )}
          <p className="mt-4 text-[14.5px] leading-relaxed text-[var(--lp-muted)]">
            Plătești cu cardul sau prin transfer bancar. Verifici totul înainte să plasezi comanda.
          </p>
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-[var(--lp-line)] pt-5 text-[15px] text-[var(--lp-ink)] max-sm:flex-col">
            <li>✓ Livrare gratuită</li>
            <li>✓ Retur în {terms.returnDays} zile</li>
            <li>✓ Garanție {terms.warrantyYears} ani</li>
          </ul>
        </div>
      </div>
    </section>
  )
}

/** Brain Flow opens on 4 zones (the configuration the source site showed first); others on the first variant. */
function defaultVariant(productId: ProductId) {
  const p = getProduct(productId)!
  if (!p.variants?.length) return undefined
  return p.variants.find((v) => v.id === '4-zone')?.id ?? p.variants[0].id
}
