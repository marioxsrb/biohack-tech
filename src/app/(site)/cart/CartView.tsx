'use client'

import Link from 'next/link'
import { PromotionHints, Totals } from '@/components/cart/Totals'
import { useEffect, useSyncExternalStore } from 'react'
import { useCart } from '@/components/cart/CartProvider'
import { Price } from '@/components/cart/Price'
import { QuantityStepper } from '@/components/cart/QuantityStepper'
import { Thumb } from '@/components/cart/Thumb'
import { Arrow, Lock } from '@/components/ui/icons'
import { productHref, products } from '@/content/catalog'
import { terms } from '@/config/site'
import { track } from '@/lib/analytics'
import { formatLei } from '@/lib/money'

const useHydrated = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

/** The cart as its own page: every line editable, one clear way forward. */
export function CartView() {
  const hydrated = useHydrated()
  const { lines, count, pricing, hints, setQuantity, remove } = useCart()

  useEffect(() => {
    if (hydrated && lines.length) track('view_cart', { value: pricing.totalMinor, items: lines })
    // Once per visit of the page, not on every quantity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  if (!hydrated) return <div className="min-h-[50vh]" aria-busy="true" />

  if (!lines.length) {
    return (
      <div className="max-w-[40em] py-6">
        <h1 className="text-[36px] tracking-[-0.035em] max-sm:text-[30px]">Coșul tău este gol.</h1>
        <p className="sub mt-3">Alege unul dintre produsele noastre.</p>
        <ul className="mt-8 grid gap-2">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={productHref(p)} className="group grid grid-cols-[88px_1fr_auto] items-center gap-4 rounded-[16px] bg-paper p-3 transition-shadow hover:shadow-[inset_0_0_0_1px_var(--color-line)]">
                <Thumb image={p.cutout} className="h-[68px] w-[88px] bg-mist" />
                <span>
                  <span className="block text-[17px] font-medium text-ink">{p.name}</span>
                  <span className="block text-[14.5px] text-muted">
                    {p.purpose} · <Price productId={p.id} />
                  </span>
                </span>
                <Arrow className="mr-2 h-4 w-4 text-muted transition-transform group-hover:translate-x-1 group-hover:text-ink" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-[clamp(30px,3.4vw,40px)] leading-tight tracking-[-0.035em]">
        Coșul tău <span className="text-muted">({count})</span>
      </h1>
      <div className="mt-8 grid gap-y-6 md:grid-cols-12 md:gap-x-8 lg:gap-x-12">
        <ul className="rounded-[20px] bg-paper px-6 md:col-span-7 max-sm:px-4" aria-label="Produse în coș">
          {lines.map((l) => (
            <li key={l.key} className="grid grid-cols-[112px_1fr] gap-5 border-b border-mist-2 py-6 last:border-0 max-sm:grid-cols-[84px_1fr] max-sm:gap-4">
              <Link href={productHref(l.product)} tabIndex={-1} aria-hidden>
                <Thumb image={l.variant?.images[0] ?? l.product.cutout} sizes="112px" className="h-[88px] w-[112px] bg-mist max-sm:h-[68px] max-sm:w-[84px]" />
              </Link>
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link href={productHref(l.product)} className="text-[17px] font-medium text-ink hover:underline">
                      {l.product.name}
                    </Link>
                    <p className="text-[15px] text-muted">{l.variantLabel ?? l.product.purpose}</p>
                    <p className="mt-0.5 text-[14px] text-muted tabular-nums">{formatLei(l.unit)} / buc.</p>
                  </div>
                  <p className="flex-none text-[17px] font-medium text-ink tabular-nums">{formatLei(l.unit * l.quantity)}</p>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <QuantityStepper size="sm" value={l.quantity} onChange={(q) => setQuantity(l.key, q)} label={`Cantitate ${l.product.name}`} />
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

        <aside className="md:col-span-5" aria-labelledby="cart-summary">
          <div className="rounded-[20px] bg-paper p-6 md:sticky md:top-[calc(var(--nav-h)+24px)] max-sm:p-5">
            <h2 id="cart-summary" className="text-[20px] tracking-[-0.015em]">
              Sumar
            </h2>
            <div className="mt-4">
              <Totals pricing={pricing} />
            </div>
            <p className="text-right text-[13px] text-muted">{terms.vat}</p>
            <PromotionHints hints={hints} className="mt-4" />
            <Link href="/checkout" className="cta mt-5 w-full">
              <Lock /> Finalizează comanda
            </Link>
            <Link href="/products" className="btn-secondary mt-2 w-full">
              Continuă cumpărăturile
            </Link>
            <ul className="mt-5 space-y-1 text-[14.5px] text-text">
              <li>✓ Livrare gratuită în România</li>
              <li>✓ Retur în {terms.returnDays} zile</li>
              <li>✓ Garanție {terms.warrantyYears} ani</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
