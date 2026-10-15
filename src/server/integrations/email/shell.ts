/**
 * The frame every email from the site shares with the launch campaign: the trust strip, the wordmark with the
 * three products, a white card, and the grey footer with the company. Only the frame: each message keeps its
 * own short content (no photos, no offers in transactional emails).
 */
import { site, terms } from '@/config/site'
import { companyLine } from '@/config/company'

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const WORDMARK = 'BIOHACK <span style="color:#0e7490">TECH</span>'

export function emailShell(x: { subject: string; content: string; siteUrl?: string; footer?: string; locale?: 'ro' | 'en' }) {
  const en = x.locale === 'en'
  const url = (x.siteUrl ?? site.url).replace(/\/$/, '')
  const base = `${url}${en ? '/en' : ''}`
  const nav = (['calm', 'focus', 'amber'] as const)
    .map((p) => `<a href="${esc(`${base}/products/${p}`)}" target="_blank" style="color:#27343a;text-decoration:none">${p[0].toUpperCase()}${p.slice(1)}</a>`)
    .join(' &nbsp;&nbsp; ')
  const company = companyLine()
  return `<!doctype html><html lang="${en ? 'en' : 'ro'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(x.subject)}</title></head>
<body style="margin:0;padding:0;background:#f2f5f6;font-family:${FONT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f5f6"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td style="background:#0b1316;padding:9px 16px;text-align:center;font-family:${FONT};font-size:12px;color:#cfd8db">${esc(en ? `Free delivery · ${terms.returnDays}-day returns · ${terms.warrantyYears}-year warranty` : `Livrare gratuită · Retur în ${terms.returnDays} zile · Garanție ${terms.warrantyYears} ani`)}</td></tr>
<tr><td style="padding:18px 32px;border-bottom:1px solid #e8edef"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-family:${FONT};font-size:16px;font-weight:800;letter-spacing:.5px;color:#0b1316"><a href="${esc(url)}" target="_blank" style="color:#0b1316;text-decoration:none">${WORDMARK}</a></td>
<td align="right" style="font-family:${FONT};font-size:14px;font-weight:500">${nav}</td></tr></table></td></tr>
<tr><td style="padding:28px 32px 30px;font-family:${FONT}">
${x.content}
<p style="margin:24px 0 0;font-size:16px;line-height:1.6;color:#27343a">${en ? 'Best regards,<br><b style="color:#0b1316">The Biohack Tech team</b>' : 'Cu drag,<br><b style="color:#0b1316">Echipa Biohack Tech</b>'}</p>
</td></tr>
<tr><td style="background:#f2f5f6;padding:22px 32px 26px;text-align:center;font-family:${FONT};font-size:12px;line-height:1.7;color:#8a969c">
<div style="font-size:13px;font-weight:800;letter-spacing:.5px;color:#0b1316;padding-bottom:6px">${WORDMARK}</div>
${x.footer ? `${x.footer}<br>` : ''}${esc(site.email)} · ${esc(site.phone)}<br>
<a href="${esc(`${base}/terms-of-service`)}" target="_blank" style="color:#8a969c">${en ? 'Terms and conditions' : 'Termeni și condiții'}</a> · <a href="${esc(`${base}/privacy-policy`)}" target="_blank" style="color:#8a969c">${en ? 'Privacy' : 'Confidențialitate'}</a>${company ? `<br>${esc(company)}` : ''}
</td></tr>
</table>
</td></tr></table></body></html>`
}
