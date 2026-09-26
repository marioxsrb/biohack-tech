import type { InvoiceStatus, Order } from '@/server/orders/model'

export const ORDER_LABEL: Record<Order['status'], string> = {
  pending: 'Nouă',
  abandoned: 'Plată nefinalizată',
  confirmed: 'De pregătit',
  processing: 'În pregătire',
  shipped: 'Expediată',
  delivered: 'Livrată',
  cancelled: 'Anulată',
}
export const PAYMENT_LABEL: Record<Order['paymentStatus'], string> = {
  pending: 'Card în curs',
  awaiting_transfer: 'Așteaptă transferul',
  failed: 'Card eșuat',
  paid: 'Plătită',
  partially_refunded: 'Rambursată parțial',
  refunded: 'Rambursată',
}
export const INVOICE_LABEL: Record<InvoiceStatus, string> = {
  none: '–',
  pending: 'În curs',
  issued: 'Emisă',
  failed: 'Eroare',
  manual: 'Manual',
}

export const tone = (s: string) =>
  ['paid', 'issued', 'delivered', 'shipped', 'confirmed'].includes(s)
    ? 'bg-cyan-50 text-cyan-700'
    : ['failed', 'cancelled', 'refunded'].includes(s)
      ? 'bg-[#fdecec] text-red-deep'
      : 'bg-mist text-ink'
