import { promotionFor } from '@/lib/promotions'

/**
 * The promotion a product takes part in, as quiet text beside its price: never over the photograph,
 * never a countdown. `full` adds the one-sentence explanation.
 */
export function PromoNote({ productId, full = false, className = '' }: { productId: string; full?: boolean; className?: string }) {
  const p = promotionFor(productId)
  if (!p) return null
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${className}`}>
      <span className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-[13px] font-semibold tracking-[0.01em] whitespace-nowrap text-cyan-700">{p.badge}</span>
      {full && <span className="text-[14.5px] leading-snug text-text">{p.line}</span>}
    </span>
  )
}
