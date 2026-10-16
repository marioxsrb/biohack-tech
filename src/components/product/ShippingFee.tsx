'use client'

import { BOOK_SHIPPING_RON } from '@/config/prices'
import { useMoney } from '@/i18n/currency'

/** The book's delivery fee in the visitor's currency; a price like any other (hidden on acces.<domain> before the form). */
export function ShippingFee({ className = '' }: { className?: string }) {
  const { unit, fmt } = useMoney()
  return (
    <span data-price className={`tabular-nums ${className}`}>
      {fmt(unit(BOOK_SHIPPING_RON))}
    </span>
  )
}
