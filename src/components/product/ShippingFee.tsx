'use client'

import { BOOK_SHIPPING_RON } from '@/config/prices'
import { useMoney } from '@/i18n/currency'

/** The book's delivery fee in the visitor's currency; a price like any other. */
export function ShippingFee({ className = '' }: { className?: string }) {
  const { unit, fmt } = useMoney()
  return (
    <span className={`tabular-nums ${className}`}>
      {fmt(unit(BOOK_SHIPPING_RON))}
    </span>
  )
}
