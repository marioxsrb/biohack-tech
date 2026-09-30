'use client'

import { Arrow } from '@/components/ui/icons'
import type { ProductId } from '@/content/catalog'
import { promotionFor } from '@/lib/promotions'
import { useOfferSheets } from './OfferSheets'

/**
 * The product's promotion, right under the price and the trust row: a quiet highlighted panel, one
 * headline, one sentence, one action that opens the offer's picker in place (no page change).
 */
export function ProductOffer({ productId, className = '' }: { productId: ProductId; className?: string }) {
  const { openAmber, openBundle } = useOfferSheets()
  const p = promotionFor(productId)
  if (!p) return null
  const amber = p.kind === 'buy_x_get_y'
  return (
    <div className={`rounded-[16px] bg-cyan-50 px-4 py-3.5 shadow-[inset_0_0_0_1px_var(--color-cyan-100)] ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="text-[16px] leading-snug font-semibold text-ink">
            <span className="mr-2 inline-flex rounded-full bg-cyan-700 px-2 py-0.5 align-[1px] text-[12.5px] font-semibold text-white">{p.badge}</span>
            {amber ? 'Alege 3 perechi. Plătești 2.' : 'Alege 3 produse. Primești 20%.'}
          </p>
          <p className="mt-1 text-[14.5px] leading-snug text-text">{p.line}</p>
        </div>
        <button type="button" onClick={() => (amber ? openAmber('product_page', 3) : openBundle('product_page'))} className="btn-secondary sm flex-none !bg-paper">
          {amber ? 'Alege 3 perechi' : 'Alege 3 produse'} <Arrow />
        </button>
      </div>
    </div>
  )
}
