'use client'

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { resolveLine, variantLabel, type Product, type ProductId, type Variant } from '@/content/catalog'
import { priceLines, promotionHints, promotionProgress } from '@/lib/promotions'
import { sourceForPath, type EntrySource } from '@/lib/purchase'
import { cartStore, lineKey } from './cart-store'

export type ResolvedLine = {
  key: string
  product: Product
  variant?: Variant
  variantLabel?: string
  quantity: number
  /** Unit price in bani, read from the catalog. */
  unit: number
  /** Where the line was first added. */
  source?: EntrySource
}

/** What was just added: shown in the compact confirmation, not in the full cart. */
export type Confirmation = { key: string; quantity: number; at: number }

type CartUI = {
  confirmation: Confirmation | null
  dismissConfirmation: () => void
  /** Short message for the screen-reader live region. */
  announcement: string
  add: (productId: ProductId, variantId?: string, quantity?: number, source?: EntrySource) => boolean
  /** Several lines at once (all or nothing), e.g. the three NEUROS Amber pairs. */
  addMany: (picks: { productId: ProductId; variantId?: string; quantity?: number }[], source?: EntrySource) => boolean
}

const CartUIContext = createContext<CartUI | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [announcement, setAnnouncement] = useState('')
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)

  const dismissConfirmation = useCallback(() => setConfirmation(null), [])

  const add = useCallback((productId: ProductId, variantId?: string, quantity = 1, source?: EntrySource) => {
    const resolved = resolveLine(productId, variantId)
    if (!resolved || resolved.unit === null) return false
    cartStore.add(productId, variantId, quantity, source ?? sourceForPath(window.location.pathname))
    setConfirmation({ key: lineKey({ productId, variantId }), quantity, at: Date.now() })
    const label = resolved.variant ? `${resolved.product.name}, ${variantLabel(resolved.product, resolved.variant)}` : resolved.product.name
    setAnnouncement(`${label} a fost adăugat în coș.`)
    return true
  }, [])

  const addMany = useCallback((picks: { productId: ProductId; variantId?: string; quantity?: number }[], source?: EntrySource) => {
    if (!cartStore.addMany(picks, source ?? sourceForPath(window.location.pathname))) return false
    const n = picks.reduce((s, p) => s + (p.quantity ?? 1), 0)
    setAnnouncement(`${n === 1 ? 'O pereche a fost adăugată' : `${n} perechi au fost adăugate`} în coș.`)
    return true
  }, [])

  const value = useMemo(
    () => ({ confirmation, dismissConfirmation, announcement, add, addMany }),
    [confirmation, dismissConfirmation, announcement, add, addMany],
  )

  return (
    <CartUIContext.Provider value={value}>
      {children}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </CartUIContext.Provider>
  )
}

export function useCart() {
  const ui = useContext(CartUIContext)
  if (!ui) throw new Error('useCart must be used inside <CartProvider>')

  const stored = useSyncExternalStore(cartStore.subscribe, cartStore.getSnapshot, cartStore.getServerSnapshot)

  const lines = useMemo<ResolvedLine[]>(
    () =>
      stored.flatMap((l) => {
        const r = resolveLine(l.productId, l.variantId)
        if (!r || r.unit === null) return []
        return [
          {
            key: lineKey(l),
            product: r.product,
            variant: r.variant,
            variantLabel: r.variant ? variantLabel(r.product, r.variant) : undefined,
            quantity: l.quantity,
            unit: r.unit,
            source: l.source,
          },
        ]
      }),
    [stored],
  )

  const count = lines.reduce((n, l) => n + l.quantity, 0)
  // Same engine as the server, for display only: the server prices the order again when it is placed.
  const pricing = useMemo(() => priceLines(lines.map((l) => ({ key: l.key, productId: l.product.id, quantity: l.quantity, unitAmount: l.unit }))), [lines])
  const hints = useMemo(() => promotionHints(lines.map((l) => ({ productId: l.product.id, quantity: l.quantity }))), [lines])
  const progress = useMemo(() => promotionProgress(lines.map((l) => ({ key: l.key, productId: l.product.id, quantity: l.quantity, unitAmount: l.unit }))), [lines])

  return {
    ...ui,
    lines,
    count,
    /** Total to pay (after promotions; shipping is free). */
    total: pricing.totalMinor,
    pricing,
    hints,
    progress,
    setQuantity: cartStore.setQuantity,
    remove: cartStore.remove,
    clear: cartStore.clear,
  }
}
