import { getProduct, type ProductId } from '@/content/catalog'
import { formatLei } from '@/lib/money'

/**
 * The price of a product, as the customer sees it. Products without an approved price
 * in lei show "Preț în curând" (see config/prices.ts).
 */
export function Price({ productId, className = '', pendingClassName = 'text-muted' }: { productId: ProductId; className?: string; pendingClassName?: string }) {
  const p = getProduct(productId)!
  if (p.price === null) return <span className={`${pendingClassName} ${className}`}>Preț în curând</span>
  return <span className={`tabular-nums ${className}`}>{formatLei(p.price)}</span>
}
