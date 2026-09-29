import type { Pricing } from '@/lib/promotions'
import { formatLei } from '@/lib/money'

/** Subtotal, each promotion with its amount, shipping and total. Same rows in the cart and the checkout. */
export function Totals({ pricing, totalClassName = 'text-[26px]' }: { pricing: Pricing; totalClassName?: string }) {
  return (
    <dl className="space-y-2 text-[15.5px]">
      <div className="flex justify-between">
        <dt className="text-muted">Subtotal</dt>
        <dd className="text-ink tabular-nums">{formatLei(pricing.subtotalMinor)}</dd>
      </div>
      {pricing.promotions.map((p) => (
        <div key={p.id} className="flex justify-between gap-3 font-medium text-cyan-700">
          <dt>{p.label}</dt>
          <dd className="tabular-nums whitespace-nowrap">−{formatLei(p.amountMinor)}</dd>
        </div>
      ))}
      <div className="flex justify-between">
        <dt className="text-muted">Livrare în România</dt>
        <dd className="text-ink">Gratuită</dd>
      </div>
      <div className="flex items-baseline justify-between border-t border-mist-2 pt-3">
        <dt className="font-medium text-ink">Total</dt>
        <dd className={`${totalClassName} font-medium tracking-[-0.02em] text-ink tabular-nums`}>{formatLei(pricing.totalMinor)}</dd>
      </div>
    </dl>
  )
}
