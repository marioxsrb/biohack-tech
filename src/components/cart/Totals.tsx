import { Check } from '@/components/ui/icons'
import type { AppliedPromotion, Pricing, PromotionHint } from '@/lib/promotions'
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

/**
 * The offers, where the customer decides: applied ones with a check and what they save, then what the
 * cart can still unlock. Informational, never urgent.
 */
export function PromotionHints({ hints, applied = [], className = '' }: { hints: PromotionHint[]; applied?: AppliedPromotion[]; className?: string }) {
  if (!hints.length && !applied.length) return null
  return (
    <ul className={`space-y-2 ${className}`} aria-live="polite">
      {applied.map((a) => (
        <li key={a.id} className="flex items-start gap-2.5 rounded-[12px] bg-cyan-700 px-4 py-3 text-[14.5px] leading-snug text-white">
          <Check className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
          <span>
            Ofertă aplicată: <strong className="font-semibold !text-white">{a.label}</strong>. Economisești {formatLei(a.amountMinor)}.
          </span>
        </li>
      ))}
      {hints.map((h) => (
        <li key={h.id} className="rounded-[12px] bg-cyan-50 px-4 py-3 text-[14.5px] leading-snug text-cyan-700">
          {h.text}
        </li>
      ))}
    </ul>
  )
}
