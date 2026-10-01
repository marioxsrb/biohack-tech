'use client'

import { useEffect, useState } from 'react'
import { useCart } from '@/components/cart/CartProvider'
import { Arrow, Check } from '@/components/ui/icons'
import { getProduct, unitPrice, type ProductId } from '@/content/catalog'
import { formatLei } from '@/lib/money'
import { priceLines, promotionFor } from '@/lib/promotions'
import { useOfferSheets } from './OfferSheets'

/**
 * The product's promotion, right under the price and the trust row, in a quiet highlighted panel.
 *   NEUROS Calm, Focus, Flow: one card per tier (2 → 10%, 3 → 20%) for THIS product (and the chosen
 *     configuration); a click adds that many units straight to the cart, no picker.
 *   NEUROS Amber 2+1: one action that opens the pair picker in place.
 */
export function ProductOffer({ productId, variantId, className = '' }: { productId: ProductId; variantId?: string; className?: string }) {
  const { openAmber } = useOfferSheets()
  const p = promotionFor(productId)
  if (!p) return null
  if (p.kind === 'bundle_percent') return <TierCards productId={productId} variantId={variantId} tiers={p.tiers} className={className} />
  return (
    <div className={`rounded-[16px] bg-cyan-50 px-4 py-3.5 shadow-[inset_0_0_0_1px_var(--color-cyan-100)] ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="text-[16px] leading-snug font-semibold text-ink">
            <span className="mr-2 inline-flex rounded-full bg-cyan-700 px-2 py-0.5 align-[1px] text-[12.5px] font-semibold text-white">{p.badge}</span>
            Alege 3 perechi. Plătești 2.
          </p>
          <p className="mt-1 text-[14.5px] leading-snug text-text">{p.line}</p>
        </div>
        <button type="button" onClick={() => openAmber('product_page', 3)} className="btn-secondary sm flex-none !bg-paper">
          Alege 3 perechi <Arrow />
        </button>
      </div>
    </div>
  )
}

type Tier = { minUnits: number; percent: number }

function TierCards({ productId, variantId, tiers, className }: { productId: ProductId; variantId?: string; tiers: Tier[]; className: string }) {
  const { add } = useCart()
  const [added, setAdded] = useState<number | null>(null)
  const product = getProduct(productId)!
  const unit = unitPrice(product, product.variants?.find((v) => v.id === variantId))

  useEffect(() => {
    if (added === null) return
    const t = setTimeout(() => setAdded(null), 2000)
    return () => clearTimeout(t)
  }, [added])

  if (unit === null) return null
  // Same engine as the cart and the server, on this product alone.
  const priced = (n: number) => priceLines([{ key: 'x', productId, quantity: n, unitAmount: unit }])

  return (
    <div className={`rounded-[16px] bg-cyan-50 p-3 shadow-[inset_0_0_0_1px_var(--color-cyan-100)] ${className}`}>
      <p className="px-1 text-[15px] leading-snug font-semibold text-ink">Cumpără mai multe, plătești mai puțin.</p>
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        {tiers.map((t) => {
          const r = priced(t.minUnits)
          const done = added === t.minUnits
          return (
            <button
              key={t.minUnits}
              type="button"
              onClick={() => add(productId, variantId, t.minUnits) && setAdded(t.minUnits)}
              aria-label={`Adaugă ${t.minUnits} bucăți ${product.name} în coș, ${t.percent}% reducere, total ${formatLei(r.totalMinor)}`}
              className="group flex min-w-0 flex-col items-start rounded-[12px] bg-paper p-3 text-left shadow-[inset_0_0_0_1px_var(--color-line)] transition-shadow duration-150 hover:shadow-[inset_0_0_0_1.5px_var(--color-ink)] sm:p-3.5"
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-[15px] font-semibold text-ink">{t.minUnits} bucăți</span>
                <span className="rounded-full bg-cyan-700 px-2 py-0.5 text-[12.5px] font-semibold text-white">−{t.percent}%</span>
              </span>
              <span className="mt-1.5 text-[19px] font-medium tracking-[-0.02em] text-ink tabular-nums">{formatLei(r.totalMinor)}</span>
              <span className="text-[13px] text-muted">Economisești {formatLei(r.discountMinor)}</span>
              <span className={`mt-auto flex items-center gap-1.5 pt-2.5 text-[14px] font-semibold ${done ? 'text-cyan-700' : 'text-ink'}`} aria-live="polite">
                {done ? (
                  <>
                    <Check className="h-4 w-4 flex-none" aria-hidden /> Adăugat în coș
                  </>
                ) : (
                  <>
                    Adaugă în coș <Arrow className="h-4 w-4 flex-none transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
                  </>
                )}
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-2 px-1 text-[13px] leading-snug text-muted">Poți combina și cu NEUROS Calm, Focus sau Flow. Reducerea apare în coș.</p>
    </div>
  )
}
