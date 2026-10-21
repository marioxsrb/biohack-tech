/**
 * Whether an order line is a reward's gift (server/vouchers.ts: a gift code makes one unit of its product free): the
 * warehouse and the admin see it as such. Pure; reads only the order.
 */
export const GIFT_CODE_RE = /^BTG[A-Z][A-Z0-9]{8}$/

export const isGiftLine = (o: { promoCode: string | null }, i: { codeDiscountMinor: number }) => !!o.promoCode && GIFT_CODE_RE.test(o.promoCode) && i.codeDiscountMinor > 0
