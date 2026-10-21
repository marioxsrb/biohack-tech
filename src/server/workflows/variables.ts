/**
 * The values of the approved emails' variables ({{cart_items}}, {{voucher_amount}}, {{product_name}}...), pure, from
 * the store's own data. Only data: no sentence is written here (the copy is Email Studio's). Where a value would need
 * new wording (the guides, the support text for the whole range), it is left to the approved content and flagged.
 */
import { catalogProduct as getProduct, variantLabel } from '@/content/catalog'
import { VOUCHER_VALUE, isVoucherProduct } from '@/config/vouchers'

export type CartLine = { productId: string; variantId?: string | null; quantity: number }

const nameOf = (id: string) => getProduct(id)?.name ?? id

/** {{cart_items}}: every product with its quantity; identical products (same frame) on one row. */
export function cartItems(lines: CartLine[]): string[] {
  const rows = new Map<string, { productId: string; variantId?: string | null; quantity: number }>()
  for (const l of lines) {
    const key = `${l.productId}:${l.variantId ?? ''}`
    const row = rows.get(key) ?? { productId: l.productId, variantId: l.variantId, quantity: 0 }
    row.quantity += l.quantity
    rows.set(key, row)
  }
  return [...rows.values()].map((r) => {
    const p = getProduct(r.productId)
    const v = r.variantId ? p?.variants?.find((x) => x.id === r.variantId) : undefined
    const name = v && p ? `${p.name} (${variantLabel(p, v)})` : nameOf(r.productId)
    return `${r.quantity} × ${name}`
  })
}

/** The distinct product types of a cart, in cart order. */
export const productTypes = (lines: CartLine[]) => [...new Set(lines.map((l) => l.productId))]

/** {{cart_product_benefits}}: each product type's own line (its purpose, as the site says it), once. */
export const cartProductBenefits = (lines: CartLine[]) => productTypes(lines).map((id) => `${nameOf(id)}: ${getProduct(id)?.purpose ?? ''}`.trim())

/** {{voucher_amount}}: the number of lei only ("640"); the approved texts write "lei" after it. */
export const voucherAmount = (bani: number) => new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(bani / 100)

/** {{voucher_expiry}}: the real expiry date, Romanian, in Romania's time zone ("28 octombrie 2026"). */
export const voucherExpiry = (d: Date) => d.toLocaleDateString('ro-RO', { timeZone: 'Europe/Bucharest', day: 'numeric', month: 'long', year: 'numeric' })

/** {{cart_eligible_vouchers}}: the vouchers the cart's product types can have, with product and amount. */
export function cartEligibleVouchers(vouchers: { productId: string; amountMinor: number | null; expiresAt: Date }[]) {
  return vouchers.filter((v) => isVoucherProduct(v.productId)).map((v) => `${nameOf(v.productId)}: ${voucherAmount(v.amountMinor ?? VOUCHER_VALUE[v.productId as keyof typeof VOUCHER_VALUE])} lei, până la ${voucherExpiry(v.expiresAt)}`)
}

/**
 * Which abandoned-cart-04 variant applies: one product type ({{product_name}}, {{voucher_amount}}) or several
 * ({{cart_eligible_vouchers}}). A cart with only the book has no voucher (the email without a voucher is not approved).
 */
export function cartVariant(lines: CartLine[]): 'single' | 'multiple' | 'no_voucher' {
  const eligible = productTypes(lines).filter(isVoucherProduct)
  if (!eligible.length) return 'no_voucher'
  return productTypes(lines).length === 1 ? 'single' : 'multiple'
}

/** The products, joined the Romanian way: "A", "A și B", "A, B și C". */
export function joinRo(items: string[]) {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} și ${items[items.length - 1]}`
}

const FAMILY = ['balance-wave', 'brainlink-pro', 'ochelari-biohack', 'carte-diana']

/**
 * Post-purchase values for one enrollment (all the orders it covers): {{product_name}} names every product bought,
 * singular or plural as it is; the book never gets "NEUROS"; the complementary products are only those not owned.
 */
export function postPurchaseFacts(bought: string[], owned: string[]) {
  const types = [...new Set(bought)].filter((id) => FAMILY.includes(id))
  const names = types.map(nameOf)
  const have = new Set([...owned, ...bought])
  const complementary = FAMILY.filter((id) => !have.has(id))
  return {
    productName: joinRo(names),
    /** The models only ("Calm", "Calm și Amber"), for the subject that already writes "NEUROS" before the variable. */
    productModels: joinRo(types.map((id) => getProduct(id)?.model ?? id)),
    plural: types.length > 1,
    products: types,
    complementary,
    /** The whole range already owned: the 4th email carries support and combined use, no recommendation. */
    ownsAll: complementary.length === 0,
    /**
     * post-purchase-01's subject writes "NEUROS {{product_name}} a ajuns" itself: with the models it reads right for one
     * NEUROS product; for the book (no "NEUROS") and for several products ("au ajuns") it needs an editorial decision
     * (Email Studio note) before it can be sent as it is.
     */
    subjectNeedsRule: types.some((id) => id === 'carte-diana') || types.length > 1,
  }
}
