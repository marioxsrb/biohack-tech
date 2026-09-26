'use client'

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { isPurchasable, resolveLine, variantLabel, type Product, type ProductId, type Variant } from '@/content/catalog'
import { orderTotal } from '@/lib/money'
import { cartStore, lineKey } from './cart-store'

export type ResolvedLine = {
  key: string
  product: Product
  variant?: Variant
  variantLabel?: string
  quantity: number
  /** Unit price in bani, read from the catalog. */
  unit: number
}

/** What was just added: shown in the compact confirmation, not in the full cart. */
export type Confirmation = { key: string; quantity: number; at: number }

type CartUI = {
  confirmation: Confirmation | null
  dismissConfirmation: () => void
  /** Short message for the screen-reader live region. */
  announcement: string
  add: (productId: ProductId, variantId?: string, quantity?: number) => boolean
}

const CartUIContext = createContext<CartUI | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [announcement, setAnnouncement] = useState('')
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)

  const dismissConfirmation = useCallback(() => setConfirmation(null), [])

  const add = useCallback((productId: ProductId, variantId?: string, quantity = 1) => {
    const resolved = resolveLine(productId, variantId)
    if (!resolved || !isPurchasable(resolved.product)) return false
    cartStore.add(productId, variantId, quantity)
    setConfirmation({ key: lineKey({ productId, variantId }), quantity, at: Date.now() })
    const label = resolved.variant ? `${resolved.product.name}, ${variantLabel(resolved.product, resolved.variant)}` : resolved.product.name
    setAnnouncement(`${label} a fost adăugat în coș.`)
    return true
  }, [])

  const value = useMemo(
    () => ({ confirmation, dismissConfirmation, announcement, add }),
    [confirmation, dismissConfirmation, announcement, add],
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
        if (!r || !isPurchasable(r.product)) return []
        return [
          {
            key: lineKey(l),
            product: r.product,
            variant: r.variant,
            variantLabel: r.variant ? variantLabel(r.product, r.variant) : undefined,
            quantity: l.quantity,
            unit: r.product.price,
          },
        ]
      }),
    [stored],
  )

  const count = lines.reduce((n, l) => n + l.quantity, 0)
  const total = orderTotal(lines)

  return {
    ...ui,
    lines,
    count,
    total,
    setQuantity: cartStore.setQuantity,
    remove: cartStore.remove,
    clear: cartStore.clear,
  }
}
