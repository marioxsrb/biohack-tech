'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useCart } from '@/components/cart/CartProvider'
import { QuantityStepper } from '@/components/cart/QuantityStepper'
import { Arrow, Check, Plus } from '@/components/ui/icons'
import { getProduct, variantLabel, type ProductId } from '@/content/catalog'
import { terms } from '@/config/site'
import { formatMoney } from '@/lib/money'
import { Gallery } from './Gallery'

type Props = { productId: ProductId; highlights: string[] }

export function ProductHero({ productId, highlights }: Props) {
  const product = getProduct(productId)!
  const { add } = useCart()

  const [selected, setSelected] = useState<Record<string, string>>(() => product.variants?.[0]?.options ?? {})
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const [barVisible, setBarVisible] = useState(false)
  const buyRef = useRef<HTMLDivElement>(null)

  const variant = product.variants?.find((v) => Object.entries(v.options).every(([k, val]) => selected[k] === val))
  const images = variant?.images ?? product.images

  // Show the compact purchase bar once the main button has scrolled out of view.
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

  /** Values available for an option, given the other current selections. */
  const available = (optionId: string) =>
    new Set(
      (product.variants ?? [])
        .filter((v) => Object.entries(selected).every(([k, val]) => k === optionId || v.options[k] === val))
        .map((v) => v.options[optionId]),
    )

  const choose = (optionId: string, valueId: string) => {
    const next = { ...selected, [optionId]: valueId }
    // If the combination doesn't exist (e.g. cat eye in maro), keep the new choice and
    // take the first variant that has it.
    const exact = product.variants?.some((v) => Object.entries(next).every(([k, val]) => v.options[k] === val))
    if (!exact) {
      const fallback = product.variants?.find((v) => v.options[optionId] === valueId)
      if (fallback) return setSelected(fallback.options)
    }
    setSelected(next)
  }

  return (
    <>
      <div className="grid gap-y-8 md:grid-cols-12 md:gap-x-6 lg:gap-x-10">
        <div className="md:col-span-6 lg:col-span-7">
          <Gallery key={variant?.id ?? product.id} images={images} label={`Imagini ${product.name}`} />
        </div>

        <div className="md:col-span-6 lg:col-span-5">
          <p className="mono !text-cyan-700">{product.category}</p>
          <h1 className="mt-3 text-[40px] leading-[1.02] tracking-[-0.04em] max-sm:text-[32px]">{product.name}</h1>
          <p className="mt-3 text-[17px] text-muted">{product.tagline}</p>

          <p className="mt-6 flex flex-wrap items-baseline gap-x-3">
            <span className="text-[28px] font-medium tracking-[-0.025em] text-ink tabular-nums">{formatMoney(product.price)}</span>
            <span className="text-[14px] text-muted">{terms.vat}</span>
          </p>

          <ul className="checks mt-5 text-[15.5px]">
            {highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>

          {product.options?.map((opt) => {
            const avail = available(opt.id)
            const current = opt.values.find((v) => v.id === selected[opt.id])
            const values = opt.values.filter((v) => avail.has(v.id) || opt.id === 'model')
            return (
              <fieldset key={opt.id} className="mt-7">
                <legend className="text-[14px] text-muted">
                  {opt.label}: <span className="font-medium text-ink">{current?.label}</span>
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
                        className={`flex h-11 items-center gap-2.5 rounded-[10px] px-4 text-[15px] font-medium transition-shadow duration-200 ${
                          on
                            ? 'text-ink shadow-[inset_0_0_0_2px_var(--color-ink)]'
                            : 'text-text shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-ink)]'
                        }`}
                      >
                        {val.swatch && (
                          <span
                            aria-hidden
                            className="h-4 w-4 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,.12)]"
                            style={{ background: val.swatch }}
                          />
                        )}
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
              {added ? (
                <>
                  Adăugat în coș <Check />
                </>
              ) : (
                <>
                  Adaugă în coș <Plus />
                </>
              )}
            </button>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 border-t border-mist-2 text-[14.5px]">
            {[
              ['Livrare', 'Gratuită în România'],
              ['Expediere', `În ${terms.processingDays}`],
              ['Retur', `${terms.returnDays} zile`],
              ['Garanție', `${terms.warrantyYears} ani`],
            ].map(([k, v]) => (
              <div key={k} className="border-b border-mist-2 py-2.5">
                <dt className="mono !text-[11px]">{k}</dt>
                <dd className="mt-0.5 text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          {product.guidance && (
            <p className="mt-5 text-[15px] text-muted">
              Include o consultație inițială cu un specialist.{' '}
              <Link href="/contact-us" className="tlink !inline font-medium">
                Ai întrebări înainte?
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* Compact purchase bar for small screens */}
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

export function Breadcrumb({ name }: { name: string }) {
  return (
    <nav aria-label="Navigare" className="mb-6 text-[14px] text-muted max-sm:mb-4">
      <ol className="flex flex-wrap items-center gap-2">
        <li>
          <Link href="/" className="hover:text-ink">
            Acasă
          </Link>
        </li>
        <li aria-hidden>
          <Arrow className="h-3 w-3" />
        </li>
        <li>
          <Link href="/products" className="hover:text-ink">
            Produse
          </Link>
        </li>
        <li aria-hidden>
          <Arrow className="h-3 w-3" />
        </li>
        <li aria-current="page" className="text-ink">
          {name}
        </li>
      </ol>
    </nav>
  )
}
