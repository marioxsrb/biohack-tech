'use client'

import { maxQtyFor } from '@/lib/purchase'
import Link from '@/components/ui/Link'
import { CarryLink } from '@/components/cart/CarryLink'
import { LineBundle } from '@/components/cart/LineBundle'
import { Suggestions } from '@/components/offers/Suggestions'
import { Totals } from '@/components/cart/Totals'
import { useEffect, useSyncExternalStore } from 'react'
import { useCart } from '@/components/cart/CartProvider'
import { Price } from '@/components/cart/Price'
import { QuantityStepper } from '@/components/cart/QuantityStepper'
import { Thumb } from '@/components/cart/Thumb'
import { Arrow, Lock } from '@/components/ui/icons'
import { productHref, productsIn } from '@/content/catalog'
import { useLocale, useUi } from '@/i18n/LocaleProvider'
import { track } from '@/lib/analytics'
import { useMoney } from '@/i18n/currency'

const COPY = {
  ro: {
    empty: 'Coșul tău este gol.',
    emptySub: 'Alege unul dintre produsele noastre.',
    title: 'Coșul tău',
    inCart: 'Produse în coș',
    each: '/ buc.',
    quantity: (name: string) => `Cantitate ${name}`,
    remove: 'Elimină',
    removeLabel: (name: string) => `Elimină ${name} din coș`,
    summary: 'Sumar',
  },
  en: {
    empty: 'Your cart is empty.',
    emptySub: 'Choose one of our products.',
    title: 'Your cart',
    inCart: 'Products in your cart',
    each: 'each',
    quantity: (name: string) => `Quantity of ${name}`,
    remove: 'Remove',
    removeLabel: (name: string) => `Remove ${name} from your cart`,
    summary: 'Summary',
  },
}

const useHydrated = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

/** The cart as its own page: every line editable, one clear way forward. */
export function CartView() {
  const hydrated = useHydrated()
  const { lines, count, pricing, shipping, setQuantity, remove } = useCart()
  const { fmt } = useMoney()
  const locale = useLocale()
  const t = COPY[locale]
  const ui = useUi()

  useEffect(() => {
    if (hydrated && lines.length) track('view_cart', { value: pricing.totalMinor + shipping, items: lines })
    // Once per visit of the page, not on every quantity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  if (!hydrated) return <div className="min-h-[50vh]" aria-busy="true" />

  if (!lines.length) {
    return (
      <div className="max-w-[40em] py-6">
        <h1 className="text-[36px] tracking-[-0.035em] max-sm:text-[30px]">{t.empty}</h1>
        <p className="sub mt-3">{t.emptySub}</p>
        <ul className="mt-8 grid gap-2">
          {productsIn(locale).map((p) => (
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
        {t.title} <span className="text-muted">({count})</span>
      </h1>
      {/* Order: the lines, then the summary (totals, the offer that is close, the button), then suggestions. */}
      <div className="mt-6 grid grid-cols-1 gap-y-4 md:mt-8 md:grid-cols-12 md:gap-x-8 lg:gap-x-12">
        <ul className="rounded-[20px] bg-paper px-6 md:col-span-7 md:self-start max-sm:px-4" aria-label={t.inCart}>
          {lines.map((l) => (
            <li key={l.key} className="grid grid-cols-[112px_1fr] gap-5 border-b border-mist-2 py-6 last:border-0 max-sm:grid-cols-[72px_1fr] max-sm:gap-3.5 max-sm:py-4">
              <Link href={productHref(l.product)} tabIndex={-1} aria-hidden>
                <Thumb image={l.variant?.images[0] ?? l.product.cutout} sizes="112px" className="h-[88px] w-[112px] bg-mist max-sm:h-[60px] max-sm:w-[72px]" />
              </Link>
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link href={productHref(l.product)} className="text-[17px] font-medium text-ink hover:underline">
                      {l.product.name}
                    </Link>
                    <p className="text-[15px] text-muted">{l.variantLabel ?? l.product.purpose}</p>
                    <p data-price className="mt-0.5 text-[14px] text-muted tabular-nums">{fmt(l.unit)} {t.each}</p>
                  </div>
                  <p data-price className="flex-none text-[17px] font-medium text-ink tabular-nums">{fmt(l.unit * l.quantity)}</p>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 max-sm:mt-2.5">
                  <QuantityStepper size="sm" max={maxQtyFor(l.product.id)} value={l.quantity} onChange={(q) => setQuantity(l.key, q)} label={t.quantity(l.product.name)} />
                  <button
                    type="button"
                    onClick={() => remove(l.key)}
                    className="-mr-2 flex min-h-11 items-center rounded px-2 text-[15px] text-muted underline underline-offset-4 hover:text-ink"
                    aria-label={t.removeLabel(`${l.product.name}${l.variantLabel ? `, ${l.variantLabel}` : ''}`)}
                  >
                    {t.remove}
                  </button>
                </div>
                {/* The product page's choices: 2 or 3 at a lower price (Amber: the frames configurator). */}
                <LineBundle line={l} placement="cart" className="mt-4 max-w-[460px]" />
              </div>
            </li>
          ))}
        </ul>

        <aside className="md:col-span-5" aria-labelledby="cart-summary">
          <div className="rounded-[20px] bg-paper p-6 md:sticky md:top-[calc(var(--nav-h)+24px)] max-sm:p-5">
            <h2 id="cart-summary" className="text-[20px] tracking-[-0.015em]">
              {t.summary}
            </h2>
            <div className="mt-4">
              <Totals pricing={pricing} shippingMinor={shipping} />
            </div>
            <p className="text-right text-[13px] text-muted">{ui.vat}</p>
            <CarryLink href="/checkout" className="cta mt-5 w-full">
              <Lock /> {ui.checkout}
            </CarryLink>
            <p className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[14px] text-text">
              <span>✓ {shipping ? ui.bookDelivery : `${ui.freeDelivery} · ${ui.returns} · ${ui.warranty}`}</span>
              <Link href="/products" className="font-medium text-ink underline underline-offset-4">
                {ui.keepShopping}
              </Link>
            </p>
            <Suggestions placement="cart" className="mt-5 block border-t border-mist-2 pt-5" />
          </div>
        </aside>
      </div>
    </div>
  )
}
