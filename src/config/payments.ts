/**
 * Cash on delivery (ramburs): THE ONLY PLACE it is switched on. Read by the product pages (which button
 * leads), the checkout (which methods it offers) and the server (which it accepts), so all three always
 * agree. NEXT_PUBLIC_ so the browser bundle sees the same value as the server.
 *
 *   NEXT_PUBLIC_COD_ENABLED=false   turns it off everywhere (on by default; it needs only the database).
 *
 * There is no order-value ceiling (business decision, 13 Oct 2026): every product and every total can be
 * paid on delivery. A courier's own cash-on-delivery limit is an operational matter, not a checkout rule.
 *
 * Nothing is collected online for these orders: the customer pays the courier, and the order becomes
 * paid only when a person records the courier's settlement in /admin (server/orders/service.ts).
 */
export const cashOnDelivery = {
  enabled: process.env.NEXT_PUBLIC_COD_ENABLED?.trim() !== 'false',
} as const
