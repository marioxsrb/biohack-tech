/**
 * Transactional emails, rendered by us from the canonical order and delivered by the
 * configured transport (GoHighLevel in production). One data contract, six templates.
 * Plain Romanian, one idea per sentence, no marketing blocks. Every email also has a
 * plain-text version.
 */
import { site, terms } from '@/config/site'
import type { BankConfig } from '@/server/config'
import { customerName, formatAddress, PAYMENT_METHOD_LABEL, type Order } from '@/server/orders/model'
import { awaitsCollection } from '@/server/orders/state'
import { formatLei } from '@/lib/money'

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
}

/** The withdrawal statement being acknowledged (withdrawal_received only). */
export type WithdrawalStatement = { reference: string; name: string; items: string; message: string; createdAt: Date }
export type EmailContext = { siteUrl: string; bank: BankConfig | null; withdrawal?: WithdrawalStatement }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const dateTimeRo = (d: Date) =>
  d.toLocaleString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' })
const dateRo = (d: Date) => d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Bucharest' })

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
      (l) => `<tr><td style="padding:10px 0;border-top:1px solid #e8edef;font-size:15px;color:#0b1316">${esc(`${l.qty} x ${l.name}`)}${l.variant ? `<br><span style="color:#5a6870;font-size:14px">${esc(l.variant)}</span>` : ''}${l.qty > 1 ? `<br><span style="color:#5a6870;font-size:13px">${esc(formatLei(l.unit))} / buc.</span>` : ''}</td><td align="right" style="padding:10px 0;border-top:1px solid #e8edef;font-size:15px;color:#0b1316;white-space:nowrap;vertical-align:top">${esc(formatLei(l.total))}</td></tr>`,
    )
    .join('')}
    <tr><td style="padding:8px 0;border-top:1px solid #e8edef;font-size:14px;color:#5a6870">Subtotal</td><td align="right" style="padding:8px 0;border-top:1px solid #e8edef;font-size:14px;color:#0b1316">${esc(formatLei(o.subtotalMinor))}</td></tr>
    ${o.promotions
      .map(
        (pr) =>
          `<tr><td style="padding:4px 0;font-size:14px;color:#0e7490">${esc(pr.label)}</td><td align="right" style="padding:4px 0;font-size:14px;color:#0e7490;white-space:nowrap">${esc(`-${formatLei(pr.amountMinor)}`)}</td></tr>`,
      )
      .join('')}
    <tr><td style="padding:4px 0;font-size:14px;color:#5a6870">Livrare</td><td align="right" style="padding:4px 0;font-size:14px;color:#0b1316">${o.shippingMinor ? esc(formatLei(o.shippingMinor)) : 'Gratuită'}</td></tr>
    <tr><td style="padding:10px 0;border-top:1px solid #e8edef;font-size:16px;font-weight:700;color:#0b1316">Total</td><td align="right" style="padding:10px 0;border-top:1px solid #e8edef;font-size:17px;font-weight:700;color:#0b1316">${esc(formatLei(o.totalMinor))}</td></tr>
  </table><p style="margin:4px 0 0;font-size:12px;color:#5a6870;text-align:right">${esc(terms.vat)}</p>`
  const text = [
    ...lines.map((l) => `${l.qty} x ${l.name}${l.variant ? ` (${l.variant})` : ''}: ${formatLei(l.total)}`),
    `Subtotal: ${formatLei(o.subtotalMinor)}`,
    ...o.promotions.map((pr) => `${pr.label}: -${formatLei(pr.amountMinor)}`),
    `Livrare: ${o.shippingMinor ? formatLei(o.shippingMinor) : 'Gratuită'}`,
    `Total: ${formatLei(o.totalMinor)} (${terms.vat})`,
  ].join('\n')
  return { html, text }
}

function addressBlock(o: Order): Block[] {
  const billing = o.customer.buyerType === 'pj' ? `${o.customer.company}, CUI ${o.customer.cui}, ${formatAddress(o.billingAddress)}` : formatAddress(o.billingAddress)
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
      ['Suma', formatLei(o.totalMinor)],
      ['Detalii plată', `Comanda ${o.orderNumber}`],
    ]),
    p(`Scrie ${o.orderNumber} la detaliile plății. Așa potrivim transferul cu comanda ta.`),
  ]
}

/** How the money goes back: the same way, except cash paid to the courier, which comes back by bank transfer. */
const refundWay = (o: Order) =>
  o.paymentMethod === 'cash_on_delivery' ? 'prin transfer bancar, în contul pe care ni-l indici' : 'pe aceeași cale prin care ai plătit'

function body(t: EmailTemplate, o: Order, ctx: EmailContext): { lead: string; blocks: Block[]; cta?: { label: string; url: string } } {
  const orderUrl = `${ctx.siteUrl}/comanda/${o.publicToken}`
  const first = o.customer.firstName
  const summary = [h(`Comanda #${o.orderNumber}`), rows([['Data', dateRo(o.createdAt)], ['Plată', PAYMENT_METHOD_LABEL[o.paymentMethod]]]), itemsBlock(o)]
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
          rows([['De plătit la livrare', formatLei(o.codAmountMinor ?? o.totalMinor)]]),
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
            ['Total', formatLei(o.totalMinor)],
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
            ...(awaitsCollection(o) ? ([['De plătit curierului', formatLei(o.codAmountMinor ?? o.totalMinor)]] as [string, string][]) : []),
          ]),
          p(`Livrarea durează de obicei ${terms.transitDays}.`),
          ...addressBlock(o).slice(0, 2),
        ],
        cta: o.trackingUrl ? { label: 'Urmărește coletul', url: o.trackingUrl } : { label: 'Vezi comanda', url: orderUrl },
      }
    case 'order_cancelled':
      return {
        lead: `Comanda #${o.orderNumber} a fost anulată.`,
        blocks: [
          p(o.paymentStatus === 'paid' || o.paymentStatus === 'partially_refunded' ? 'Suma plătită îți este returnată pe aceeași cale. Îți scriem când rambursarea este procesată.' : 'Nu ai nimic de plătit pentru această comandă.'),
          p(`Pentru orice întrebare, scrie-ne la ${site.email}.`),
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
          p(`Pentru orice întrebare, scrie-ne la ${site.email}.`),
        ],
      }
    case 'refund_issued':
      return {
        lead: `Am procesat o rambursare de ${formatLei(o.refundedMinor)} pentru comanda #${o.orderNumber}.`,
        blocks: [
          p(
            o.paymentMethod === 'card'
              ? 'Suma apare pe card în câteva zile lucrătoare, în funcție de bancă.'
              : o.paymentMethod === 'cash_on_delivery'
                ? 'Suma ajunge prin transfer bancar, în contul pe care ni l-ai indicat.'
                : 'Suma ajunge în contul din care ai plătit.',
          ), p(`Pentru orice întrebare, scrie-ne la ${site.email}.`)],
      }
  }
}

export function renderEmail(t: EmailTemplate, o: Order, ctx: EmailContext) {
  const subject = EMAIL_TEMPLATES[t].subject(o)
  const { lead, blocks, cta } = body(t, o, ctx)
  const support: Block = p(`Ai o întrebare? Răspunde la acest email, scrie la ${site.email} sau sună la ${site.phone}. Menționează numărul comenzii: ${o.orderNumber}.`)
  const all = [...blocks, { html: '<div style="height:12px"></div>', text: '' }, support]
  const html = `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f2f5f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f5f6"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px">
<tr><td style="padding:28px 28px 0"><p style="margin:0;font-size:14px;font-weight:700;letter-spacing:.06em;color:#0b1316">BIOHACK <span style="color:#0e7490">TECH</span></p></td></tr>
<tr><td style="padding:20px 28px 28px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0b1316">${esc(lead)}</h1>
${all.map((b) => b.html).join('\n')}
${cta ? `<p style="margin:22px 0 0"><a href="${esc(cta.url)}" style="display:inline-block;background:#d23b3b;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 22px;border-radius:10px">${esc(cta.label)}</a></p>` : ''}
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:#5a6870">${esc(site.name)} · ${esc(site.email)} · ${esc(site.phone)}</p>
</td></tr></table></body></html>`
  const text = [lead, '', ...all.map((b) => b.text).filter(Boolean), ...(cta ? ['', `${cta.label}: ${cta.url}`] : []), '', `${site.name} · ${site.email} · ${site.phone}`].join('\n')
  return { subject, html, text }
}
