/**
 * The NEUROS Amber 2+1 picker, without UI: the frames that exist (model × colour, from the catalog only),
 * and the cart lines a set of picked pairs becomes. Identical pairs become one line with that quantity;
 * different frames stay separate lines. Nothing here reads or writes the cart.
 */
import { getProduct, unitPrice, variantLabel, type ProductId } from '@/content/catalog'
import { priceLines } from './promotions'

export const AMBER_ID: ProductId = 'ochelari-biohack'

export type AmberModel = { id: string; label: string; colours: { id: string; label: string; swatch?: string; variantId: string }[] }

/** Models and, per model, only the colours that exist as a sold variant. */
export function amberModels(): AmberModel[] {
  const p = getProduct(AMBER_ID)!
  const model = p.options?.find((o) => o.id === 'model')?.values ?? []
  const colour = p.options?.find((o) => o.id === 'culoare')?.values ?? []
  return model
    .map((m) => ({
      id: m.id,
      label: m.label,
      colours: (p.variants ?? [])
        .filter((v) => v.options.model === m.id && unitPrice(p, v) !== null)
        .map((v) => {
          const c = colour.find((x) => x.id === v.options.culoare)
          return { id: v.options.culoare, label: c?.label ?? v.options.culoare, swatch: c?.swatch, variantId: v.id }
        }),
    }))
    .filter((m) => m.colours.length)
}

export const amberLabel = (variantId: string) => {
  const p = getProduct(AMBER_ID)!
  const v = p.variants?.find((x) => x.id === variantId)
  return v ? variantLabel(p, v) : variantId
}

/** Picked pairs (one variant id per slot) → cart lines, identical pairs merged. Null while a slot is empty. */
export function pairsToLines(picks: (string | null)[]): { productId: ProductId; variantId: string; quantity: number }[] | null {
  if (!picks.length || picks.some((v) => !v)) return null
  const valid = new Set((getProduct(AMBER_ID)!.variants ?? []).map((v) => v.id))
  if (picks.some((v) => !valid.has(v!))) return null
  const byId = new Map<string, number>()
  for (const v of picks as string[]) byId.set(v, (byId.get(v) ?? 0) + 1)
  return [...byId].map(([variantId, quantity]) => ({ productId: AMBER_ID, variantId, quantity }))
}

/**
 * Totals the customer will have for NEUROS Amber after adding these pairs to what is already in the
 * cart, from the promotion engine (the same one the cart, checkout and server use).
 */
export function amberTotals(existing: { variantId?: string; quantity: number }[], picks: (string | null)[]) {
  const p = getProduct(AMBER_ID)!
  const lines = [...existing, ...picks.filter((v): v is string => !!v).map((variantId) => ({ variantId, quantity: 1 }))]
  const priced = lines.map((l, i) => ({ key: `${l.variantId}:${i}`, productId: AMBER_ID as string, quantity: l.quantity, unitAmount: unitPrice(p, p.variants?.find((v) => v.id === l.variantId)) ?? p.price ?? 0 }))
  const r = priceLines(priced)
  return { subtotalMinor: r.subtotalMinor, discountMinor: r.discountMinor, totalMinor: r.totalMinor, units: lines.reduce((n, l) => n + l.quantity, 0) }
}
