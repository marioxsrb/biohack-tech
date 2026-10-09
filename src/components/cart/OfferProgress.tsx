'use client'

import { Check } from '@/components/ui/icons'
import { getProduct, unitPrice, type ProductId } from '@/content/catalog'
import { formatLei } from '@/lib/money'
import { useLocale } from '@/i18n/LocaleProvider'
import { amberCopy, bundleCopy } from '@/lib/offer-copy'
import { priceLines, type PromotionProgress } from '@/lib/promotions'
import type { ResolvedLine } from './CartProvider'

/**
 * Where the cart stands for each offer (cart and checkout summaries). Earned offers are stated calmly
 * with the saving; the next step is prominent only when it is one unit away, otherwise a quiet line.
 * All amounts come from the promotion engine. The ways to act live in the suggestions below the button.
 */
export function OfferProgress({ progress, lines, compact = false, className = '' }: { progress: PromotionProgress[]; lines: ResolvedLine[]; compact?: boolean; actions?: boolean; className?: string }) {
  const locale = useLocale()
  if (!progress.length) return null
  return (
    <div className={`space-y-2.5 ${className}`} aria-live="polite">
      {progress.map((p) => {
        const amber = p.kind === 'buy_x_get_y'
        const c = amber ? amberCopy(p, locale) : bundleCopy(p, locale)
        const oneAway = c.tone === 'progress' ? p.untilNext === 1 : !!c.nudge
        const gain = oneAway ? nextGain(p, lines) : 0
        return (
          <div key={p.id} className="space-y-2.5">
            {c.tone === 'active' && (
              <div className={`flex items-start gap-3 rounded-[16px] bg-cyan-700 text-white ${compact ? 'px-4 py-3' : 'px-5 py-4'}`}>
                <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-white/20">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="leading-snug">
                  <span className="block text-[15px] font-semibold text-white">{c.headline}</span>
                  <span className={`block font-medium tracking-[-0.015em] text-white ${compact ? 'text-[19px]' : 'text-[22px]'}`}>{c.detail}</span>
                </span>
              </div>
            )}

            {oneAway && (
              <div className={`rounded-[16px] bg-cyan-50 shadow-[inset_0_0_0_1.5px_var(--color-cyan-700)] ${compact ? 'px-4 py-3' : 'p-5'}`}>
                <p className={`leading-snug font-semibold tracking-[-0.02em] text-cyan-700 ${compact ? 'text-[17px]' : 'text-[20px]'}`}>{c.nudge ?? c.headline}</p>
                {gain > 0 && <p className="mt-1 text-[14px] text-text">{amber ? (locale === 'en' ? `Your free pair: ${formatLei(gain)}.` : `Perechea gratuită: ${formatLei(gain)}.`) : locale === 'en' ? `You save at least ${formatLei(gain)}.` : `Economisești cel puțin ${formatLei(gain)}.`}</p>}
              </div>
            )}

            {!oneAway && (c.quiet || c.tone === 'progress') && <p className="px-1 text-[14px] leading-snug text-muted">{c.quiet ?? c.headline}</p>}
          </div>
        )
      })}
    </div>
  )
}

/** What one more unit would save, from the engine (for the quantity discount: one more of that product; for NEUROS Flow the cheapest configuration, hence "cel puțin"). */
function nextGain(p: PromotionProgress, lines: ResolvedLine[]): number {
  const base = lines.map((l) => ({ key: l.key, productId: l.product.id, quantity: l.quantity, unitAmount: l.unit }))
  const amountFor = (ls: typeof base) => priceLines(ls).promotions.find((a) => a.id === p.id)?.amountMinor ?? 0
  const now = amountFor(base)
  const candidates = p.products.flatMap((id) => {
    const product = getProduct(id)!
    if (p.kind === 'buy_x_get_y') {
      const last = [...lines].reverse().find((l) => l.product.id === id)
      return last ? [{ productId: id as ProductId, unit: last.unit, key: last.key }] : []
    }
    return (product.variants?.length ? product.variants : [undefined]).flatMap((v) => {
      const unit = unitPrice(product, v)
      return unit === null ? [] : [{ productId: id as ProductId, unit, key: `${id}:${v?.id ?? ''}` }]
    })
  })
  const gains = candidates
    .map((c) => {
      const i = base.findIndex((b) => b.key === c.key)
      const next = i === -1 ? [...base, { key: c.key, productId: c.productId, quantity: 1, unitAmount: c.unit }] : base.map((b, j) => (j === i ? { ...b, quantity: b.quantity + 1 } : b))
      return amountFor(next) - now
    })
    .filter((g) => g > 0)
  return gains.length ? Math.min(...gains) : 0
}
