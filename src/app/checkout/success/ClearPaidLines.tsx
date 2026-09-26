'use client'

import { useEffect } from 'react'
import { cartStore } from '@/components/cart/cart-store'
import { DRAFT_KEY } from '@/lib/checkout'

/** Removes the lines that were just paid for, and the form draft. */
export function ClearPaidLines({ keys }: { keys: string[] }) {
  useEffect(() => {
    keys.forEach((k) => cartStore.remove(k))
    try {
      sessionStorage.removeItem(DRAFT_KEY)
    } catch {}
  }, [keys])
  return null
}
