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

const Tick = () => <Check className="h-4 w-4" aria-hidden />

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

  // Compact purchase bar (phones and tablets): shown whenever no "Adaugă în coș" is on screen,
  // whether the main button is above, below, or the closing panel hasn't arrived yet.
  useEffect(() => {
    const main = buyRef.current
    if (!main) return
    const seen = new Map<Element, boolean>()
    // A button that's mostly cut off by the screen edge doesn't count as visible.
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
  }, [])

  // Keep the page's last lines clear of the bar.
  useEffect(() => {
    const root = document.documentElement
    if (barVisible) root.dataset.buybar = ''
    else delete root.dataset.buybar
    return () => void delete root.dataset.buybar
  }, [barVisible])

  // A frame chosen elsewhere (homepage, the scene below) arrives as #variant-id.
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
          <Gallery key={variant?.id ?? product.id} images={images} label={`Imagini ${product.name}`} frame={product.variants ? 'aspect-[4/3] max-sm:aspect-[16/10]' : undefined} />
        </div>

        <div className="md:col-span-5 md:pt-2">
          <p className="text-[16px] font-medium text-cyan-700">{product.purpose}</p>
          <h1 className="mt-1 text-[clamp(38px,4.4vw,60px)] leading-[0.98] tracking-[-0.045em]">{product.name}</h1>
          <p className="mt-3 text-[17px] leading-snug text-text">{product.tagline}</p>

          <p className="mt-5 text-[28px] font-medium tracking-[-0.025em] text-ink tabular-nums">{formatMoney(product.price)}</p>

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
                        {on && <Tick />}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            )
          })}

          <div ref={buyRef} className="mt-7 flex gap-3">
            <QuantityStepper value={quantity} onChange={setQuantity} label="Cantitate" />
            <button type="button" onClick={onAdd} className="cta min-w-0 flex-1 !px-5">
              {addLabel}
            </button>
          </div>
          {variant && (
            <p className="mt-3 text-[15px] text-text">
              Adaugi: <strong className="font-semibold text-ink">{product.name}, {variantLabel(product, variant)}</strong>
            </p>
          )}
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[15px] text-text">
            <li>✓ Livrare gratuită</li>
            <li>✓ Retur în {terms.returnDays} zile</li>
            <li>✓ Garanție {terms.warrantyYears} ani</li>
          </ul>

          <div className="mt-8 border-t border-mist-2 pt-6">
            <p className="text-[16.5px] leading-relaxed text-text">{intro}</p>
            <ul className="mt-5 space-y-2.5">
              {benefits.map((b) => (
                <li key={b} className="flex items-baseline gap-3 text-[16.5px] text-ink">
                  <span aria-hidden className="h-1.5 w-1.5 flex-none translate-y-[-2px] rounded-full bg-cyan-700" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
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
          <button type="button" onClick={onAdd} className="cta sm !min-h-12 !px-4">
            {added ? (
              <>
                Adăugat <Check />
              </>
            ) : (
              <>
                Adaugă în coș <Plus />
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
