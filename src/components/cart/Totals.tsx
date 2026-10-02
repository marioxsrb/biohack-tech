'use client'

import { promoText } from '@/config/promotions'
import { useLocale } from '@/i18n/LocaleProvider'
import type { Pricing } from '@/lib/promotions'
import { formatLei } from '@/lib/money'

const COPY = {
  ro: { delivery: 'Livrare în România', free: 'Gratuită' },
  en: { delivery: 'Delivery in Romania', free: 'Free' },
}

/** Subtotal, each promotion with its amount, shipping and total. Same rows in the cart and the checkout. */
export function Totals({ pricing, totalClassName = 'text-[26px]' }: { pricing: Pricing; totalClassName?: string }) {
  const locale = useLocale()
  const t = COPY[locale]
  return (
    <dl className="space-y-2 text-[15.5px]">
      <div className="flex justify-between">
        <dt className="text-muted">Subtotal</dt>
        <dd className="text-ink tabular-nums">{formatLei(pricing.subtotalMinor)}</dd>
      </div>
      {pricing.promotions.map((p) => (
        <div key={p.id} className="flex justify-between gap-3 font-medium text-cyan-700">
          <dt>{promoText(p.label, locale)}</dt>
          <dd className="tabular-nums whitespace-nowrap">−{formatLei(p.amountMinor)}</dd>
        </div>
      ))}
      <div className="flex justify-between">
        <dt className="text-muted">{t.delivery}</dt>
        <dd className="text-ink">{t.free}</dd>
      </div>
      <div className="flex items-baseline justify-between border-t border-mist-2 pt-3">
        <dt className="font-medium text-ink">Total</dt>
        <dd className={`${totalClassName} font-medium tracking-[-0.02em] text-ink tabular-nums`}>{formatLei(pricing.totalMinor)}</dd>
      </div>
    </dl>
  )
}
