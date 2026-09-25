'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { ProductShot } from '@/components/product/ProductShot'
import { Arrow, Check, Close } from '@/components/ui/icons'
import { productHref, products } from '@/content/catalog'
import { terms } from '@/config/site'
import { formatMoney } from '@/lib/money'
import { useCart } from './CartProvider'
import { QuantityStepper } from './QuantityStepper'

/**
 * Cart drawer, built on <dialog>: focus trap, Escape and inert background come
 * from the platform. Opens after every add so the buyer sees what happened.
 */
export function CartDrawer() {
  const { isOpen, close, lines, count, totals, setQuantity, remove, lastAdded } = useCart()
  const added = lines.find((l) => l.key === lastAdded)
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (isOpen && !d.open) d.showModal()
    if (!isOpen && d.open) d.close()
  }, [isOpen])

  const mixed = totals.length > 1

  return (
    <dialog
      ref={ref}
      aria-labelledby="cart-title"
      onClose={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
      className="cart-drawer"
    >
      <div className="flex h-full flex-col">
        <header className="flex h-16 flex-none items-center justify-between border-b border-mist-2 px-6">
          <h2 id="cart-title" className="text-[18px] tracking-[-0.015em]">
            Coșul tău {count > 0 && <span className="text-muted">({count})</span>}
          </h2>
          <button
            type="button"
            onClick={close}
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-mist"
            aria-label="Închide coșul"
          >
            <Close className="h-5 w-5" />
          </button>
        </header>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col overflow-y-auto px-6 py-10">
            <p className="text-[22px] tracking-[-0.02em] text-ink">Coșul tău este gol.</p>
            <Link href="/products" onClick={close} className="cta mt-5 self-start">
              Vezi produsele <Arrow />
            </Link>
            <ul className="mt-8 divide-y divide-mist-2">
              {products.map((p) => (
                <li key={p.id}>
                  <Link href={productHref(p)} onClick={close} className="group flex items-center gap-4 py-3">
                    <span className="h-16 w-20 flex-none overflow-hidden rounded-[10px]">
                      <ProductShot image={p.cutout} sizes="80px" inset="sm" />
                    </span>
                    <span className="flex-1">
                      <span className="block font-medium text-ink">{p.name}</span>
                      <span className="block text-[14px] text-muted">{formatMoney(p.price)}</span>
                    </span>
                    <Arrow className="h-4 w-4 text-muted transition-transform group-hover:translate-x-1 group-hover:text-ink" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            {added && (
              <p className="flex flex-none items-center gap-3 bg-cyan-50 px-6 py-3.5 text-[15.5px] text-ink">
                <span aria-hidden className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-cyan-700 text-white">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span>
                  <strong className="font-semibold">Adăugat în coș:</strong> {added.product.name}
                  {added.variantLabel ? `, ${added.variantLabel}` : ''}
                </span>
              </p>
            )}
            <ul className="flex-1 divide-y divide-mist-2 overflow-y-auto px-6">
              {lines.map((l) => (
                <li key={l.key} className={`grid grid-cols-[88px_1fr] gap-4 py-5 transition-colors duration-500 ${l.key === lastAdded ? 'cart-line-new' : ''}`}>
                  <Link
                    href={productHref(l.product)}
                    onClick={close}
                    className="block h-[72px] overflow-hidden rounded-[10px]"
                    tabIndex={-1}
                    aria-hidden
                  >
                    <ProductShot image={l.variant?.images[0] ?? l.product.cutout} sizes="88px" inset="sm" />
                  </Link>
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={productHref(l.product)} onClick={close} className="font-medium text-ink hover:underline">
                          {l.product.name}
                        </Link>
                        {l.variantLabel && <p className="text-[15px] text-text">{l.variantLabel}</p>}
                        {l.quantity > 1 && <p className="text-[14px] text-muted tabular-nums">{formatMoney(l.unit)} / buc.</p>}
                      </div>
                      <p className="flex-none text-[15px] font-medium tabular-nums text-ink">
                        {formatMoney({ ...l.unit, amount: l.unit.amount * l.quantity })}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <QuantityStepper
                        size="sm"
                        value={l.quantity}
                        onChange={(q) => setQuantity(l.key, q)}
                        label={`Cantitate ${l.product.name}`}
                      />
                      <button
                        type="button"
                        onClick={() => remove(l.key)}
                        className="-mr-2 flex min-h-11 items-center rounded px-2 text-[15px] text-muted underline underline-offset-4 hover:text-ink"
                        aria-label={`Elimină ${l.product.name}${l.variantLabel ? `, ${l.variantLabel}` : ''} din coș`}
                      >
                        Elimină
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <footer className="flex-none border-t border-mist-2 bg-paper px-6 pt-5 pb-[max(20px,env(safe-area-inset-bottom))]">
              <dl className="space-y-1.5 text-[15.5px]">
                <div className="flex justify-between">
                  <dt className="text-muted">Livrare</dt>
                  <dd className="text-ink">Gratuită</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="font-medium text-ink">Subtotal</dt>
                  <dd className="text-right text-[19px] font-medium tracking-[-0.015em] text-ink tabular-nums">
                    {totals.map((t) => formatMoney(t)).join(' + ')}
                  </dd>
                </div>
              </dl>
              <p className="mt-1 text-right text-[13px] text-muted">{terms.vat}</p>
              {mixed && (
                <p className="mt-3 rounded-[10px] bg-mist px-3.5 py-2.5 text-[13.5px] leading-snug text-text">
                  Produsele din coș au prețuri în monede diferite. La plată, fiecare monedă se achită separat.
                </p>
              )}
              <Link href="/checkout" onClick={close} className="cta mt-4 w-full">
                Continuă către plată <Arrow />
              </Link>
              <button
                type="button"
                onClick={close}
                className="mt-2 flex h-11 w-full items-center justify-center text-[15px] font-medium text-muted hover:text-ink"
              >
                Continuă cumpărăturile
              </button>
            </footer>
          </>
        )}
      </div>
    </dialog>
  )
}
