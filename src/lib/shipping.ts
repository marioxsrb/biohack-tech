/**
 * Delivery cost, one rule for the cart, the checkout, the server's order total and everything that reads it
 * (Stripe, transfer, cash on delivery, FGO, GoHighLevel, emails, admin, the iOS app):
 *   - an order without the book: free;
 *   - an order with the book: BOOK_SHIPPING_RON (10 lei + VAT), ONCE per order, whatever the quantities or the
 *     other products in it.
 * Shipping is never part of a promotion or a promo code: it is added after them (total = subtotal − discount +
 * shipping). In euro or dollars it is converted like a price (lib/currency: BNR rate, whole units). Pure, shared.
 */
import { BOOK_SHIPPING_RON } from '@/config/prices'
import { isBook } from '@/content/catalog'
import { convertUnit, type Currency, type Rates } from './currency'

/** Whether these lines make the order pay for delivery. */
export const paysShipping = (lines: { productId: string; quantity?: number }[]) => lines.some((l) => isBook(l.productId) && (l.quantity ?? 1) > 0)

/** The order's delivery cost in its currency's minor units (0 = free). */
export function shippingFor(lines: { productId: string; quantity?: number }[], currency: Currency = 'RON', r?: Rates): number {
  return paysShipping(lines) ? convertUnit(BOOK_SHIPPING_RON, currency, r) : 0
}
