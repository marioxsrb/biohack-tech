'use client'

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { resolveLine, variantLabel, type Product, type ProductId, type Variant } from '@/content/catalog'
import { totalsByCurrency, type Money } from '@/lib/money'
import { cartStore, lineKey } from './cart-store'

export type ResolvedLine = {
  key: string
  product: Product
  variant?: Variant
  variantLabel?: string
  quantity: number
  unit: Money
}

type CartUI = {
  isOpen: boolean
  open: () => void
  close: () => void
  /** Short message for the screen-reader live region. */
  announcement: string
  add: (productId: ProductId, variantId?: string, quantity?: number) => void
}

const CartUIContext = createContext<CartUI | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const open = useCallback(() => setOpen(true), [])
  const close = useCallback(() => setOpen(false), [])

  const add = useCallback((productId: ProductId, variantId?: string, quantity = 1) => {
    const resolved = resolveLine(productId, variantId)
    if (!resolved) return
    cartStore.add(productId, variantId, quantity)
    const label = resolved.variant ? `${resolved.product.name}, ${variantLabel(resolved.product, resolved.variant)}` : resolved.product.name
    setAnnouncement(`${label} a fost adăugat în coș.`)
    setOpen(true)
  }, [])

  const value = useMemo(() => ({ isOpen, open, close, announcement, add }), [isOpen, open, close, announcement, add])

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
        if (!r) return []
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
  const totals = useMemo(() => totalsByCurrency(lines), [lines])

  return {
    ...ui,
    lines,
    count,
    totals,
    setQuantity: cartStore.setQuantity,
    remove: cartStore.remove,
    clear: cartStore.clear,
  }
}
