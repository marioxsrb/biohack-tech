'use client'

import { useEffect } from 'react'
import { cartStore } from '@/components/cart/cart-store'

/** Removes the lines that were just paid for. Lines in another currency stay in the cart. */
export function ClearPaidLines({ keys }: { keys: string[] }) {
  useEffect(() => {
    keys.forEach((k) => cartStore.remove(k))
    try {
      sessionStorage.removeItem('biohack-checkout-draft')
    } catch {}
  }, [keys])
  return null
}
