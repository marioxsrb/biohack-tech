/**
 * The website's 10% popup (main site and landings): an address typed there gets the code
 * LONGEVITY10 by email, once. Sending the address is the email marketing consent the popup states (its own text
 * version, source "popup"); AI calls are never implied. The email goes out through the outbox.
 */
import 'server-only'
import { companyLine } from '@/config/company'
import { randomBytes, randomInt } from 'node:crypto'
import { WELCOME_CODE, WELCOME_GIFTS, type WelcomeGift } from '@/config/promotions'
import { WELCOME_CONSENT_TEXT } from '@/lib/consent/marketing'
import type { Queryable } from '@/server/db'
import { emailShell, esc } from '@/server/integrations/email/shell'
import { jobs } from '@/server/jobs/outbox'
import { marketing } from '@/server/marketing/consent'
import type { LandingSlug } from '@/lib/landing-hosts'
import { popupProduct, popupVoucher, popupVouchersOn } from '@/server/popup-vouchers'

export { WELCOME_CONSENT_TEXT }

/** The landing sequences sent by GoHighLevel on the Shopify store (27.10.2026): off unless LANDING_GHL_SEQUENCES=on. */
export const landingGhlSequencesOn = (env: Record<string, string | undefined> = process.env) => env.LANDING_GHL_SEQUENCES === 'on'

const GIFT_IDS: WelcomeGift[] = ['p10', 'p1233', 'lei100']

/** Opens a box: the server draws the gift (one in three each) and keeps it under a random id until an address claims it. */
export async function drawGift(t: Queryable): Promise<{ id: string; gift: WelcomeGift }> {
  const id = randomBytes(12).toString('base64url')
  const gift = GIFT_IDS[randomInt(GIFT_IDS.length)]
  await t.query("delete from welcome_gifts where claimed_by is null and created_at < now() - interval '7 days'")
  await t.query('insert into welcome_gifts (id, gift) values ($1, $2)', [id, gift])
  return { id, gift }
}

/** The gift behind an opened box, claimed by this address (once); null for an unknown or already claimed box. */
async function claimGift(t: Queryable, id: string, email: string): Promise<WelcomeGift | null> {
  if (!/^[A-Za-z0-9_-]{16}$/.test(id)) return null
  const { rows } = await t.query<{ gift: WelcomeGift }>('update welcome_gifts set claimed_by = $2 where id = $1 and claimed_by is null returning gift', [id, email])
  return rows[0]?.gift ?? null
}

/**
 * Records the signup and queues the code email; a second signup of the same address sends nothing more. With an
 * opened box (`giftId`), the email carries that gift's code; without one, the 10% code.
 */
export async function welcomeSignup(t: Queryable, email: string, page: string | null, locale: 'ro' | 'en' = 'ro', site: 'ro' | 'net' = 'ro', giftId?: string, landing: LandingSlug | null = null) {
  const addr = email.trim().toLowerCase()
  const { rows } = await t.query('insert into welcome_signups (email, page) values ($1, $2) on conflict (email) do nothing returning email', [addr, page?.slice(0, 80) ?? null])
  if (!rows.length) return { created: false, already: true }
  const gift = (giftId && (await claimGift(t, giftId, addr))) || 'p10'
  if (gift !== 'p10') await t.query('update welcome_signups set gift = $2 where email = $1', [addr, gift])
  const state = await marketing.state(t, addr)
  // An address that unsubscribed before chose so: signing up again here is a new, explicit consent.
  // Prepared, off (POPUP_VOUCHERS): a product popup gives that product's fixed voucher and its landing sequence
  // instead of the 10% email (server/popup-vouchers.ts). Off, every popup sends what it sends today.
  const product = popupVouchersOn() && site === 'ro' && locale === 'ro' && !giftId ? popupProduct(page, landing) : null
  const version = locale === 'en' ? 'welcome-en-2026-10-16' : giftId ? 'welcome-cadou-2026-10-20' : product ? 'welcome-voucher-2026-10-23' : 'welcome-2026-10-15'
  if (!state?.granted) await marketing.grant(t, { email: addr, source: 'popup', page: page ?? undefined, version })
  // A landing popup whose sequence GoHighLevel sends (LANDING_GHL_SEQUENCES=on): the tag bt-landing-<slug> starts it,
  // and its first email states the product's Shopify code, so the store's 10% email does not go as well.
  const ghlLanding = !product && landingGhlSequencesOn() && site === 'ro' && locale === 'ro' && !giftId ? landing : null
  const voucher = product ? await popupVoucher(t, addr, product) : null
  if (!voucher && !ghlLanding) await jobs.enqueue(t, { kind: 'email.welcome', dedupeKey: `email.welcome:${addr}`, payload: { email: addr, locale, site, gift } })
  // The address in the CRM (contact, lead tags, leads pipeline) for the team's follow-up and remarketing.
  await jobs.enqueue(t, { kind: 'ghl.welcome', dedupeKey: `ghl.welcome:${addr}`, payload: ghlLanding ? { email: addr, site, landing: ghlLanding } : { email: addr, site } })
  return { created: true, voucher: !!voucher }
}

export function renderWelcome(x: { siteUrl: string; unsubscribeUrl: string; code?: string; locale?: 'ro' | 'en'; gift?: WelcomeGift }) {
  const code = x.code ?? WELCOME_CODE
  if (x.locale === 'en') return renderWelcomeEn({ ...x, code })
  const g = WELCOME_GIFTS[x.gift ?? 'p10']
  const subject = x.gift && x.gift !== 'p10' ? `Cadoul tău, ${g.title}: ${code}` : `Codul tău de 10%: ${code}`
  const lines =
    x.gift === 'lei100'
      ? [
          'Mulțumim că ne-ai lăsat adresa. Cadoul tău este 100 lei reducere, cu acest cod:',
          'Scrie-l la „Cod promoțional”, în pagina de comandă. Scade 100 lei din comandă, la orice produs, mai puțin cartea, și se adaugă peste promoțiile din coș. Pe o comandă merge un singur cod.',
        ]
      : x.gift === 'p1233'
        ? [
            'Mulțumim că ne-ai lăsat adresa. Cadoul tău este 12,33% reducere, cu acest cod:',
            'Scrie-l la „Cod promoțional”, în pagina de comandă. Îți dă 12,33% din prețul întreg și se adaugă peste promoțiile din coș. Pe o comandă merge un singur cod.',
          ]
        : [
            'Mulțumim că ne-ai lăsat adresa. Acesta este codul tău de 10% reducere:',
            'Scrie-l la „Cod promoțional”, în pagina de comandă. Îți dă 10% din prețul întreg și se adaugă peste promoțiile din coș (de exemplu 20% la 3 bucăți + 10%). Pe o comandă merge un singur cod.',
          ]
  const footer = `Primești acest email pentru că ți-ai lăsat adresa pe biohack-tech.ro. Te poți dezabona oricând: ${x.unsubscribeUrl}`
  const company = companyLine()
  const text = ['Bună!', '', lines[0], code, '', lines[1], '', `Mergi la magazin: ${x.siteUrl}`, '', 'Echipa Biohack Tech', '', footer, ...(company ? [company] : [])].join('\n')
  const p = (t: string) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#27343a">${esc(t)}</p>`
  const content = `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0b1316">Bună!</h1>
${p(lines[0])}
<div style="margin:6px 0 18px;padding:16px 18px;border:1px dashed #0e7490;border-radius:14px;background:#f2f9fb;text-align:center">
<div style="font-size:13px;color:#5a6870;letter-spacing:.4px">CODUL TĂU</div>
<div style="font-size:26px;font-weight:800;letter-spacing:3px;color:#0b1316;padding:4px 0">${esc(code)}</div>
<div style="font-size:14px;color:#27343a">${esc(g.detail)}</div>
</div>
${p(lines[1])}
<p style="margin:22px 0 0"><a href="${esc(x.siteUrl)}" style="display:inline-block;background:#d23b3b;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 22px;border-radius:12px">Mergi la magazin</a></p>`
  const html = emailShell({ subject, content, siteUrl: x.siteUrl, footer: `Primești acest email pentru că ți-ai lăsat adresa pe biohack-tech.ro. <a href="${esc(x.unsubscribeUrl)}" style="color:#8a969c">Dezabonare</a>` })
  return { subject, html, text }
}

function renderWelcomeEn(x: { siteUrl: string; unsubscribeUrl: string; code: string }) {
  const code = x.code
  const subject = `Your 10% code: ${code}`
  const lines = [
    'Thank you for leaving your email. Here is your 10% discount code:',
    'Enter it in "Promo code" on the checkout page. It takes 10% off the full price and adds to the promotions in your cart (for example 20% for 3 units + 10%). One code per order.',
  ]
  const footer = `You get this email because you left your address on our website. You can unsubscribe at any time: ${x.unsubscribeUrl}`
  const company = companyLine()
  const shop = `${x.siteUrl}/en`
  const text = ['Hello!', '', lines[0], code, '', lines[1], '', `Visit the store: ${shop}`, '', 'The Biohack Tech team', '', footer, ...(company ? [company] : [])].join('\n')
  const p = (t: string) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#27343a">${esc(t)}</p>`
  const content = `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0b1316">Hello!</h1>
${p(lines[0])}
<div style="margin:6px 0 18px;padding:16px 18px;border:1px dashed #0e7490;border-radius:14px;background:#f2f9fb;text-align:center">
<div style="font-size:13px;color:#5a6870;letter-spacing:.4px">YOUR CODE</div>
<div style="font-size:26px;font-weight:800;letter-spacing:3px;color:#0b1316;padding:4px 0">${esc(code)}</div>
<div style="font-size:14px;color:#27343a">10% off the full price</div>
</div>
${p(lines[1])}
<p style="margin:22px 0 0"><a href="${esc(shop)}" style="display:inline-block;background:#d23b3b;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 22px;border-radius:12px">Visit the store</a></p>`
  const html = emailShell({ subject, content, siteUrl: x.siteUrl, locale: 'en', footer: `You get this email because you left your address on our website. <a href="${esc(x.unsubscribeUrl)}" style="color:#8a969c">Unsubscribe</a>` })
  return { subject, html, text }
}
