'use client'

import { BundleOffer } from '@/components/product/BuyBox'
import { promotionFor } from '@/lib/promotions'
import { useOfferSheets } from '@/components/offers/OfferSheets'
import type { UiPlacement } from '@/lib/analytics'
import { useCart, type ResolvedLine } from './CartProvider'
import { BULK_OFFER } from '@/config/promotions'
import { bulkUnits } from '@/lib/promotions'
import { maxQtyFor } from '@/lib/purchase'

/**
 * The product page's "Cumperi mai multe, plătești mai puțin" choices for a line already in the cart (the
 * add-to-cart confirmation, the checkout): picking 2 or 3 sets the quantity right there. A promotion counts every
 * unit of the product (Amber: every frame), so it sits on the product's last line and changes that line.
 */
export function LineBundle({ line, className = '', placement = 'cart' }: { line: ResolvedLine; className?: string; placement?: UiPlacement }) {
  const { lines, setQuantity } = useCart()
  const { openAmber } = useOfferSheets()
  if (!promotionFor(line.product.id)) return null
  // With the business offer (25+ Calm/Focus units), Calm and Focus already have 40%: the 10%/20% picker would mislead.
  const eligible = (BULK_OFFER.products as string[]).includes(line.product.id)
  if (eligible && bulkUnits(lines.map((l) => ({ productId: l.product.id, quantity: l.quantity }))) >= BULK_OFFER.minUnits) return null
  const same = lines.filter((l) => l.product.id === line.product.id)
  if (same[same.length - 1]?.key !== line.key) return null
  const total = same.reduce((n, l) => n + l.quantity, 0)
  return (
    <BundleOffer
      compact
      productId={line.product.id}
      variantId={line.variant?.id}
      quantity={total}
      onQuantity={(n) => setQuantity(line.key, Math.min(maxQtyFor(line.product.id), Math.max(1, line.quantity + n - total)))}
      // Amber 2+1: the configurator picks the missing pairs, in any frames.
      onAmberGroup={(n) => (n > total ? openAmber(placement, Math.min(3, n - total)) : setQuantity(line.key, Math.max(1, line.quantity + n - total)))}
      className={className}
    />
  )
}
