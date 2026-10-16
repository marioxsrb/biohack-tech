/**
 * The abandoned-cart sequence (three emails about a day apart, our own SMTP): the cart as it was left (photo,
 * frame, quantity, today's price and total), the recovery code (BIOHACK10, filled in by the button's link) and a
 * button back to the order. Commercial communication: sent only with email marketing consent, checked by the
 * caller at sending time, always with the unsubscribe link. No countdown, no invented scarcity.
 */
import 'server-only'
import { site, terms } from '@/config/site'
import { companyLine } from '@/config/company'
import { emailShell, esc } from './integrations/email/shell'

export type CartEmailItem = { name: string; variant: string | null; quantity: number; lineMinor: number; image: string | null }

export type CartEmail = {
  step: 1 | 2 | 3
  locale: 'ro' | 'en'
  firstName: string | null
  items: CartEmailItem[]
  /** Today's total with the automatic promotions and the delivery, before the code; null hides it. */
  totalMinor: number | null
  /** The cart holds the book: its delivery fee (0 or absent = free delivery, as for every other cart). */
  shippingMinor?: number
  format: (minor: number) => string
  /** The recovery code and its percentage, when one is active. */
  code: { code: string; percent: number } | null
  link: string
  siteUrl: string
  unsubscribeUrl: string
}

const COPY = {
  ro: {
    hello: (n: string | null) => (n ? `Bună, ${n}!` : 'Bună!'),
    subject: (what: string, code: string | null) => [
      `Produsele tale te așteaptă în coș`,
      `Ai întrebări despre ${what}? Suntem aici`,
      code ? `Ultima amintire: codul tău ${code} pentru ${what}` : `Ultima amintire despre coșul tău`,
    ],
    lead: [
      'Ai început o comandă și ai lăsat câteva lucruri frumoase în coș. Le-am păstrat pentru tine, exact cum le-ai ales.',
      'Știm că o alegere bună se face fără grabă. Dacă te-a oprit o întrebare, iată pe scurt ce primești când comanzi de la noi.',
      'Ne-am gândit că poate a fost doar o zi aglomerată. Acesta e ultimul nostru email despre coșul tău, nu te mai deranjăm după el.',
    ],
    yourCart: 'Coșul tău',
    qty: 'Cantitate',
    total: 'Total, cu promoțiile din coș',
    codeTitle: 'CODUL TĂU',
    codeLine: (p: number) => `${p}% reducere din prețul întreg, peste promoțiile din coș`,
    codeHint: 'Apasă butonul și codul este deja completat în comandă.',
    cta: ['Finalizează comanda', 'Mă întorc la coș', 'Finalizează comanda'],
    trust: [`Livrare gratuită`, `Retur în ${terms.returnDays} zile`, `Garanție ${terms.warrantyYears} ani`, 'Plătești cum vrei'],
    faq: [
      ['Livrare', 'Gratuită, prin curier. Comanda pleacă în 1-3 zile și ajunge la tine în 2-5 zile.'],
      ['Plata', 'Cu cardul pe site, prin transfer bancar sau ramburs, la curier.'],
      ['Dacă te răzgândești', `Ai ${terms.returnDays} zile să returnezi produsul. Și ai garanție ${terms.warrantyYears} ani.`],
    ],
    help: `Ai o întrebare? Răspunde la acest email sau sună-ne la ${site.phone}. Te ajutăm cu drag.`,
    footer: 'Primești acest email pentru că ai acceptat emailuri de la Biohack Tech.',
    unsubscribe: 'Dezabonare',
    unsubscribeText: 'Te poți dezabona oricând',
    team: 'Echipa Biohack Tech',
  },
  en: {
    hello: (n: string | null) => (n ? `Hello ${n}!` : 'Hello!'),
    subject: (what: string, code: string | null) => [
      `Your cart is waiting for you`,
      `Questions about ${what}? We are here`,
      code ? `A last reminder: your code ${code} for ${what}` : `A last reminder about your cart`,
    ],
    lead: [
      'You started an order and left a few lovely things in your cart. We kept them for you, exactly as you chose them.',
      'A good choice is never rushed. If a question stopped you, here is in short what you get when you order from us.',
      'Maybe it was just a busy day. This is our last email about your cart; we will not bother you after it.',
    ],
    yourCart: 'Your cart',
    qty: 'Quantity',
    total: 'Total, with the cart promotions',
    codeTitle: 'YOUR CODE',
    codeLine: (p: number) => `${p}% off the full price, on top of the cart promotions`,
    codeHint: 'Press the button and the code is already filled in at checkout.',
    cta: ['Complete my order', 'Back to my cart', 'Complete my order'],
    trust: ['Free delivery', `${terms.returnDays}-day returns`, `${terms.warrantyYears}-year warranty`, 'Secure card payment'],
    faq: [
      ['Delivery', 'Free, by courier, wherever you are.'],
      ['Payment', 'By card on the website, securely through Stripe.'],
      ['If you change your mind', `You have ${terms.returnDays} days to return the product, and a ${terms.warrantyYears}-year warranty.`],
    ],
    help: `Have a question? Reply to this email or call us at ${site.phone}. We are happy to help.`,
    footer: 'You get this email because you accepted emails from Biohack Tech.',
    unsubscribe: 'Unsubscribe',
    unsubscribeText: 'You can unsubscribe at any time',
    team: 'The Biohack Tech team',
  },
} as const

const INK = '#0b1316'
const TEXT = '#27343a'
const MUTED = '#5a6870'

export function renderCartRecovery(x: CartEmail) {
  // A cart with the book pays its delivery fee once: the email never says "free delivery" for it.
  const paid = (x.shippingMinor ?? 0) > 0
  const base = COPY[x.locale]
  const delivery = paid ? (x.locale === 'en' ? `Delivery: ${x.format(x.shippingMinor!)}` : `Livrare: ${x.format(x.shippingMinor!)}`) : base.trust[0]
  const t = {
    ...base,
    trust: [delivery, ...base.trust.slice(1)],
    faq: paid
      ? base.faq.map(([q, a], n) =>
          n === 0 ? [q, x.locale === 'en' ? `By courier. Your cart has the book, so one delivery fee applies (${x.format(x.shippingMinor!)}), once per order.` : `Prin curier. Coșul conține cartea, așa că livrarea costă ${x.format(x.shippingMinor!)}, o singură dată pe comandă.`] : [q, a],
        )
      : base.faq,
    total: paid ? (x.locale === 'en' ? 'Total, with the cart promotions and delivery' : 'Total, cu promoțiile din coș și livrarea') : base.total,
  }
  const what = [...new Set(x.items.map((i) => i.name))].join(', ') || (x.locale === 'en' ? 'your products' : 'produsele tale')
  const i = x.step - 1
  const subject = t.subject(what, x.code?.code ?? null)[i]
  const hello = t.hello(x.firstName)
  const p = (s: string, style = '') => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${TEXT};${style}">${esc(s)}</p>`

  const rows = x.items
    .map(
      (it) => `<tr>
<td width="96" style="padding:12px 0;border-bottom:1px solid #e8edef;vertical-align:middle">${
        it.image
          ? `<img src="${esc(it.image)}" width="84" height="84" alt="${esc(it.name)}" style="display:block;width:84px;height:84px;object-fit:contain;border-radius:14px;background:#f2f5f6">`
          : `<div style="width:84px;height:84px;border-radius:14px;background:#f2f5f6"></div>`
      }</td>
<td style="padding:12px 0 12px 14px;border-bottom:1px solid #e8edef;vertical-align:middle">
<div style="font-size:16px;font-weight:700;color:${INK}">${esc(it.name)}</div>
${it.variant ? `<div style="font-size:14px;color:${MUTED};padding-top:2px">${esc(it.variant)}</div>` : ''}
<div style="font-size:14px;color:${MUTED};padding-top:2px">${esc(t.qty)}: ${it.quantity}</div>
</td>
<td align="right" style="padding:12px 0;border-bottom:1px solid #e8edef;vertical-align:middle;font-size:16px;font-weight:600;color:${INK};white-space:nowrap">${esc(x.format(it.lineMinor))}</td>
</tr>`,
    )
    .join('\n')
  const cart = `<div style="margin:8px 0 20px;padding:4px 18px 8px;border:1px solid #e8edef;border-radius:18px">
<div style="font-size:13px;font-weight:700;letter-spacing:.6px;color:${MUTED};padding:12px 0 2px">${esc(t.yourCart.toUpperCase())}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}
${x.totalMinor !== null ? `<tr><td colspan="2" style="padding:14px 0 6px;font-size:14px;color:${MUTED}">${esc(t.total)}</td><td align="right" style="padding:14px 0 6px;font-size:18px;font-weight:800;color:${INK};white-space:nowrap">${esc(x.format(x.totalMinor))}</td></tr>` : ''}
</table></div>`

  const code = x.code
    ? `<div style="margin:4px 0 20px;padding:18px;border:1px dashed #0e7490;border-radius:16px;background:#f2f9fb;text-align:center">
<div style="font-size:12px;color:${MUTED};letter-spacing:.8px">${esc(t.codeTitle)}</div>
<div style="font-size:28px;font-weight:800;letter-spacing:3px;color:${INK};padding:4px 0">${esc(x.code.code)}</div>
<div style="font-size:14px;color:${TEXT}">${esc(t.codeLine(x.code.percent))}</div>
<div style="font-size:13px;color:${MUTED};padding-top:6px">${esc(t.codeHint)}</div>
</div>`
    : ''

  const button = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:4px 0 8px">
<a href="${esc(x.link)}" target="_blank" style="display:inline-block;background:#d23b3b;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 30px;border-radius:14px">${esc(t.cta[i])} &rarr;</a>
</td></tr></table>`

  const trust = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 4px"><tr>${t.trust
    .map((s) => `<td align="center" style="padding:10px 4px;font-size:13px;font-weight:600;color:${TEXT};background:#f2f5f6;border-radius:12px;border:3px solid #ffffff">${esc(s)}</td>`)
    .join('')}</tr></table>`

  const faq =
    x.step === 2
      ? `<div style="margin:0 0 18px">${t.faq
          .map(([q, a]) => `<div style="padding:10px 0;border-bottom:1px solid #e8edef"><div style="font-size:15px;font-weight:700;color:${INK}">${esc(q)}</div><div style="font-size:15px;line-height:1.55;color:${TEXT};padding-top:2px">${esc(a)}</div></div>`)
          .join('')}</div>`
      : ''

  const content = `<h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;color:${INK}">${esc(hello)}</h1>
${p(t.lead[i])}
${x.step === 2 ? faq + cart : cart}
${code}
${button}
${trust}
${p(t.help, 'margin:18px 0 0;font-size:15px')}`

  const html = emailShell({
    subject,
    content,
    siteUrl: x.siteUrl,
    locale: x.locale,
    footer: `${esc(t.footer)} <a href="${esc(x.unsubscribeUrl)}" style="color:#8a969c">${esc(t.unsubscribe)}</a>`,
  })
  const company = companyLine()
  const text = [
    hello,
    '',
    t.lead[i],
    '',
    ...(x.step === 2 ? [...t.faq.map(([q, a]) => `${q}: ${a}`), ''] : []),
    `${t.yourCart}:`,
    ...x.items.map((it) => `- ${it.quantity} × ${it.name}${it.variant ? ` (${it.variant})` : ''}: ${x.format(it.lineMinor)}`),
    ...(x.totalMinor !== null ? [`${t.total}: ${x.format(x.totalMinor)}`] : []),
    '',
    ...(x.code ? [`${t.codeTitle}: ${x.code.code} (${t.codeLine(x.code.percent)})`, t.codeHint, ''] : []),
    `${t.cta[i]}: ${x.link}`,
    '',
    t.help,
    '',
    t.team,
    '',
    `${t.footer} ${t.unsubscribeText}: ${x.unsubscribeUrl}`,
    ...(company ? [company] : []),
  ].join('\n')
  return { subject, html, text }
}
