'use client'

import { promoText } from '@/config/promotions'
import { useLocale } from '@/i18n/LocaleProvider'
import type { Pricing } from '@/lib/promotions'
import { useMoney } from '@/i18n/currency'

const COPY = {
  ro: { delivery: 'Livrare', free: 'Gratuită' },
  en: { delivery: 'Delivery', free: 'Free' },
}

/**
 * Subtotal, each promotion with its amount, shipping and total (in the visitor's currency). Same rows in the cart and
 * the checkout. Shipping (lib/shipping.ts: the book's flat fee, otherwise free) comes after the discounts.
 */
export function Totals({ pricing, shippingMinor = 0, totalClassName = 'text-[26px]' }: { pricing: Pricing; shippingMinor?: number; totalClassName?: string }) {
  const locale = useLocale()
  const t = COPY[locale]
  const { fmt } = useMoney()
  return (
    <dl className="space-y-2 text-[15.5px]">
      <div className="flex justify-between">
        <dt className="text-muted">Subtotal</dt>
        <dd data-price className="text-ink tabular-nums">{fmt(pricing.subtotalMinor)}</dd>
      </div>
      {pricing.promotions.map((p) => (
        <div key={p.id} className="flex justify-between gap-3 font-medium text-cyan-700">
          <dt>{promoText(p.label, locale)}</dt>
          <dd data-price className="tabular-nums whitespace-nowrap">−{fmt(p.amountMinor)}</dd>
        </div>
      ))}
      <div className="flex justify-between">
        <dt className="text-muted">{t.delivery}</dt>
        {shippingMinor > 0 ? (
          <dd data-price className="text-ink tabular-nums">{fmt(shippingMinor)}</dd>
        ) : (
          <dd className="text-ink">{t.free}</dd>
        )}
      </div>
      <div className="flex items-baseline justify-between border-t border-mist-2 pt-3">
        <dt className="font-medium text-ink">Total</dt>
        <dd data-price className={`${totalClassName} font-medium tracking-[-0.02em] text-ink tabular-nums`}>{fmt(pricing.totalMinor + shippingMinor)}</dd>
      </div>
    </dl>
  )
}
