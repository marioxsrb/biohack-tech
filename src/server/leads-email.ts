/**
 * The recovery email for a lead: commercial communication, sent only with email marketing consent (checked
 * by the caller at sending time). It names the product, links back to the customer's own selection on the
 * funnel they came from, and carries the unsubscribe link. No price (the page shows the current one), no
 * invented discount, no countdown.
 */
import 'server-only'
import { site } from '@/config/site'
import { companyLine } from '@/config/company'
import { emailShell, esc } from './integrations/email/shell'

export function renderLeadRecovery(x: { step: 1 | 2; firstName: string | null; products: string[]; abandonment: 'lead_abandoned' | 'checkout_abandoned'; link: string; unsubscribeUrl: string; locale?: 'ro' | 'en'; siteUrl?: string }) {
  if (x.locale === 'en') return renderLeadRecoveryEn(x)
  const what = x.products.length ? x.products.join(', ') : 'produsele alese'
  const hello = x.firstName ? `Bună, ${x.firstName}.` : 'Bună.'
  const subject = x.step === 1 ? (x.abandonment === 'checkout_abandoned' ? `Comanda ta ${what} te așteaptă` : `${what}: oferta pe care ai văzut-o`) : `Te putem ajuta cu ${what}?`
  const lines =
    x.step === 1
      ? [
          hello,
          x.abandonment === 'checkout_abandoned' ? `Ai început o comandă pentru ${what}, dar nu ai finalizat-o.` : `Ai văzut prețul și oferta pentru ${what}.`,
          'Am păstrat alegerea ta. O poți relua de aici, cu prețul și oferta din magazin în acest moment.',
        ]
      : [hello, `Dacă ai o întrebare despre ${what} înainte să comanzi, răspunde la acest email sau sună la ${site.phone}. Te ajutăm să alegi.`]
  const cta = x.abandonment === 'checkout_abandoned' ? 'Reiau comanda' : 'Văd oferta'
  const footer = `Primești acest email pentru că ai acceptat emailuri de la Biohack Tech. Te poți dezabona oricând: ${x.unsubscribeUrl}`
  const company = companyLine()
  const text = [...lines, '', `${cta}: ${x.link}`, '', 'Echipa Biohack Tech', '', footer, ...(company ? [company] : [])].join('\n')
  const content = `${lines.map((l, i) => (i === 0 ? `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0b1316">${esc(l)}</h1>` : `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#27343a">${esc(l)}</p>`)).join('\n')}
<p style="margin:22px 0 0"><a href="${esc(x.link)}" style="display:inline-block;background:#d23b3b;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 22px;border-radius:12px">${esc(cta)}</a></p>`
  const html = emailShell({ subject, content, footer: `Primești acest email pentru că ai acceptat emailuri de la Biohack Tech. <a href="${esc(x.unsubscribeUrl)}" style="color:#8a969c">Dezabonare</a>` })
  return { subject, html, text }
}

/** The same reminder in English (the international site, or the English pages). */
function renderLeadRecoveryEn(x: { step: 1 | 2; firstName: string | null; products: string[]; abandonment: 'lead_abandoned' | 'checkout_abandoned'; link: string; unsubscribeUrl: string; siteUrl?: string }) {
  const what = x.products.length ? x.products.join(', ') : 'the products you chose'
  const hello = x.firstName ? `Hello ${x.firstName}.` : 'Hello.'
  const subject = x.step === 1 ? (x.abandonment === 'checkout_abandoned' ? `Your ${what} order is waiting` : `${what}: the offer you looked at`) : `Can we help with ${what}?`
  const lines =
    x.step === 1
      ? [
          hello,
          x.abandonment === 'checkout_abandoned' ? `You started an order for ${what} but did not finish it.` : `You looked at the price and offer for ${what}.`,
          'We kept your selection. You can pick it up from here, at the price and offer in the store right now.',
        ]
      : [hello, `If you have a question about ${what} before you order, reply to this email or call ${site.phone}. We will help you choose.`]
  const cta = x.abandonment === 'checkout_abandoned' ? 'Finish my order' : 'See the offer'
  const footer = `You get this email because you accepted emails from Biohack Tech. You can unsubscribe at any time: ${x.unsubscribeUrl}`
  const company = companyLine()
  const text = [...lines, '', `${cta}: ${x.link}`, '', 'The Biohack Tech team', '', footer, ...(company ? [company] : [])].join('\n')
  const content = `${lines.map((l, i) => (i === 0 ? `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0b1316">${esc(l)}</h1>` : `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#27343a">${esc(l)}</p>`)).join('\n')}
<p style="margin:22px 0 0"><a href="${esc(x.link)}" style="display:inline-block;background:#d23b3b;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 22px;border-radius:12px">${esc(cta)}</a></p>`
  const html = emailShell({ subject, content, siteUrl: x.siteUrl, locale: 'en', footer: `You get this email because you accepted emails from Biohack Tech. <a href="${esc(x.unsubscribeUrl)}" style="color:#8a969c">Unsubscribe</a>` })
  return { subject, html, text }
}
