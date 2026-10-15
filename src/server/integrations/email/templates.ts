/**
 * Transactional emails, rendered by us from the canonical order and delivered by the
 * configured transport (our own SMTP mailbox in production). One data contract, one template per message.
 * Plain language, one idea per sentence, no marketing blocks. Every email also has a plain-text version.
 * In the order's language (Romanian, or English for orders placed in English), amounts in the order's currency,
 * links to the site the order was placed on.
 */
import { site, terms } from '@/config/site'
import type { BankConfig } from '@/server/config'
import { customerName, formatAddress, PAYMENT_METHOD_LABEL, type Order } from '@/server/orders/model'
import { awaitsCollection } from '@/server/orders/state'
import { formatMoney } from '@/lib/currency'
import { promoText } from '@/config/promotions'
import { siteOrigin } from '@/lib/sites'
import { emailShell } from './shell'

export type EmailTemplate =
  | 'order_confirmed'
  | 'cod_confirmed'
  | 'transfer_instructions'
  | 'payment_received'
  | 'invoice_issued'
  | 'order_shipped'
  | 'order_cancelled'
  | 'refund_issued'
  | 'withdrawal_received'
  | 'return_received'
  | 'transfer_reminder'
  | 'delivery_followup'

const SUBJECT_EN: Record<EmailTemplate, (o: Order) => string> = {
  order_confirmed: (o) => `Your Biohack Tech order #${o.orderNumber}`,
  cod_confirmed: (o) => `Your Biohack Tech order #${o.orderNumber}: pay on delivery`,
  transfer_instructions: (o) => `Order #${o.orderNumber}: bank transfer details`,
  payment_received: (o) => `We received the payment for order #${o.orderNumber}`,
  invoice_issued: (o) => `Invoice for order #${o.orderNumber}`,
  order_shipped: (o) => `Order #${o.orderNumber} has shipped`,
  order_cancelled: (o) => `Order #${o.orderNumber} has been cancelled`,
  refund_issued: (o) => `Refund for order #${o.orderNumber}`,
  withdrawal_received: (o) => `We received your withdrawal for order #${o.orderNumber}`,
  return_received: (o) => `We received the returned products from order #${o.orderNumber}`,
  transfer_reminder: (o) => `Reminder: order ${o.orderNumber} is waiting for payment`,
  delivery_followup: (o) => `Order ${o.orderNumber} has arrived. We're here to help you get started`,
}

/** The subject in the order's language. */
export const subjectFor = (t: EmailTemplate, o: Order) => (o.locale === 'en' ? SUBJECT_EN[t](o) : EMAIL_TEMPLATES[t].subject(o))

export const EMAIL_TEMPLATES: Record<EmailTemplate, { subject: (o: Order) => string; kind: 'transactional' }> = {
  order_confirmed: { subject: (o) => `Comanda ta Biohack Tech #${o.orderNumber}`, kind: 'transactional' },
  cod_confirmed: { subject: (o) => `Comanda ta Biohack Tech #${o.orderNumber}: plata la livrare`, kind: 'transactional' },
  transfer_instructions: { subject: (o) => `Comanda #${o.orderNumber}: datele pentru transfer`, kind: 'transactional' },
  payment_received: { subject: (o) => `Am primit plata pentru comanda #${o.orderNumber}`, kind: 'transactional' },
  invoice_issued: { subject: (o) => `Factura pentru comanda #${o.orderNumber}`, kind: 'transactional' },
  order_shipped: { subject: (o) => `Comanda #${o.orderNumber} a fost expediată`, kind: 'transactional' },
  order_cancelled: { subject: (o) => `Comanda #${o.orderNumber} a fost anulată`, kind: 'transactional' },
  refund_issued: { subject: (o) => `Rambursare pentru comanda #${o.orderNumber}`, kind: 'transactional' },
  withdrawal_received: { subject: (o) => `Am primit cererea de retragere pentru comanda #${o.orderNumber}`, kind: 'transactional' },
  return_received: { subject: (o) => `Am primit produsele returnate din comanda #${o.orderNumber}`, kind: 'transactional' },
  // Service messages about an order already placed (W3 T1, W6 P1), not marketing: no unsubscribe link, no offers.
  transfer_reminder: { subject: (o) => `Reamintire: comanda ${o.orderNumber} așteaptă plata`, kind: 'transactional' },
  delivery_followup: { subject: (o) => `Comanda ${o.orderNumber} a ajuns. Te ajutăm la început`, kind: 'transactional' },
}

/**
 * Delayed emails are checked against the order right before sending: a transfer paid or an order cancelled,
 * refunded or returned in the meantime gets no obsolete message.
 */
export const stillDue: Partial<Record<EmailTemplate, (o: Order) => boolean>> = {
  transfer_reminder: (o) => o.paymentMethod === 'bank_transfer' && o.paymentStatus === 'awaiting_transfer' && o.status !== 'cancelled',
  delivery_followup: (o) => o.status === 'delivered' && (o.paymentStatus === 'paid' || o.paymentStatus === 'awaiting_collection') && !o.returnStatus,
}

/** The withdrawal statement being acknowledged (withdrawal_received only). */
export type WithdrawalStatement = { reference: string; name: string; items: string; message: string; createdAt: Date }
export type EmailContext = { siteUrl: string; bank: BankConfig | null; withdrawal?: WithdrawalStatement }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const dateTimeRo = (d: Date) =>
  d.toLocaleString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' })
const dateRo = (d: Date) => d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Bucharest' })
const dateEn = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Bucharest' })
const dateTimeEn = (d: Date) => d.toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' })
/** An amount in the order's currency. */
const fm = (o: Order, minor: number) => formatMoney(minor, o.currency)
const en = (o: Order) => o.locale === 'en'
const METHOD_EN: Record<Order['paymentMethod'], string> = { card: 'Card', bank_transfer: 'Bank transfer', cash_on_delivery: 'Cash on delivery' }
const methodLabel = (o: Order) => (en(o) ? METHOD_EN[o.paymentMethod] : PAYMENT_METHOD_LABEL[o.paymentMethod])

type Block = { html: string; text: string }
const p = (s: string): Block => ({ html: `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#27343a">${esc(s)}</p>`, text: s })
const h = (s: string): Block => ({ html: `<h2 style="margin:28px 0 10px;font-size:17px;line-height:1.3;color:#0b1316">${esc(s)}</h2>`, text: `\n${s.toUpperCase()}` })
const rows = (list: [string, string][]): Block => ({
  html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 8px">${list
    .map(([k, v]) => `<tr><td style="padding:8px 0;border-top:1px solid #e8edef;color:#5a6870;font-size:14px;width:40%;vertical-align:top">${esc(k)}</td><td style="padding:8px 0;border-top:1px solid #e8edef;color:#0b1316;font-size:15px;font-weight:600">${esc(v)}</td></tr>`)
    .join('')}</table>`,
  text: list.map(([k, v]) => `${k}: ${v}`).join('\n'),
})

function itemsBlock(o: Order): Block {
  const lines = o.items.map((i) => ({ name: i.productName, variant: i.variantName, qty: i.quantity, unit: i.unitPriceMinor, total: i.lineTotalMinor }))
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${lines
    .map(
      (l) => `<tr><td style="padding:10px 0;border-top:1px solid #e8edef;font-size:15px;color:#0b1316">${esc(`${l.qty} x ${l.name}`)}${l.variant ? `<br><span style="color:#5a6870;font-size:14px">${esc(l.variant)}</span>` : ''}${l.qty > 1 ? `<br><span style="color:#5a6870;font-size:13px">${esc(fm(o, l.unit))} / ${en(o) ? 'each' : 'buc.'}</span>` : ''}</td><td align="right" style="padding:10px 0;border-top:1px solid #e8edef;font-size:15px;color:#0b1316;white-space:nowrap;vertical-align:top">${esc(fm(o, l.total))}</td></tr>`,
    )
    .join('')}
    <tr><td style="padding:8px 0;border-top:1px solid #e8edef;font-size:14px;color:#5a6870">Subtotal</td><td align="right" style="padding:8px 0;border-top:1px solid #e8edef;font-size:14px;color:#0b1316">${esc(fm(o, o.subtotalMinor))}</td></tr>
    ${o.promotions
      .map(
        (pr) =>
          `<tr><td style="padding:4px 0;font-size:14px;color:#0e7490">${esc(promoText(pr.label, o.locale))}</td><td align="right" style="padding:4px 0;font-size:14px;color:#0e7490;white-space:nowrap">${esc(`-${fm(o, pr.amountMinor)}`)}</td></tr>`,
      )
      .join('')}
    <tr><td style="padding:4px 0;font-size:14px;color:#5a6870">${en(o) ? 'Delivery' : 'Livrare'}</td><td align="right" style="padding:4px 0;font-size:14px;color:#0b1316">${o.shippingMinor ? esc(fm(o, o.shippingMinor)) : en(o) ? 'Free' : 'Gratuită'}</td></tr>
    <tr><td style="padding:10px 0;border-top:1px solid #e8edef;font-size:16px;font-weight:700;color:#0b1316">Total</td><td align="right" style="padding:10px 0;border-top:1px solid #e8edef;font-size:17px;font-weight:700;color:#0b1316">${esc(fm(o, o.totalMinor))}</td></tr>
  </table><p style="margin:4px 0 0;font-size:12px;color:#5a6870;text-align:right">${esc(en(o) ? 'VAT included' : terms.vat)}</p>`
  const text = [
    ...lines.map((l) => `${l.qty} x ${l.name}${l.variant ? ` (${l.variant})` : ''}: ${fm(o, l.total)}`),
    `Subtotal: ${fm(o, o.subtotalMinor)}`,
    ...o.promotions.map((pr) => `${promoText(pr.label, o.locale)}: -${fm(o, pr.amountMinor)}`),
    `${en(o) ? 'Delivery' : 'Livrare'}: ${o.shippingMinor ? fm(o, o.shippingMinor) : en(o) ? 'Free' : 'Gratuită'}`,
    `Total: ${fm(o, o.totalMinor)} (${en(o) ? 'VAT included' : terms.vat})`,
  ].join('\n')
  return { html, text }
}

function addressBlock(o: Order): Block[] {
  const L = o.locale
  const billing = o.customer.buyerType === 'pj' ? `${o.customer.company}, ${o.billingAddress.country === 'RO' ? 'CUI' : en(o) ? 'VAT' : 'TVA'} ${o.customer.cui}, ${formatAddress(o.billingAddress, L)}` : formatAddress(o.billingAddress, L)
  if (en(o)) return [h('Delivery and billing'), rows([['Deliver to', `${customerName(o.customer)}, ${formatAddress(o.shippingAddress, L)}`], ['Billing', billing], ['Phone', o.phone]])]
  return [h('Livrare și facturare'), rows([['Livrare la', `${customerName(o.customer)}, ${formatAddress(o.shippingAddress)}`], ['Facturare', billing], ['Telefon', o.phone]])]
}

function bankBlock(o: Order, bank: BankConfig | null): Block[] {
  if (!bank) return [p(`Datele pentru transfer îți sunt trimise separat de echipa noastră. Scrie-ne la ${site.email} dacă ai nevoie de ele acum.`)]
  return [
    rows([
      ['Beneficiar', bank.beneficiary],
      ['IBAN', bank.iban],
      ['Banca', bank.bank],
      ...(bank.swift ? ([['SWIFT', bank.swift]] as [string, string][]) : []),
      ['Suma', fm(o, o.totalMinor)],
      ['Detalii plată', `Comanda ${o.orderNumber}`],
    ]),
    p(`Scrie ${o.orderNumber} la detaliile plății. Așa potrivim transferul cu comanda ta.`),
  ]
}

/** How the money goes back: the same way, except cash paid to the courier, which comes back by bank transfer. */
const refundWay = (o: Order) =>
  o.paymentMethod === 'cash_on_delivery' ? 'prin transfer bancar, în contul pe care ni-l indici' : 'pe aceeași cale prin care ai plătit'

/** The order's page on the site it was placed on, in its language. */
export const orderPageUrl = (o: Order, siteUrl: string) => `${siteOrigin(o.site, siteUrl)}${en(o) ? '/en' : ''}/comanda/${o.publicToken}`

function body(t: EmailTemplate, o: Order, ctx: EmailContext): { lead: string; blocks: Block[]; cta?: { label: string; url: string } } {
  if (en(o)) return bodyEn(t, o, ctx)
  const orderUrl = orderPageUrl(o, ctx.siteUrl)
  const first = o.customer.firstName
  const summary = [h(`Comanda #${o.orderNumber}`), rows([['Data', dateRo(o.createdAt)], ['Plată', methodLabel(o)]]), itemsBlock(o)]
  switch (t) {
    case 'order_confirmed':
      return {
        lead: `Mulțumim, ${first}. Plata a fost confirmată și comanda ta este înregistrată.`,
        blocks: [p(`Pregătim coletul în ${terms.processingDays}. Primești un email cu numărul AWB când îl predăm curierului.`), ...summary, ...addressBlock(o)],
        cta: { label: 'Vezi comanda', url: orderUrl },
      }
    case 'cod_confirmed':
      return {
        lead: `Mulțumim, ${first}. Comanda ta este confirmată.`,
        blocks: [
          rows([['De plătit la livrare', fm(o, o.codAmountMinor ?? o.totalMinor)]]),
          p('Plătești curierului când primești coletul. Nu plătești nimic acum.'),
          p(`Pregătim coletul în ${terms.processingDays}. Primești un email cu numărul AWB când îl predăm curierului.`),
          ...summary,
          ...addressBlock(o),
        ],
        cta: { label: 'Vezi comanda', url: orderUrl },
      }
    case 'transfer_instructions':
      return {
        lead: `Mulțumim, ${first}. Comanda ta este înregistrată și așteaptă plata.`,
        blocks: [h('Datele pentru transfer'), ...bankBlock(o, ctx.bank), p('Pregătim coletul imediat ce suma ajunge în cont. Îți scriem când primim plata.'), ...summary, ...addressBlock(o)],
        cta: { label: 'Vezi comanda', url: orderUrl },
      }
    case 'payment_received':
      return {
        lead: `Am primit plata pentru comanda #${o.orderNumber}. Mulțumim, ${first}.`,
        blocks: [p(`Pregătim coletul în ${terms.processingDays}. Primești un email cu numărul AWB când îl predăm curierului.`), ...summary],
        cta: { label: 'Vezi comanda', url: orderUrl },
      }
    case 'invoice_issued':
      return {
        lead: `Factura pentru comanda #${o.orderNumber} este gata.`,
        blocks: [
          rows([
            ['Factura', `${o.fgoInvoiceSeries ?? ''} ${o.fgoInvoiceNumber ?? ''}`.trim()],
            ['Total', fm(o, o.totalMinor)],
          ]),
          p('Păstreaz-o pentru garanție și retur.'),
        ],
        cta: o.fgoInvoiceLink ? { label: 'Descarcă factura', url: o.fgoInvoiceLink } : { label: 'Vezi comanda', url: orderUrl },
      }
    case 'order_shipped':
      return {
        lead: `Comanda ta #${o.orderNumber} este la curier.`,
        blocks: [
          rows([
            ['Curier', o.courier ?? ''],
            ['Număr AWB', o.trackingNumber ?? ''],
            ...(awaitsCollection(o) ? ([['De plătit curierului', fm(o, o.codAmountMinor ?? o.totalMinor)]] as [string, string][]) : []),
          ]),
          ...(o.shippingAddress.country && o.shippingAddress.country !== 'RO' ? [] : [p(`Livrarea durează de obicei ${terms.transitDays}.`)]),
          ...addressBlock(o).slice(0, 2),
        ],
        cta: o.trackingUrl ? { label: 'Urmărește coletul', url: o.trackingUrl } : { label: 'Vezi comanda', url: orderUrl },
      }
    case 'order_cancelled':
      return {
        lead: `Comanda #${o.orderNumber} a fost anulată.`,
        blocks: [
          p(
            o.paymentStatus === 'refunded'
              ? 'Suma plătită ți-a fost returnată pe aceeași cale.'
              : o.paymentStatus === 'paid' || o.paymentStatus === 'partially_refunded'
                ? 'Suma plătită îți este returnată pe aceeași cale. Îți scriem când rambursarea este procesată.'
                : 'Nu ai nimic de plătit pentru această comandă.',
          ),
        ],
      }
    case 'withdrawal_received': {
      const w = ctx.withdrawal
      return {
        lead: `Am primit cererea ta de retragere din contract pentru comanda #${o.orderNumber}.`,
        blocks: [
          p('Aceasta este confirmarea declarației tale, cu conținutul, data și ora la care am primit-o.'),
          rows([
            ['Referință', w?.reference ?? ''],
            ['Primită la', w ? dateTimeRo(w.createdAt) : ''],
            ['Nume', w?.name ?? customerName(o.customer)],
            ['Comanda', o.orderNumber],
            ['Produse', w?.items ?? ''],
            ...(w?.message ? ([['Mesajul tău', w.message]] as [string, string][]) : []),
          ]),
          h('Ce urmează'),
          p('Trimite-ne produsele în cel mult 14 zile de la această cerere. Îți scriem adresa de retur și pașii.'),
          p(`Îți returnăm banii în cel mult 14 zile de la data de mai sus, ${refundWay(o)}. Putem amâna rambursarea până primim produsele sau dovada că le-ai trimis.`),
        ],
      }
    }
    case 'return_received':
      return {
        lead: `Am primit produsele returnate din comanda #${o.orderNumber}.`,
        blocks: [
          p(
            o.paymentStatus === 'refunded'
              ? 'Rambursarea a fost deja procesată. Nu mai ai nimic de făcut.'
              : `Îți returnăm banii ${refundWay(o)}, în cel mult 14 zile de la cererea de retragere. Îți scriem când rambursarea este procesată.`,
          ),
        ],
      }
    case 'transfer_reminder':
      return {
        lead: `Bună, ${first}. Comanda ${o.orderNumber} este înregistrată și așteaptă plata prin transfer bancar.`,
        blocks: [
          rows([['Suma', fm(o, o.totalMinor)]]),
          p('Datele pentru transfer sunt pe pagina comenzii.'),
          p(`Scrie ${o.orderNumber} la detaliile plății. Așa potrivim transferul cu comanda.`),
          p('Ai plătit deja? Ignoră acest mesaj. Îți scriem când primim suma.'),
          p('Te-ai răzgândit? Răspunde la acest email și anulăm comanda.'),
        ],
        cta: { label: 'Văd datele de plată', url: orderUrl },
      }
    case 'delivery_followup':
      return {
        lead: `Bună, ${first}. Sperăm că produsele au ajuns bine.`,
        // The contact line below the message already gives the reply, email and phone options.
        blocks: [p('Ai o întrebare despre folosire sau ceva nu merge cum te aștepți? Te ajutăm să pornești corect.')],
      }
    case 'refund_issued':
      return {
        lead: `Am procesat o rambursare de ${fm(o, o.refundedMinor)} pentru comanda #${o.orderNumber}.`,
        blocks: [
          p(
            o.paymentMethod === 'card'
              ? 'Suma apare pe card în câteva zile lucrătoare, în funcție de bancă.'
              : o.paymentMethod === 'cash_on_delivery'
                ? 'Suma ajunge prin transfer bancar, în contul pe care ni l-ai indicat.'
                : 'Suma ajunge în contul din care ai plătit.',
          ),
        ],
      }
  }
}

/** The same messages in English (orders placed on the English pages; the international site pays by card). */
function bodyEn(t: EmailTemplate, o: Order, ctx: EmailContext): { lead: string; blocks: Block[]; cta?: { label: string; url: string } } {
  const orderUrl = orderPageUrl(o, ctx.siteUrl)
  const first = o.customer.firstName
  const abroad = o.shippingAddress.country && o.shippingAddress.country !== 'RO'
  const packing = abroad ? 'We pack your order within 1-3 days and email you the tracking number when it ships.' : 'We pack your order within 1-3 days. You get an email with the tracking number when it ships.'
  const view = { label: 'View your order', url: orderUrl }
  const summary = [h(`Order #${o.orderNumber}`), rows([['Date', dateEn(o.createdAt)], ['Payment', methodLabel(o)]]), itemsBlock(o)]
  const refundWayEn = o.paymentMethod === 'cash_on_delivery' ? 'by bank transfer, to the account you give us' : 'the same way you paid'
  switch (t) {
    case 'order_confirmed':
      return { lead: `Thank you, ${first}. Your payment is confirmed and your order is placed.`, blocks: [p(packing), ...summary, ...addressBlock(o)], cta: view }
    case 'cod_confirmed':
      return {
        lead: `Thank you, ${first}. Your order is confirmed.`,
        blocks: [rows([['To pay on delivery', fm(o, o.codAmountMinor ?? o.totalMinor)]]), p('You pay the courier when the parcel arrives. Nothing to pay now.'), p(packing), ...summary, ...addressBlock(o)],
        cta: view,
      }
    case 'transfer_instructions': {
      const bank = ctx.bank
      const details = bank
        ? [
            rows([
              ['Beneficiary', bank.beneficiary],
              ['IBAN', bank.iban],
              ['Bank', bank.bank],
              ...(bank.swift ? ([['SWIFT', bank.swift]] as [string, string][]) : []),
              ['Amount', fm(o, o.totalMinor)],
              ['Payment reference', `Order ${o.orderNumber}`],
            ]),
            p(`Write ${o.orderNumber} as the payment reference, so we can match the transfer to your order.`),
          ]
        : [p(`Our team sends you the transfer details separately. Write to ${site.email} if you need them now.`)]
      return { lead: `Thank you, ${first}. Your order is placed and waiting for payment.`, blocks: [h('Bank transfer details'), ...details, p('We pack your order as soon as the payment arrives and let you know.'), ...summary, ...addressBlock(o)], cta: view }
    }
    case 'payment_received':
      return { lead: `We received the payment for order #${o.orderNumber}. Thank you, ${first}.`, blocks: [p(packing), ...summary], cta: view }
    case 'invoice_issued':
      return {
        lead: `The invoice for order #${o.orderNumber} is ready.`,
        blocks: [rows([['Invoice', `${o.fgoInvoiceSeries ?? ''} ${o.fgoInvoiceNumber ?? ''}`.trim()], ['Total', fm(o, o.totalMinor)]]), p('Keep it for the warranty and any return.')],
        cta: o.fgoInvoiceLink ? { label: 'Download the invoice', url: o.fgoInvoiceLink } : view,
      }
    case 'order_shipped':
      return {
        lead: `Your order #${o.orderNumber} is with the courier.`,
        blocks: [
          rows([
            ['Courier', o.courier ?? ''],
            ['Tracking number', o.trackingNumber ?? ''],
            ...(awaitsCollection(o) ? ([['To pay the courier', fm(o, o.codAmountMinor ?? o.totalMinor)]] as [string, string][]) : []),
          ]),
          ...(abroad ? [] : [p('Delivery usually takes 2-5 days.')]),
          ...addressBlock(o).slice(0, 2),
        ],
        cta: o.trackingUrl ? { label: 'Track your parcel', url: o.trackingUrl } : view,
      }
    case 'order_cancelled':
      return {
        lead: `Order #${o.orderNumber} has been cancelled.`,
        blocks: [
          p(
            o.paymentStatus === 'refunded'
              ? 'The amount you paid has been returned the same way you paid.'
              : o.paymentStatus === 'paid' || o.paymentStatus === 'partially_refunded'
                ? 'The amount you paid will be returned the same way you paid. We will email you when the refund is processed.'
                : 'You have nothing to pay for this order.',
          ),
        ],
      }
    case 'withdrawal_received': {
      const w = ctx.withdrawal
      return {
        lead: `We received your withdrawal from the contract for order #${o.orderNumber}.`,
        blocks: [
          p('This confirms your statement, with its content and the date and time we received it.'),
          rows([
            ['Reference', w?.reference ?? ''],
            ['Received on', w ? dateTimeEn(w.createdAt) : ''],
            ['Name', w?.name ?? customerName(o.customer)],
            ['Order', o.orderNumber],
            ['Products', w?.items ?? ''],
            ...(w?.message ? ([['Your message', w.message]] as [string, string][]) : []),
          ]),
          h('What happens next'),
          p('Send the products back within 14 days of this statement. We will email you the return address and the steps.'),
          p(`We refund you within 14 days of the date above, ${refundWayEn}. We may wait for the products, or proof that you sent them, before refunding.`),
        ],
      }
    }
    case 'return_received':
      return {
        lead: `We received the returned products from order #${o.orderNumber}.`,
        blocks: [p(o.paymentStatus === 'refunded' ? 'The refund has already been processed. Nothing else to do.' : `We refund you ${refundWayEn}, within 14 days of your withdrawal. We will email you when the refund is processed.`)],
      }
    case 'transfer_reminder':
      return {
        lead: `Hello ${first}. Order ${o.orderNumber} is placed and waiting for your bank transfer.`,
        blocks: [
          rows([['Amount', fm(o, o.totalMinor)]]),
          p('The transfer details are on the order page.'),
          p(`Write ${o.orderNumber} as the payment reference, so we can match the transfer to your order.`),
          p('Already paid? Please ignore this message. We will email you when the payment arrives.'),
          p('Changed your mind? Reply to this email and we will cancel the order.'),
        ],
        cta: { label: 'See the payment details', url: orderUrl },
      }
    case 'delivery_followup':
      return { lead: `Hello ${first}. We hope your products arrived safely.`, blocks: [p('A question about using them, or something not working as expected? We will help you get started.')] }
    case 'refund_issued':
      return {
        lead: `We processed a refund of ${fm(o, o.refundedMinor)} for order #${o.orderNumber}.`,
        blocks: [
          p(
            o.paymentMethod === 'card'
              ? 'The amount reaches your card within a few working days, depending on your bank.'
              : o.paymentMethod === 'cash_on_delivery'
                ? 'The amount reaches you by bank transfer, to the account you gave us.'
                : 'The amount reaches the account you paid from.',
          ),
        ],
      }
  }
}

export function renderEmail(t: EmailTemplate, o: Order, ctx: EmailContext) {
  const subject = subjectFor(t, o)
  const { lead, blocks, cta } = body(t, o, ctx)
  const support: Block = en(o)
    ? p(`Any questions? Reply to this email, write to ${site.email} or call ${site.phone}. Please mention your order number: ${o.orderNumber}.`)
    : p(`Ai o întrebare? Răspunde la acest email, scrie la ${site.email} sau sună la ${site.phone}. Menționează numărul comenzii: ${o.orderNumber}.`)
  const all = [...blocks, { html: '<div style="height:12px"></div>', text: '' }, support]
  const content = `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0b1316">${esc(lead)}</h1>
${all.map((b) => b.html).join('\n')}
${cta ? `<p style="margin:22px 0 0"><a href="${esc(cta.url)}" style="display:inline-block;background:#d23b3b;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 22px;border-radius:12px">${esc(cta.label)}</a></p>` : ''}`
  const html = emailShell({ subject, content, siteUrl: siteOrigin(o.site, ctx.siteUrl), locale: o.locale })
  const text = [lead, '', ...all.map((b) => b.text).filter(Boolean), ...(cta ? ['', `${cta.label}: ${cta.url}`] : []), '', `${site.name} · ${site.email} · ${site.phone}`].join('\n')
  return { subject, html, text }
}
