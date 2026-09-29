/**
 * The one contract between a purchase button and the commerce flow. Every entry point hands off the
 * same thing: product id, variant id when the product has variants, quantity, and where the customer
 * started. Never a price: the cart reads prices from the catalog and the server prices the order again.
 *
 * The canonical state is the cart (`cart-store.ts`). A landing's "Comandă" writes its selection into
 * the cart first and then opens the checkout; the checkout link also carries the selection as
 * `?item=<productId>[:<variantId>][*<quantity>]`, so the same link works when opened directly
 * (new tab, shared link, full reload). Both paths end in the same cart lines.
 */
import { resolveLine, type ProductId } from '@/content/catalog'

export const MAX_QTY = 10

/**
 * The surface where a cart line was first added. Stored with the line (first touch wins) and sent
 * with the order as `attribution.entry`, so orders can later be told apart by where they started.
 */
export const ENTRY_SOURCES = ['home', 'catalog', 'product', 'landing', 'cart_offer', 'recovery', 'link'] as const
export type EntrySource = (typeof ENTRY_SOURCES)[number]
export const isEntrySource = (v: unknown): v is EntrySource => typeof v === 'string' && (ENTRY_SOURCES as readonly string[]).includes(v)

export const ENTRY_LABEL: Record<EntrySource, string> = {
  home: 'pagina principală',
  catalog: 'lista de produse',
  product: 'pagina produsului',
  landing: 'landing',
  cart_offer: 'oferta din coș',
  recovery: 'reluarea comenzii',
  link: 'link direct',
}

export type Selection = { productId: ProductId; variantId?: string; quantity: number; source?: EntrySource }

/** Which surface a path is, for lines added with the normal "Adaugă în coș". */
export function sourceForPath(pathname: string): EntrySource {
  if (pathname === '/' || pathname === '') return 'home'
  if (/^\/products\/?$/.test(pathname)) return 'catalog'
  if (/^\/products\/[^/]+/.test(pathname)) return 'product'
  if (/^\/lp\//.test(pathname)) return 'landing'
  if (/^\/(cart|checkout)\/?$/.test(pathname)) return 'cart_offer'
  return 'link'
}

const clampQty = (n: number) => Math.min(MAX_QTY, Math.max(1, Math.floor(n) || 1))

/** `brain-flow:4-zone`, `ochelari-biohack:cat-eye-negru*3`, `balance-wave`. */
export function encodeItem(s: { productId: string; variantId?: string; quantity?: number }): string {
  const q = clampQty(s.quantity ?? 1)
  return `${s.productId}${s.variantId ? `:${s.variantId}` : ''}${q > 1 ? `*${q}` : ''}`
}

/**
 * The `item` parameters of a checkout URL, as canonical selections. Unknown products, unknown or
 * missing variants (for products that have them) and unpriced items are dropped. Repeated items add up.
 */
export function parseItems(search: string | URLSearchParams, source: EntrySource = 'link'): Selection[] {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search
  const out = new Map<string, Selection>()
  for (const raw of params.getAll('item')) {
    const m = /^([\w-]{1,64})(?::([\w-]{1,64}))?(?:\*(\d{1,2}))?$/.exec(raw.trim())
    if (!m) continue
    const r = resolveLine(m[1], m[2])
    if (!r || r.unit === null) continue
    const key = `${r.product.id}:${r.variant?.id ?? ''}`
    const prev = out.get(key)
    out.set(key, { productId: r.product.id, variantId: r.variant?.id, quantity: clampQty((prev?.quantity ?? 0) + Number(m[3] ?? 1)), source })
  }
  return [...out.values()]
}
