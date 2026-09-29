/**
 * Cart persistence. Only ids and quantities are stored; names, images and prices
 * are always read from the catalog, so a stored cart can never carry a stale price.
 * Whatever comes back from storage is validated: unknown products, unknown variants,
 * products without an approved price, bad quantities and duplicates are dropped or fixed.
 */
import { resolveLine, type ProductId } from '@/content/catalog'
import { MAX_QTY, isEntrySource, type EntrySource } from '@/lib/purchase'

/** `source`: where the line was first added (first touch wins); see `lib/purchase.ts`. */
export type CartLine = { productId: ProductId; variantId?: string; quantity: number; source?: EntrySource }

export { MAX_QTY }
const KEY = 'biohack-cart-v1'
const EMPTY: CartLine[] = []

let lines: CartLine[] = EMPTY
let loaded = false
const listeners = new Set<() => void>()

export const lineKey = (l: Pick<CartLine, 'productId' | 'variantId'>) => `${l.productId}:${l.variantId ?? ''}`

export function sanitize(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return EMPTY
  const byKey = new Map<string, CartLine>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const { productId, variantId, quantity, source } = item as Record<string, unknown>
    if (typeof productId !== 'string') continue
    const v = typeof variantId === 'string' ? variantId : undefined
    const r = resolveLine(productId, v)
    if (!r || r.unit === null) continue
    const q = Math.min(MAX_QTY, Math.max(1, Math.floor(Number(quantity) || 1)))
    const key = lineKey({ productId: r.product.id, variantId: v })
    const prev = byKey.get(key)
    const src = prev?.source ?? (isEntrySource(source) ? source : undefined)
    byKey.set(key, { productId: r.product.id, variantId: v, quantity: Math.min(MAX_QTY, (prev?.quantity ?? 0) + q), ...(src && { source: src }) })
  }
  return [...byKey.values()]
}

function read(): CartLine[] {
  try {
    return sanitize(JSON.parse(window.localStorage.getItem(KEY) ?? '[]'))
  } catch {
    return EMPTY
  }
}

function commit(next: CartLine[]) {
  lines = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Private mode or storage full: the cart still works for this page view.
  }
  listeners.forEach((l) => l())
}

function onStorage(e: StorageEvent) {
  if (e.key !== KEY) return
  lines = read()
  listeners.forEach((l) => l())
}

export const cartStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    if (listeners.size === 1) window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) window.removeEventListener('storage', onStorage)
    }
  },
  getSnapshot(): CartLine[] {
    if (!loaded) {
      loaded = true
      lines = read()
    }
    return lines
  },
  getServerSnapshot(): CartLine[] {
    return EMPTY
  },
  add(productId: ProductId, variantId: string | undefined, quantity = 1, source?: EntrySource) {
    const r = resolveLine(productId, variantId)
    if (!r || r.unit === null) return
    const key = lineKey({ productId, variantId })
    const current = cartStore.getSnapshot()
    const existing = current.find((l) => lineKey(l) === key)
    commit(
      existing
        ? current.map((l) => (l === existing ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + quantity) } : l))
        : [...current, { productId, variantId, quantity: Math.min(MAX_QTY, quantity), ...(source && { source }) }],
    )
  },
  setQuantity(key: string, quantity: number) {
    const q = Math.min(MAX_QTY, Math.max(1, Math.floor(quantity)))
    commit(cartStore.getSnapshot().map((l) => (lineKey(l) === key ? { ...l, quantity: q } : l)))
  },
  remove(key: string) {
    commit(cartStore.getSnapshot().filter((l) => lineKey(l) !== key))
  },
  clear() {
    commit(EMPTY)
  },
  /**
   * A selection built on a landing (e.g. several NEUROS Amber frames): each of these lines gets exactly
   * the chosen quantity; lines not in the selection are kept. Repeating it changes nothing.
   */
  put(selected: CartLine[]) {
    const next = [...cartStore.getSnapshot()]
    for (const l of sanitize(selected)) {
      const i = next.findIndex((x) => lineKey(x) === lineKey(l))
      if (i === -1) next.push(l)
      else next[i] = { ...next[i], quantity: l.quantity }
    }
    commit(next)
  },
  /**
   * Makes sure these lines are in the cart without doubling what is already there: a line that exists
   * keeps the larger quantity and its first source. Used by the landing handoff, the checkout's
   * `?item=` links and checkout recovery.
   */
  restore(restored: CartLine[]) {
    const current = cartStore.getSnapshot()
    const next = [...current]
    for (const l of sanitize(restored)) {
      const i = next.findIndex((x) => lineKey(x) === lineKey(l))
      if (i === -1) next.push(l)
      else next[i] = { ...next[i], quantity: Math.max(next[i].quantity, l.quantity) }
    }
    commit(next)
  },
}
