'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cartStore } from '@/components/cart/cart-store'
import { Check, Copy } from '@/components/ui/icons'
import { track, trackFunnel } from '@/lib/analytics'
import { consentStore } from '@/lib/consent/store'
import { isConfigured } from '@/lib/consent/vendors'
import { DRAFT_KEY } from '@/lib/checkout'
import { purchaseChannels } from '@/lib/meta'

type PurchaseItem = { item_id: string; item_name: string; item_variant?: string; price: number; quantity: number }

/**
 * Once an order is placed: take its lines out of the cart (once per order, so reopening an old order
 * page never empties a new cart), forget the form, report the purchase once. Meta Purchase waits for a confirmed
 * payment and for marketing consent: accepting the cookie banner on this page still sends it.
 * A convenience only: payment state never depends on it, and it tolerates unavailable storage.
 */
export function OrderEffects({
  orderNumber,
  clearKeys,
  purchase,
  placed,
  funnel,
}: {
  orderNumber: string
  clearKeys: string[]
  /**
   * A sale the ad platforms can count. `paid` is a confirmed payment: only then does Meta get Purchase
   * (cash on delivery and an unpaid transfer stay the custom event OrderPlaced until the money arrives).
   */
  purchase: { orderNumber: string; value: number; items: PurchaseItem[]; paid: boolean } | null
  /** Cash on delivery or a transfer not yet received: an order, not a payment (Meta custom event OrderPlaced). */
  placed?: { orderNumber: string; value: number; payment: 'cod' | 'transfer' } | null
  funnel?: 'visible_price' | 'gated_price'
}) {
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
    if (!purchase) return
    const read = (key: string) => {
      try {
        return !!localStorage.getItem(key)
      } catch {
        return false
      }
    }
    const write = (key: string) => {
      try {
        localStorage.setItem(key, '1')
      } catch {}
    }
    // Runs again when the visitor accepts marketing on this page. Until then nothing is marked as sent,
    // so the banner cannot drop the Purchase for good. Analytics and Meta are marked separately.
    const report = () => {
      const id = purchase.orderNumber
      const channels = purchaseChannels({
        paid: purchase.paid,
        legacy: read(`bt-purchase-${id}`),
        gaSent: read(`bt-ga-purchase-${id}`),
        metaSent: read(`bt-meta-purchase-${id}`),
        analytics: consentStore.allows('analytics'),
        marketing: consentStore.allows('marketing'),
        ga4: isConfigured('ga4'),
        meta: isConfigured('meta'),
      })
      if (!channels.ga4 && !channels.meta) return
      if (channels.ga4) write(`bt-ga-purchase-${id}`)
      if (channels.meta) write(`bt-meta-purchase-${id}`)
      track('purchase', { value: purchase.value, items: purchase.items, transaction_id: id }, channels)
    }
    report()
    return consentStore.subscribe(report)
  }, [purchase])

  useEffect(() => {
    if (!placed) return
    const report = () => {
      if (!consentStore.allows('marketing') || !isConfigured('meta')) return
      const key = `bt-placed-${placed.orderNumber}`
      try {
        if (localStorage.getItem(key)) return
        localStorage.setItem(key, '1')
      } catch {}
      trackFunnel('OrderPlaced', { value: placed.value, payment: placed.payment, funnel }, `placed-${placed.orderNumber}`)
    }
    report()
    return consentStore.subscribe(report)
  }, [placed, funnel])

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
