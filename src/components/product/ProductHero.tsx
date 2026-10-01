'use client'

import { useEffect, useRef, useState } from 'react'
import { AddToCartButton } from '@/components/cart/AddToCartButton'
import { Price } from '@/components/cart/Price'
import { ProductOffer } from '@/components/offers/ProductOffer'
import { QuantityStepper } from '@/components/cart/QuantityStepper'
import { Check } from '@/components/ui/icons'
import { getProduct, isPurchasable, variantLabel, type ProductId } from '@/content/catalog'
import { terms } from '@/config/site'
import { Gallery } from './Gallery'

type Props = { productId: ProductId; intro: string }

/**
 * The first screen of a product page: the gallery (about 58%) and everything needed to
 * buy (about 42%): what it's for, name, one sentence, price, variant, quantity, button.
 */
export function ProductHero({ productId, intro }: Props) {
  const product = getProduct(productId)!
  const purchasable = isPurchasable(product)

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

  return (
    <>
      <div className="grid grid-cols-1 gap-y-8 md:grid-cols-12 md:gap-x-10 lg:gap-x-14">
        <div className="md:col-span-7">
          <Gallery key={variant?.id ?? product.id} images={images} label={`Imagini ${product.name}`} wide={!!product.variants} />
        </div>

        <div className="md:col-span-5 md:pt-2">
          <p className="text-[16px] font-medium text-cyan-700">{product.purpose}</p>
          <h1 className="mt-1 text-[clamp(38px,4.2vw,58px)] leading-[0.98] tracking-[-0.045em]">{product.name}</h1>
          <p className="mt-3 max-w-[30em] text-[17px] leading-snug text-text">{product.tagline}</p>

          <p className="mt-6 text-[30px] font-medium tracking-[-0.025em] text-ink">
            <Price productId={product.id} variantId={variant?.id} />
            {purchasable && <span className="ml-3 align-middle text-[14px] font-normal tracking-normal text-muted">{terms.vat}</span>}
          </p>
          {purchasable && (
            <>
              <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-muted">
                {['Livrare gratuită', `Retur în ${terms.returnDays} zile`, `Garanție ${terms.warrantyYears} ani`].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-cyan-700" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
              <ProductOffer productId={product.id} variantId={variant?.id} className="mt-6 max-w-[34em]" />
            </>
          )}

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
              </fieldset>
            )
          })}

          <div ref={buyRef} className="mt-7 flex gap-3">
            {purchasable && <QuantityStepper value={quantity} onChange={setQuantity} label="Cantitate" />}
            <AddToCartButton productId={product.id} variantId={variant?.id} quantity={quantity} className="min-w-0 flex-1 !px-5" onAdded={() => setQuantity(1)} />
          </div>
          {purchasable ? (
            variant && (
              <p className="mt-3 text-[15px] text-text">
                Adaugi: <strong className="font-semibold text-ink">{product.name}, {variantLabel(product, variant)}</strong>
              </p>
            )
          ) : (
            <p className="mt-3 max-w-[30em] text-[15px] text-text">Prețul în lei se anunță în curând. Scrie-ne și îți răspundem în cel mult 24 de ore.</p>
          )}

          <p className="mt-7 max-w-[32em] border-t border-mist-2 pt-6 text-[16.5px] leading-relaxed text-text">{intro}</p>
        </div>
      </div>

      {purchasable && (
        <div
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
            <AddToCartButton productId={product.id} variantId={variant?.id} size="sm" className="!min-h-12 !px-4" />
          </div>
        </div>
      )}
    </>
  )
}
