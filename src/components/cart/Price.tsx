'use client'

import { getProduct, getVariant, unitPrice, type ProductId } from '@/content/catalog'
import { useUi } from '@/i18n/LocaleProvider'
import { formatLei } from '@/lib/money'

/**
 * The price of a product, as the customer sees it. Products without an approved price
 * in lei show "Preț în curând" (see config/prices.ts). A client component only to read the language.
 * When configurations cost differently,
 * a chosen variant shows its own price; without one, "de la" the lowest.
 */
export function Price({
  productId,
  variantId,
  className = '',
  pendingClassName = 'text-muted',
}: {
  productId: ProductId
  variantId?: string
  className?: string
  pendingClassName?: string
}) {
  const ui = useUi()
  const p = getProduct(productId)!
  const variant = getVariant(p, variantId)
  const amount = variant ? unitPrice(p, variant) : p.price
  if (amount === null) return <span className={`${pendingClassName} ${className}`}>{ui.pricePending}</span>
  return (
    <span className={`tabular-nums ${className}`}>
      {p.variablePrice && !variant && ui.from}
      {formatLei(amount)}
    </span>
  )
}
