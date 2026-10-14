'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { cartStore, type CartLine } from '@/components/cart/cart-store'
import { trackFunnel } from '@/lib/analytics'

/** Puts the unfinished order's products back in the cart, then opens the checkout. */
export function RestoreCart({ lines }: { lines: CartLine[] }) {
  const router = useRouter()
  useEffect(() => {
    trackFunnel('RecoveryVisit', {})
    cartStore.restore(lines.map((l) => ({ ...l, source: l.source ?? 'recovery' })))
    router.replace('/checkout')
  }, [lines, router])
  return (
    <p className="mt-6 flex items-center gap-3 text-[15px] text-muted">
      <span aria-hidden className="spinner !border-ink/20 !border-t-ink" /> Pregătim coșul…
    </p>
  )
}
