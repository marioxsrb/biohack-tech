/**
 * Operational notifications for the team (NOTIFY_EMAIL, orders@biohack-tech.ro), sent by the application
 * from the canonical order: one per event and order (the job's dedupe key), never from GoHighLevel fields.
 * Each says what happened, what to do and links to the order in /admin. No customer address, phone or email:
 * the team opens /admin for those.
 *
 * Delayed ones (overdue transfer, preparation, delivery) are checked again against the order right before
 * sending; an order that moved on in the meantime gets nothing.
 */
import 'server-only'
import { ORDER_LABEL, PAYMENT_LABEL } from '@/app/[lang]/(admin)/admin/labels'
import { formatMoney } from '@/lib/currency'
import { isBulk } from '@/config/promotions'
import { PAYMENT_METHOD_LABEL, type Order } from '@/server/orders/model'

export type NotifyEvent =
  | 'new_card_paid'
  | 'new_transfer'
  | 'transfer_paid'
  | 'new_cod'
  | 'upsell_paid'
  | 'transfer_overdue'
  | 'prep_overdue'
  | 'delivery_overdue'
  | 'cod_uncollected'
  | 'refund_after_cancel'
  | 'refund_after_return'
  | 'storno_needed'
  | 'job_failed'
  | 'team_confirmed'
  | 'fulfillment_issue'

export type NotifyContext = { siteUrl: string; parentNumber?: string | null; job?: { id: number; kind: string; status: string; lastError: string | null; template?: string } }

/** A business order still waiting for a person's call: what every "new order" note asks first. */
const CONFIRM_FIRST = 'COMANDĂ COMPANIE: sună clientul și confirmă cantitățile și livrarea, apoi apasă „Confirmă comanda” în /admin/companii. Până atunci nu se pregătește.'
const paid = (o: Order) => o.paymentStatus === 'paid' || o.paymentStatus === 'partially_refunded'
const preparing = (o: Order) => o.status === 'confirmed' || o.status === 'processing'

/** Title, what to do, and whether it is still true now (checked right before sending). */
export const NOTIFICATIONS: Record<NotifyEvent, { title: string; action: (o: Order, x: NotifyContext) => string; stillTrue: (o: Order, x: NotifyContext) => boolean }> = {
  new_card_paid: {
    title: 'comandă nouă plătită cu cardul',
    action: () => 'Pregătește coletul. Marchează „în pregătire”, apoi „expediată” cu AWB în /admin.',
    stillTrue: (o) => o.status !== 'cancelled',
  },
  new_transfer: {
    title: 'comandă nouă, așteaptă transferul',
    action: (o) => `${o.teamConfirmation === 'awaiting' ? `${CONFIRM_FIRST} ` : ''}Verifică extrasul. Când suma de ${formatMoney(o.totalMinor, o.currency)} apare cu referința ${o.orderNumber}, apasă „Plata a fost primită” în /admin.`,
    stillTrue: (o) => o.paymentStatus === 'awaiting_transfer' && o.status !== 'cancelled',
  },
  transfer_paid: {
    title: 'transferul a fost confirmat',
    action: (o) => (o.teamConfirmation === 'awaiting' ? CONFIRM_FIRST : 'Pregătește coletul. Marchează „în pregătire”, apoi „expediată” cu AWB în /admin.'),
    stillTrue: (o) => o.status !== 'cancelled',
  },
  new_cod: {
    title: 'comandă nouă cu plata la livrare',
    action: (o) =>
      o.teamConfirmation === 'awaiting'
        ? `${CONFIRM_FIRST} Curierul va încasa ${formatMoney(o.codAmountMinor ?? o.totalMinor, o.currency)}.`
        : `Pregătește coletul. Curierul încasează ${formatMoney(o.codAmountMinor ?? o.totalMinor, o.currency)}. Marchează „expediată” cu AWB în /admin.`,
    stillTrue: (o) => o.status !== 'cancelled',
  },
  upsell_paid: {
    title: 'produs adăugat după plată',
    action: (o, x) => `Plătită cu cardul. Se poate expedia împreună cu comanda ${x.parentNumber ?? '(principală)'}. Marchează și această comandă în /admin.`,
    stillTrue: (o) => o.status !== 'cancelled',
  },
  transfer_overdue: {
    title: 'transferul nu a ajuns de 5 zile',
    action: () => 'Sună clientul sau anulează comanda în /admin.',
    stillTrue: (o) => o.paymentStatus === 'awaiting_transfer' && o.status !== 'cancelled',
  },
  prep_overdue: {
    title: 'nu este încă la curier după 2 zile',
    action: () => 'Termenul promis este 1-3 zile. Expediază coletul și trece AWB-ul în /admin.',
    stillTrue: (o) => preparing(o),
  },
  delivery_overdue: {
    title: 'expediată de 5 zile, nelivrată',
    action: (o) => `Verifică la curier AWB ${o.trackingNumber ?? ''}${o.courier ? ` (${o.courier})` : ''}. Marchează „livrată” în /admin.`,
    stillTrue: (o) => o.status === 'shipped',
  },
  cod_uncollected: {
    title: 'livrată ramburs de 10 zile, banii neîncasați',
    action: (o) =>
      `Verifică decontul curierului${o.courier ? ` (${o.courier})` : ''} pentru AWB ${o.trackingNumber ?? ''} și ${formatMoney(o.codAmountMinor ?? o.totalMinor, o.currency)}. Când banii au intrat, apasă „Rambursul a fost încasat” în /admin.`,
    stillTrue: (o) => o.status === 'delivered' && o.paymentMethod === 'cash_on_delivery' && o.paymentStatus === 'awaiting_collection',
  },
  refund_after_cancel: {
    title: 'anulată după plată, de rambursat',
    action: (o) =>
      o.paymentMethod === 'card'
        ? 'Rambursează plata în Stripe. Rambursarea apare apoi singură în /admin.'
        : 'Rambursează prin transfer bancar, apoi înregistrează rambursarea în /admin.',
    stillTrue: (o) => o.status === 'cancelled' && paid(o),
  },
  refund_after_return: {
    title: 'retur primit, de rambursat',
    action: (o) =>
      o.paymentMethod === 'card'
        ? 'Rambursează plata în Stripe (cel mult 14 zile de la cererea de retragere). Apare apoi singură în /admin.'
        : 'Rambursează prin transfer bancar (cel mult 14 zile de la cererea de retragere), apoi înregistrează rambursarea în /admin.',
    stillTrue: (o) => o.returnStatus === 'received' && paid(o),
  },
  storno_needed: {
    title: 'factura trebuie stornată în FGO',
    action: (o) => `Emite stornarea facturii ${`${o.fgoInvoiceSeries ?? ''} ${o.fgoInvoiceNumber ?? ''}`.trim()} în FGO.`,
    stillTrue: (o) => !!o.fgoInvoiceNumber && !o.fgoStornoNumber,
  },
  fulfillment_issue: {
    title: 'problemă raportată la pregătire',
    action: (o) => `Depozitul a raportat: „${o.fulfillmentIssue ?? ''}”. Rezolvă și șterge problema din /fulfillment sau din comandă.`,
    stillTrue: (o) => !!o.fulfillmentIssue && o.status !== 'cancelled',
  },
  team_confirmed: {
    title: 'comanda companiei a fost confirmată',
    action: () => 'Clientul a confirmat la telefon. Pregătește coletul: marchează „în pregătire”, apoi „expediată” cu AWB (în /fulfillment sau /admin).',
    stillTrue: (o) => o.status !== 'cancelled',
  },
  job_failed: {
    title: 'o integrare a eșuat definitiv',
    action: (o, x) => `${jobLabel(x.job?.kind ?? '', x.job?.template)} s-a oprit după toate reîncercările. Verifică eroarea și apasă „Reîncearcă” în /admin.`,
    stillTrue: (o, x) => x.job?.status === 'failed',
  },
}

const JOB_LABEL: Record<string, string> = {
  'ghl.sync': 'Sincronizarea cu GoHighLevel',
  'marketing.sync': 'Sincronizarea acordului de marketing',
  'fgo.invoice': 'Emiterea facturii în FGO',
  'fgo.storno': 'Stornarea facturii în FGO',
  'email.send': 'Emailul către client',
  'notify.send': 'Notificarea către echipă',
  'stripe.reconcile': 'Verificarea plății în Stripe',
  'upsell.release': 'Eliberarea cardului păstrat pentru ofertă',
  'ghl.enquiry': 'Trimiterea mesajului în GoHighLevel',
  'ghl.lead': 'Trimiterea lead-ului în GoHighLevel',
  'ghl.welcome': 'Trimiterea adresei din popup în GoHighLevel',
  'email.reply': 'Răspunsul către client (din admin)',
  'push.send': 'Notificarea în aplicația iOS',
  'order.transfer_expiry': 'Anularea transferului expirat',
  'order.abandon_check': 'Verificarea plății nefinalizate',
  'meta.purchase': 'Purchase către Meta (Conversions API)',
}
export const jobLabel = (kind: string, template?: string) => `${JOB_LABEL[kind] ?? kind}${template ? ` (${template})` : ''}`

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function renderNotification(event: NotifyEvent, o: Order, x: NotifyContext) {
  const n = NOTIFICATIONS[event]
  const subject = `${isBulk(o.promotions) ? '[Companii] ' : ''}Comanda ${o.orderNumber}: ${n.title}`
  const link = `${x.siteUrl}/admin/orders/${o.id}`
  const rows: [string, string][] = [
    ['Comanda', o.orderNumber],
    ...(x.parentNumber ? ([['Comanda principală', x.parentNumber]] as [string, string][]) : []),
    ['Stare comandă', ORDER_LABEL[o.status]],
    ['Plată', `${PAYMENT_METHOD_LABEL[o.paymentMethod]} · ${PAYMENT_LABEL[o.paymentStatus]}`],
    ['Total', formatMoney(o.totalMinor, o.currency)],
    ...(isBulk(o.promotions)
      ? ([['Comandă companie', `reducere 40%${o.teamConfirmation === 'awaiting' ? ' · așteaptă confirmarea echipei' : o.teamConfirmation === 'confirmed' ? ' · confirmată de echipă' : ''}`]] as [string, string][])
      : []),
    ['Produse', o.items.map((i) => `${i.quantity} x ${i.productName}${i.variantName ? ` (${i.variantName})` : ''}`).join('; ')],
    ...(x.job ? ([['Eroare', x.job.lastError ?? '–']] as [string, string][]) : []),
  ]
  const action = n.action(o, x)
  const text = [subject, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', `Ce ai de făcut: ${action}`, '', `Deschide comanda: ${link}`].join('\n')
  const html = `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:20px;background:#f2f5f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0b1316">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:22px">
<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.06em;color:#0e7490">BIOHACK TECH · NOTIFICARE INTERNĂ</p>
<h1 style="margin:0 0 14px;font-size:19px;line-height:1.35">${esc(subject)}</h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><td style="padding:7px 0;border-top:1px solid #e8edef;color:#5a6870;font-size:14px;width:36%;vertical-align:top">${esc(k)}</td><td style="padding:7px 0;border-top:1px solid #e8edef;font-size:14px;font-weight:600">${esc(v)}</td></tr>`)
    .join('')}</table>
<p style="margin:16px 0 0;font-size:15px;line-height:1.5"><strong>Ce ai de făcut:</strong> ${esc(action)}</p>
<p style="margin:18px 0 0"><a href="${esc(link)}" style="display:inline-block;background:#0b1316;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 18px;border-radius:9px">Deschide comanda în /admin</a></p>
</div></body></html>`
  return { subject, html, text }
}
