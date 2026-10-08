/**
 * Cash on delivery (ramburs): THE ONLY PLACE it is switched on or limited. Read by the product pages
 * (which button leads), the checkout (which methods it offers) and the server (which it accepts), so all
 * three always agree. NEXT_PUBLIC_ so the browser bundle sees the same values as the server.
 *
 *   NEXT_PUBLIC_COD_ENABLED=false   turns it off everywhere (on by default; it needs only the database).
 *   NEXT_PUBLIC_COD_MAX_LEI=5000    optional ceiling for one order (a courier's cash-on-delivery limit);
 *                                   above it the checkout offers card or transfer only. Unset = no ceiling.
 *
 * Nothing is collected online for these orders: the customer pays the courier, and the order becomes
 * paid only when a person records the courier's settlement in /admin (server/orders/service.ts).
 */
const maxLei = Number(process.env.NEXT_PUBLIC_COD_MAX_LEI)

export const cashOnDelivery = {
  enabled: process.env.NEXT_PUBLIC_COD_ENABLED?.trim() !== 'false',
  maxTotalMinor: Number.isFinite(maxLei) && maxLei > 0 ? Math.round(maxLei * 100) : null,
} as const

/** Whether an order of this total (bani) can be paid on delivery. */
export const codAllowedFor = (totalMinor: number, c: { enabled: boolean; maxTotalMinor: number | null } = cashOnDelivery) =>
  c.enabled && (c.maxTotalMinor === null || totalMinor <= c.maxTotalMinor)
