'use client'

import { BundleOffer } from '@/components/product/BuyBox'
import { promotionFor } from '@/lib/promotions'
import { useOfferSheets } from '@/components/offers/OfferSheets'
import type { UiPlacement } from '@/lib/analytics'
import { useCart, type ResolvedLine } from './CartProvider'
import { MAX_QTY } from './cart-store'

/**
 * The product page's "Cumperi mai multe, plătești mai puțin" choices for a line already in the cart (the
 * add-to-cart confirmation, the checkout): picking 2 or 3 sets the quantity right there. A promotion counts every
 * unit of the product (Amber: every frame), so it sits on the product's last line and changes that line.
 */
export function LineBundle({ line, className = '', placement = 'cart' }: { line: ResolvedLine; className?: string; placement?: UiPlacement }) {
  const { lines, setQuantity } = useCart()
  const { openAmber } = useOfferSheets()
  if (!promotionFor(line.product.id)) return null
  const same = lines.filter((l) => l.product.id === line.product.id)
  if (same[same.length - 1]?.key !== line.key) return null
  const total = same.reduce((n, l) => n + l.quantity, 0)
  return (
    <BundleOffer
      compact
      productId={line.product.id}
      variantId={line.variant?.id}
      quantity={total}
      onQuantity={(n) => setQuantity(line.key, Math.min(MAX_QTY, Math.max(1, line.quantity + n - total)))}
      // Amber 2+1: the configurator picks the missing pairs, in any frames.
      onAmberGroup={(n) => (n > total ? openAmber(placement, Math.min(3, n - total)) : setQuantity(line.key, Math.max(1, line.quantity + n - total)))}
      className={className}
    />
  )
}
