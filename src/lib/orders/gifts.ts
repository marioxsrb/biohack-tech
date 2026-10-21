/**
 * Whether an order line is a reward's gift (server/vouchers.ts: a gift code makes one unit of its product free): the
 * warehouse and the admin see it as such. Pure; reads only the order.
 */
export const GIFT_CODE_RE = /^BTG[A-Z][A-Z0-9]{8}$/

export const isGiftLine = (o: { promoCode: string | null }, i: { codeDiscountMinor: number }) => !!o.promoCode && GIFT_CODE_RE.test(o.promoCode) && i.codeDiscountMinor > 0

/** How a line reads for the warehouse: a gift frees one unit, so "×2" with a gift is one paid and one gift. */
export const giftNote = (o: { promoCode: string | null }, i: { codeDiscountMinor: number; quantity: number }) =>
  isGiftLine(o, i) ? (i.quantity > 1 ? `1 din ${i.quantity} cadou (recompensă)` : 'cadou (recompensă)') : null
