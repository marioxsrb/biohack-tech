'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cartStore } from '@/components/cart/cart-store'
import { Check, Copy } from '@/components/ui/icons'
import { canTrack, track } from '@/lib/analytics'
import { DRAFT_KEY } from '@/lib/checkout'

type PurchaseItem = { item_id: string; item_name: string; item_variant?: string; price: number; quantity: number }

/**
 * Once an order is placed: take its lines out of the cart (once per order, so reopening an old order
 * page never empties a new cart), forget the form, report the purchase once (only with analytics or marketing consent).
 * A convenience only: payment state never depends on it, and it tolerates unavailable storage.
 */
export function OrderEffects({ orderNumber, clearKeys, purchase }: { orderNumber: string; clearKeys: string[]; purchase: { orderNumber: string; value: number; items: PurchaseItem[] } | null }) {
  useEffect(() => {
    if (!clearKeys.length) return
    const key = `bt-cart-cleared-${orderNumber}`
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
    } catch {}
    clearKeys.forEach((k) => cartStore.remove(k))
    try {
      sessionStorage.removeItem(DRAFT_KEY)
    } catch {}
  }, [orderNumber, clearKeys])

  useEffect(() => {
    // Without consent (or without tools) nothing is sent and nothing is written to the browser.
    if (!purchase || !canTrack()) return
    const key = `bt-purchase-${purchase.orderNumber}`
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
    } catch {}
    track('purchase', { value: purchase.value, items: purchase.items, transaction_id: purchase.orderNumber })
  }, [purchase])

  return null
}

/** Refreshes the page a few times while Stripe's confirmation arrives. */
export function WaitForPayment() {
  const router = useRouter()
  useEffect(() => {
    let n = 0
    const t = setInterval(() => {
      if (++n > 10) return clearInterval(t)
      router.refresh()
    }, 3000)
    return () => clearInterval(t)
  }, [router])
  return <p className="mt-6 flex items-center gap-3 text-[15px] text-muted"><span aria-hidden className="spinner !border-ink/20 !border-t-ink" /> Se verifică plata…</p>
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(false), 1800)
    return () => clearTimeout(t)
  }, [done])
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(value).then(() => setDone(true), () => {})}
      className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[14px] font-medium text-ink transition-colors hover:bg-mist max-sm:col-start-2 max-sm:row-start-2"
      aria-label={`Copiază ${label}`}
    >
      {done ? <Check className="h-4 w-4 text-cyan-700" /> : <Copy className="h-4 w-4" />}
      <span aria-live="polite">{done ? 'Copiat' : 'Copiază'}</span>
    </button>
  )
}
