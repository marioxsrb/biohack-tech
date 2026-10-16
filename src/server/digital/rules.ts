/**
 * Who may have the book's PDF, decided from the canonical order alone (never from a URL, a redirect from Stripe or
 * anything the browser says). Pure: the grant (in the order's transaction), the job that emails the link, the
 * download endpoint and the admin all ask this same function, so a refund or a cancellation closes every door at once.
 *
 *   card            paid (Stripe webhook or reconciliation)
 *   bank transfer   paid (a person confirmed the money in /admin)
 *   cash on delivery  the order is DELIVERED (the canonical state machine), and not cancelled
 * Never: a cancelled order, a full refund, an unpaid card or transfer, a cash-on-delivery parcel not yet delivered
 * (shipped, refused or returned to the sender: those end cancelled).
 */
import { isBook } from '@/content/catalog'
import type { Order } from '@/server/orders/model'
import { isPaid } from '@/server/orders/state'

export type DigitalBlock = 'no_book' | 'cancelled' | 'refunded' | 'not_paid' | 'awaiting_delivery'
export type DigitalDecision = { ok: true; via: 'payment' | 'delivery' } | { ok: false; reason: DigitalBlock }

type Facts = Pick<Order, 'status' | 'paymentStatus' | 'paymentMethod' | 'items'>

export const hasBook = (o: Pick<Order, 'items'>) => o.items.some((i) => isBook(i.productId) && i.quantity > 0)

export function digitalAccess(o: Facts): DigitalDecision {
  if (!hasBook(o)) return { ok: false, reason: 'no_book' }
  if (o.status === 'cancelled') return { ok: false, reason: 'cancelled' }
  if (o.paymentStatus === 'refunded') return { ok: false, reason: 'refunded' }
  if (o.paymentMethod === 'cash_on_delivery') {
    if (o.status !== 'delivered') return { ok: false, reason: 'awaiting_delivery' }
    return o.paymentStatus === 'awaiting_collection' || isPaid(o.paymentStatus) ? { ok: true, via: 'delivery' } : { ok: false, reason: 'not_paid' }
  }
  return isPaid(o.paymentStatus) ? { ok: true, via: 'payment' } : { ok: false, reason: 'not_paid' }
}

/** A block that ends access for good (an entitlement already granted is revoked); the others only wait. */
export const isFinalBlock = (r: DigitalBlock) => r === 'cancelled' || r === 'refunded'

/** Why the book cannot be delivered, in the team's words (admin). */
export function blockText(reason: DigitalBlock | 'revoked' | 'not_configured', o?: Pick<Order, 'paymentMethod' | 'status'>): string {
  switch (reason) {
    case 'no_book':
      return 'Comanda nu conține cartea.'
    case 'cancelled':
      return 'Comanda este anulată: nu se trimite PDF-ul.'
    case 'refunded':
      return 'Comanda este rambursată integral: accesul la PDF este oprit.'
    case 'awaiting_delivery':
      return `Ramburs: PDF-ul se trimite după ce comanda este marcată „Livrată”${o ? ` (acum: ${o.status})` : ''}.`
    case 'not_paid':
      return o?.paymentMethod === 'bank_transfer'
        ? 'Transferul nu este confirmat. Confirmă plata în comandă, după ce banii apar în cont; PDF-ul pleacă automat.'
        : o?.paymentMethod === 'card'
          ? 'Stripe nu a confirmat plata. PDF-ul se trimite automat după confirmare.'
          : 'Plata nu este confirmată.'
    case 'revoked':
      return 'Accesul a fost revocat. Linkurile vechi nu mai funcționează.'
    case 'not_configured':
      return 'Sursa PDF (NEUROS) sau secretul linkurilor nu sunt configurate pe server.'
  }
}
