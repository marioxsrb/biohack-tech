'use client'

import { useEffect, useRef, useState } from 'react'
import { useCart } from '@/components/cart/CartProvider'
import { QuantityStepper } from '@/components/cart/QuantityStepper'
import { Check, Plus } from '@/components/ui/icons'
import { getProduct, variantLabel, type ProductId } from '@/content/catalog'
import { terms } from '@/config/site'
import { formatMoney } from '@/lib/money'
import { Gallery } from './Gallery'

type Props = { productId: ProductId; intro: string; benefits: string[] }

/** The first screen of a product page: pictures on the left, everything needed to buy on the right. */
export function ProductHero({ productId, intro, benefits }: Props) {
  const product = getProduct(productId)!
  const { add } = useCart()

  const [selected, setSelected] = useState<Record<string, string>>(() => product.variants?.[0]?.options ?? {})
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const [barVisible, setBarVisible] = useState(false)
  const buyRef = useRef<HTMLDivElement>(null)

  const variant = product.variants?.find((v) => Object.entries(v.options).every(([k, val]) => selected[k] === val))
  const images = variant?.images ?? product.images

  // Compact purchase bar once the main button has scrolled away (phones and tablets).
  useEffect(() => {
    const el = buyRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setBarVisible(!e.isIntersecting && e.boundingClientRect.top < 0))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!added) return
    const t = setTimeout(() => setAdded(false), 1800)
    return () => clearTimeout(t)
  }, [added])

  const onAdd = () => {
    add(product.id, variant?.id, quantity)
    setAdded(true)
    setQuantity(1)
  }

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

  const addLabel = added ? (
    <>
      Adăugat în coș <Check />
    </>
  ) : (
    <>
      Adaugă în coș <Plus />
    </>
  )

  return (
    <>
      <div className="grid grid-cols-1 gap-y-10 md:grid-cols-12 md:gap-x-10 lg:gap-x-16">
        <div className="md:col-span-7">
          <Gallery key={variant?.id ?? product.id} images={images} label={`Imagini ${product.name}`} />
        </div>

        <div className="md:col-span-5 md:pt-4">
          <p className="text-[15px] text-muted">{product.purpose}</p>
          <h1 className="mt-2 text-[clamp(40px,4.4vw,60px)] leading-[0.98] tracking-[-0.045em]">{product.name}</h1>
          <p className="mt-5 text-[17px] leading-relaxed text-text">{intro}</p>

          <p className="mt-7 text-[26px] font-medium tracking-[-0.025em] text-ink tabular-nums">{formatMoney(product.price)}</p>

          {product.options?.map((opt) => {
            const avail = available(opt.id)
            const current = opt.values.find((v) => v.id === selected[opt.id])
            const values = opt.values.filter((v) => opt.id === 'model' || avail.has(v.id))
            const swatches = values.every((v) => v.swatch)
            return (
              <fieldset key={opt.id} className="mt-7">
                <legend className="text-[15px] text-muted">
                  {opt.label}: <span className="text-ink">{current?.label}</span>
                </legend>
                <div className={`mt-3 flex flex-wrap ${swatches ? 'gap-3' : 'gap-2'}`}>
                  {values.map((val) => {
                    const on = selected[opt.id] === val.id
                    return swatches ? (
                      <button
                        key={val.id}
                        type="button"
                        aria-pressed={on}
                        aria-label={val.label}
                        onClick={() => choose(opt.id, val.id)}
                        className={`h-11 w-11 rounded-full p-[3px] transition-shadow duration-200 ${
                          on ? 'shadow-[0_0_0_2px_var(--color-ink)]' : 'hover:shadow-[0_0_0_1px_var(--color-faint)]'
                        }`}
                      >
                        <span className="block h-full w-full rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,.12)]" style={{ background: val.swatch }} />
                      </button>
                    ) : (
                      <button
                        key={val.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => choose(opt.id, val.id)}
                        className={`h-11 rounded-full px-5 text-[15px] font-medium transition-[background-color,color] duration-200 ${
                          on ? 'bg-ink text-white' : 'bg-mist text-ink hover:bg-mist-2'
                        }`}
                      >
                        {val.label}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            )
          })}

          <div ref={buyRef} className="mt-8 flex gap-3">
            <QuantityStepper value={quantity} onChange={setQuantity} label="Cantitate" />
            <button type="button" onClick={onAdd} className="cta min-w-0 flex-1 !px-5">
              {addLabel}
            </button>
          </div>
          <p className="mt-4 text-[14px] text-muted">
            Livrare gratuită · Retur în {terms.returnDays} zile · Garanție {terms.warrantyYears} ani
          </p>

          <ul className="mt-9 space-y-3 border-t border-mist-2 pt-7">
            {benefits.map((b) => (
              <li key={b} className="flex items-baseline gap-3 text-[16.5px] text-ink">
                <span aria-hidden className="h-1.5 w-1.5 flex-none translate-y-[-2px] rounded-full bg-cyan" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div
        className={`fixed inset-x-0 bottom-0 z-[200] border-t border-mist-2 bg-paper/95 backdrop-blur-md transition-transform duration-300 ease-[var(--ease-brand)] lg:hidden ${
          barVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
        aria-hidden={!barVisible}
        inert={!barVisible}
      >
        <div className="wrap flex items-center gap-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium text-ink">{product.name}</p>
            <p className="truncate text-[13.5px] text-muted">
              {formatMoney(product.price)}
              {variant && ` · ${variantLabel(product, variant)}`}
            </p>
          </div>
          <button type="button" onClick={onAdd} className="cta sm !min-h-12 !px-5">
            {added ? (
              <>
                Adăugat <Check />
              </>
            ) : (
              <>
                Adaugă <Plus />
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
