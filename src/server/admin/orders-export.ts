import { INVOICE_LABEL, ORDER_LABEL, PAYMENT_LABEL } from '@/app/[lang]/(admin)/admin/labels'
import { PAYMENT_METHOD_LABEL, billingName, type Order } from '@/server/orders/model'

/**
 * Orders as a CSV for a spreadsheet (/api/admin/export): one row per order, Romanian headers. It opens straight in
 * Excel set to Romanian and imports into Google Sheets: UTF-8 with a BOM, ";" between columns, amounts with a
 * decimal comma and no thousands separator. A text cell that starts like a formula gets a leading apostrophe.
 */
const SEP = ';'

const date = (d: Date | null) =>
  d ? d.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '') : ''
const amount = (minor: number) => (minor / 100).toFixed(2).replace('.', ',')
const text = (v: string | null | undefined) => {
  const s = (v ?? '').replace(/\r?\n/g, ' ').trim()
  return /^[=+\-@\t]/.test(s) ? `'${s}` : s
}
const cell = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

const COLUMNS: [string, (o: Order, parents: Map<string, string>) => string][] = [
  ['Comanda', (o) => text(o.orderNumber)],
  ['Data', (o) => date(o.createdAt)],
  ['Site', (o) => (o.site === 'net' ? 'biohack-tech.net' : 'biohack-tech.ro')],
  ['Tip', (o, parents) => (o.kind === 'upsell' ? `Adăugată la ${o.parentOrderId ? (parents.get(o.parentOrderId) ?? 'comanda inițială') : 'comanda inițială'}` : 'Comandă')],
  ['Client', (o) => text(billingName(o.customer))],
  ['Persoană', (o) => (o.customer.buyerType === 'pj' ? 'Juridică' : 'Fizică')],
  ['Nume', (o) => text(`${o.customer.firstName} ${o.customer.lastName}`)],
  ['Firmă', (o) => text(o.customer.company)],
  ['CUI', (o) => text(o.customer.cui)],
  ['Email', (o) => text(o.email)],
  ['Telefon', (o) => text(o.phone)],
  ['Produse', (o) => text(o.items.map((i) => `${i.quantity} × ${i.productName}${i.variantName ? ` (${i.variantName})` : ''}`).join(', '))],
  ['Bucăți', (o) => String(o.items.reduce((n, i) => n + i.quantity, 0))],
  ['Subtotal', (o) => amount(o.subtotalMinor)],
  ['Reducere', (o) => amount(o.discountMinor)],
  ['Cod promo', (o) => text(o.promoCode)],
  ['Transport', (o) => amount(o.shippingMinor)],
  ['Total', (o) => amount(o.totalMinor)],
  ['Rambursat', (o) => amount(o.refundedMinor)],
  ['Monedă', (o) => o.currency],
  ['Plată', (o) => PAYMENT_METHOD_LABEL[o.paymentMethod] ?? o.paymentMethod],
  ['Stare plată', (o) => PAYMENT_LABEL[o.paymentStatus] ?? o.paymentStatus],
  ['Stare comandă', (o) => ORDER_LABEL[o.status] ?? o.status],
  ['Factură', (o) => INVOICE_LABEL[o.invoiceStatus] ?? o.invoiceStatus],
  ['Nr. factură', (o) => text(o.fgoInvoiceNumber ? `${o.fgoInvoiceSeries ?? ''}${o.fgoInvoiceNumber}` : '')],
  ['Adresă livrare', (o) => text(o.shippingAddress.address)],
  ['Oraș', (o) => text(o.shippingAddress.city)],
  ['Județ', (o) => text(o.shippingAddress.county)],
  ['Cod poștal', (o) => text(o.shippingAddress.postalCode)],
  ['Țară', (o) => text(o.shippingAddress.country)],
  ['Curier', (o) => text(o.courier)],
  ['AWB', (o) => text(o.trackingNumber)],
  ['Expediată', (o) => date(o.shippedAt)],
  ['Livrată', (o) => date(o.deliveredAt)],
  ['Observații', (o) => text(o.notes)],
  ['Sursă', (o) => text(o.attribution?.landing ?? o.attribution?.utm?.utm_source ?? '')],
]

export function ordersCsv(list: Order[]): string {
  const parents = new Map(list.map((o) => [o.id, o.orderNumber]))
  const rows = [COLUMNS.map(([h]) => h), ...list.map((o) => COLUMNS.map(([, f]) => f(o, parents)))]
  return '﻿' + rows.map((r) => r.map(cell).join(SEP)).join('\r\n') + '\r\n'
}
