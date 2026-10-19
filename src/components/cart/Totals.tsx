'use client'

import { isBulk, promoText } from '@/config/promotions'
import { useLocale } from '@/i18n/LocaleProvider'
import type { Pricing } from '@/lib/promotions'
import { useMoney } from '@/i18n/currency'

const COPY = {
  ro: { delivery: 'Livrare', free: 'Gratuită', original: 'Subtotal inițial', after: 'Subtotal după reducere', vat: 'din care TVA 21%' },
  en: { delivery: 'Delivery', free: 'Free', original: 'Original subtotal', after: 'Subtotal after discount', vat: 'of which VAT 21%' },
}

/** The VAT inside a VAT-inclusive amount at 21% (same rate as the invoices), whole bani. */
const vatIn = (minor: number) => minor - Math.round(minor / 1.21)

/**
 * Subtotal, each promotion with its amount, shipping and total (in the visitor's currency). Same rows in the cart and
 * the checkout. Shipping (lib/shipping.ts: the book's flat fee, otherwise free) comes after the discounts.
 */
export function Totals({ pricing, shippingMinor = 0, totalClassName = 'text-[26px]' }: { pricing: Pricing; shippingMinor?: number; totalClassName?: string }) {
  const locale = useLocale()
  const t = COPY[locale]
  const { fmt } = useMoney()
  // A business order spells everything out: the original subtotal, the 40%, what is left, delivery and the VAT.
  const bulk = isBulk(pricing.promotions)
  return (
    <dl className="space-y-2 text-[15.5px]">
      <div className="flex justify-between">
        <dt className="text-muted">{bulk ? t.original : 'Subtotal'}</dt>
        <dd data-price className="text-ink tabular-nums">{fmt(pricing.subtotalMinor)}</dd>
      </div>
      {pricing.promotions.map((p) => (
        <div key={p.id} className="flex justify-between gap-3 font-medium text-cyan-700">
          <dt>{promoText(p.label, locale)}</dt>
          <dd data-price className="tabular-nums whitespace-nowrap">−{fmt(p.amountMinor)}</dd>
        </div>
      ))}
      {bulk && (
        <div className="flex justify-between">
          <dt className="text-muted">{t.after}</dt>
          <dd data-price className="text-ink tabular-nums">{fmt(pricing.totalMinor)}</dd>
        </div>
      )}
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
      {bulk && (
        <div className="flex justify-between text-[14px]">
          <dt className="text-muted">{t.vat}</dt>
          <dd data-price className="text-muted tabular-nums">{fmt(vatIn(pricing.totalMinor + shippingMinor))}</dd>
        </div>
      )}
    </dl>
  )
}
