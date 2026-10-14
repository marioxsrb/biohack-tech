/**
 * The recovery email for a lead: commercial communication, sent only with email marketing consent (checked
 * by the caller at sending time). It names the product, links back to the customer's own selection on the
 * funnel they came from, and carries the unsubscribe link. No price (the page shows the current one), no
 * invented discount, no countdown.
 */
import 'server-only'
import { site } from '@/config/site'
import { companyLine } from '@/config/company'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function renderLeadRecovery(x: { step: 1 | 2; firstName: string | null; products: string[]; abandonment: 'lead_abandoned' | 'checkout_abandoned'; link: string; unsubscribeUrl: string }) {
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
  const html = `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f2f5f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f5f6"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px">
<tr><td style="padding:28px 28px 0"><p style="margin:0;font-size:14px;font-weight:700;letter-spacing:.06em;color:#0b1316">BIOHACK <span style="color:#0e7490">TECH</span></p></td></tr>
<tr><td style="padding:20px 28px 28px">
${lines.map((l, i) => (i === 0 ? `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0b1316">${esc(l)}</h1>` : `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#27343a">${esc(l)}</p>`)).join('\n')}
<p style="margin:22px 0 0"><a href="${esc(x.link)}" style="display:inline-block;background:#d23b3b;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 22px;border-radius:10px">${esc(cta)}</a></p>
<p style="margin:22px 0 0;font-size:15px;color:#27343a">Echipa Biohack Tech</p>
</td></tr></table>
<p style="margin:16px 0 0;max-width:560px;font-size:12px;line-height:1.5;color:#5a6870">Primești acest email pentru că ai acceptat emailuri de la Biohack Tech. <a href="${esc(x.unsubscribeUrl)}" style="color:#5a6870">Dezabonare</a>${company ? `<br>${esc(company)}` : ''}</p>
</td></tr></table></body></html>`
  return { subject, html, text }
}
