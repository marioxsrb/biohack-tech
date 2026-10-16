/**
 * The email with the book's PDF link (our own SMTP mailbox, the shared email frame). The wording is the one approved
 * for the launch (16.10.2026), personalised with the customer's first name; the link works 7 days, and the order page
 * always gives a fresh one. English for orders placed in English.
 */
import 'server-only'
import { site } from '@/config/site'
import type { Order } from '@/server/orders/model'
import { emailShell, esc } from '@/server/integrations/email/shell'

export const DIGITAL_SUBJECT = { ro: 'Cartea ta digitală BiohackTech este pregătită', en: 'Your BiohackTech digital book is ready' } as const

export type DigitalEmailInput = {
  order: Pick<Order, 'orderNumber' | 'customer' | 'locale'>
  link: string
  /** The order page (a fresh link at any time). */
  orderUrl: string
  /** Absolute URL of the cover, or null. */
  coverUrl: string | null
  siteUrl: string
  expiresAt: Date
}

const INK = '#0b1316'
const TEXT = '#27343a'
const MUTED = '#5a6870'
const GOLD = '#a07a2c'

export function renderDigitalEmail(x: DigitalEmailInput) {
  const en = x.order.locale === 'en'
  const first = x.order.customer.firstName.trim()
  const subject = DIGITAL_SUBJECT[en ? 'en' : 'ro']
  const until = x.expiresAt.toLocaleDateString(en ? 'en-GB' : 'ro-RO', { day: 'numeric', month: 'long', timeZone: 'Europe/Bucharest' })
  const t = en
    ? {
        hello: first ? `Hello, ${first}!` : 'Hello!',
        paid: 'The payment for your order has been confirmed.',
        now: 'You can now download the digital version of the book «Știu. Vreau. DE CE NU POT?».',
        button: 'Download PDF',
        physical: 'The print book will be delivered separately.',
        enjoy: 'Happy reading!',
        team: 'The BiohackTech team',
        validity: `The link works until ${until}. For a new one, open your order page: ${x.orderUrl}`,
        orderLabel: `Order ${x.order.orderNumber}`,
        author: 'Diana L. Palotaș',
        subtitle: 'The answer is in the brain',
        help: `Trouble downloading? Reply to this email or write to ${site.email}.`,
      }
    : {
        hello: first ? `Bună, ${first}!` : 'Bună!',
        paid: 'Plata pentru comanda ta a fost confirmată.',
        now: 'Poți descărca acum versiunea digitală a cărții «Știu. Vreau. DE CE NU POT?».',
        button: 'Descarcă PDF',
        physical: 'Cartea fizică va fi livrată separat.',
        enjoy: 'Lectură plăcută!',
        team: 'Echipa BiohackTech',
        validity: `Linkul funcționează până pe ${until}. Pentru unul nou, deschide pagina comenzii: ${x.orderUrl}`,
        orderLabel: `Comanda ${x.order.orderNumber}`,
        author: 'Diana L. Palotaș',
        subtitle: 'Răspunsul este în creier',
        help: `Nu reușești să descarci? Răspunde la acest email sau scrie-ne la ${site.email}.`,
      }
  const p = (s: string, style = '') => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${TEXT};${style}">${esc(s)}</p>`
  const book = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px;background:#f7f3ec;border-radius:18px"><tr>
${x.coverUrl ? `<td width="112" style="padding:20px 0 20px 20px;vertical-align:middle"><img src="${esc(x.coverUrl)}" width="92" alt="Știu. Vreau. DE CE NU POT?" style="display:block;width:92px;height:auto;border-radius:4px;box-shadow:0 10px 24px rgba(11,19,22,.25)"></td>` : ''}
<td style="padding:20px;vertical-align:middle">
<div style="font-size:12px;font-weight:700;letter-spacing:1px;color:${GOLD}">${esc(t.author.toUpperCase())}</div>
<div style="font-size:21px;line-height:1.25;font-weight:800;color:${INK};padding:4px 0 2px">Știu. Vreau. DE CE NU POT?</div>
<div style="font-size:14px;color:${MUTED}">${esc(t.subtitle)}</div>
</td></tr></table>`
  const button = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px"><tr><td>
<a href="${esc(x.link)}" target="_blank" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 28px;border-radius:14px">${esc(t.button)} &darr;</a>
</td></tr></table>`
  // The team's signature is part of the approved text, so the frame's own sign-off is not repeated.
  const content = `<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:${INK}">${esc(t.hello)}</h1>
${p(t.paid)}
${p(t.now)}
${book}
${button}
${p(t.physical)}
${p(t.enjoy, 'margin:0 0 4px')}
${p(t.team, `font-weight:700;color:${INK}`)}
<p style="margin:22px 0 0;padding-top:16px;border-top:1px solid #e8edef;font-size:13px;line-height:1.6;color:${MUTED}">${esc(t.orderLabel)} · ${esc(t.validity)}<br>${esc(t.help)}</p>`
  const html = emailShell({ subject, content, siteUrl: x.siteUrl, locale: en ? 'en' : 'ro', paidDelivery: true, signOff: false })
  const text = [t.hello, '', t.paid, '', t.now, '', `${t.button}: ${x.link}`, '', t.physical, '', t.enjoy, t.team, '', `${t.orderLabel} · ${t.validity}`, t.help].join('\n')
  return { subject, html, text }
}
