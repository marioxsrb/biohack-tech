/**
 * The AI call recovery offer: the caller's fixed code BIOHACK10 (10% of the full price, once per address, no
 * time limit; like every promo code it adds to the automatic promotions, business decision 15.10.2026) and the
 * email that carries it.
 *
 * The code comes from the server, never from the agent. The email goes out just before the call
 * moment, only with the address's email marketing consent; the agent is told whether it was accepted for
 * delivery, so it says "găsiți codul pe email" only when that is true. The email counts as the lead's first
 * recovery email, so the regular sequence never sends a second one on top of it.
 */
import 'server-only'
import { addressee } from './names'
import { getProduct, resolveLine, variantLabel } from '@/content/catalog'
import { companyLine } from '@/config/company'
import { gatedOrigin } from '@/lib/lead'
import { formatLei } from '@/lib/money'
import { priceLines } from '@/lib/promotions'
import { shippingFor } from '@/lib/shipping'
import { CALL_CODE, PROMOTIONS } from '@/config/promotions'
import type { Config } from '@/server/config'
import type { Queryable } from '@/server/db'
import { deliver } from '@/server/integrations/email/transport'
import { emailShell, esc } from '@/server/integrations/email/shell'
import { CART_INTEREST, sanitizeCart, type Lead } from '@/server/leads'
import { log, errText } from '@/server/log'
import { marketing } from '@/server/marketing/consent'
import { promoCodes, type PromoCode } from '@/server/promo'

export const RECOVERY_PERCENT = 10

/** Where the email stands, as the agent and /admin see it. */
export type OfferEmailStatus = 'sent' | 'sent_on_request' | 'no_consent' | 'failed' | 'not_sent' | 'dry_run'


/** Whether the lead has a cart: a checkout, or a price-form lead on acces whose device then filled its cart. */
export const hasCart = (lead: Pick<Lead, 'productId' | 'cart'>) => lead.productId === CART_INTEREST || !!lead.cart?.length

/** The products a lead is about, with quantities: its cart, or else the one product of the price form. */
export function leadItems(lead: Pick<Lead, 'productId' | 'variantId' | 'cart'>) {
  const raw = lead.cart?.length ? lead.cart : lead.productId && lead.productId !== CART_INTEREST ? [{ productId: lead.productId, variantId: lead.variantId ?? undefined, quantity: 1 }] : []
  return sanitizeCart(raw).flatMap((l) => {
    const r = resolveLine(l.productId, l.variantId)
    return r && r.unit !== null ? [{ ...l, name: r.product.name, variant: r.variant ? variantLabel(r.product, r.variant) || null : null, unit: r.unit }] : []
  })
}

/** A checkout's total at today's prices and promotions, with the delivery (the book's fee); null for a price-form lead (there is no cart). */
export function cartTotal(lead: Pick<Lead, 'productId' | 'variantId' | 'cart'>): number | null {
  if (!hasCart(lead)) return null
  const items = leadItems(lead)
  if (!items.length) return null
  return priceLines(items.map((l, i) => ({ key: String(i), productId: l.productId, quantity: l.quantity, unitAmount: l.unit }))).totalMinor + shippingFor(items)
}

/**
 * The automatic promotions, in words: for a checkout, what its cart already gets ("10% la 2 buc. NEUROS Calm:
 * −1.276 lei"); for the price form, the promotion available on the product. Empty when there is none.
 */
export function existingDiscounts(lead: Pick<Lead, 'productId' | 'variantId' | 'cart'>): string {
  const items = leadItems(lead)
  if (!hasCart(lead)) {
    const promo = items[0] && PROMOTIONS.find((p) => (p.products as string[]).includes(items[0].productId))
    return promo ? `promoție disponibilă: ${promo.line}` : ''
  }
  const pricing = priceLines(items.map((l, i) => ({ key: String(i), productId: l.productId, quantity: l.quantity, unitAmount: l.unit })))
  return pricing.promotions.map((a) => `${a.label}: −${formatLei(a.amountMinor)}`).join('; ')
}

/** The caller's code (BIOHACK10), when it exists and is active; otherwise no offer is made. */
export async function recoveryCode(q: Queryable): Promise<PromoCode | null> {
  const code = await promoCodes.get(q, CALL_CODE)
  return code?.active && (!code.endsAt || code.endsAt > new Date()) ? code : null
}

export function recoveryLink(lead: Pick<Lead, 'funnel' | 'recoveryToken'>, code: string, c: Pick<Config, 'siteUrl'>) {
  const base = lead.funnel === 'gated_price' ? gatedOrigin(c.siteUrl) : c.siteUrl
  return `${base}/api/lead/resume?t=${lead.recoveryToken}&cod=${encodeURIComponent(code)}`
}

export function renderRecoveryOffer(x: { firstName: string | null; items: { name: string; variant: string | null; quantity: number }[]; cart: boolean; code: string; link: string; unsubscribeUrl: string }) {
  const what = x.items.length ? [...new Set(x.items.map((i) => i.name))].join(', ') : 'produsele alese'
  const subject = `Codul tău de ${RECOVERY_PERCENT}% pentru ${what}`
  const hello = x.firstName ? `Bună, ${x.firstName}.` : 'Bună.'
  const intro = x.cart ? 'Cum am vorbit la telefon, comanda ta a rămas nefinalizată. Am păstrat produsele:' : `Cum am vorbit la telefon, îți trimitem codul pentru ${what}.`
  const list = x.cart ? x.items.map((i) => `${i.quantity} × ${i.name}${i.variant ? ` (${i.variant})` : ''}`) : []
  const how = [
    `Codul tău: ${x.code}`,
    `Îți dă ${RECOVERY_PERCENT}% reducere din prețul întreg.`,
    'Deschide linkul de mai jos, mergi la comandă și scrie codul la „Cod promoțional”.',
    'Codul se adaugă la promoțiile din coș: încă 10% din prețul întreg. De exemplu, la 3 bucăți din același produs ai 20% + 10% = 30%.',
  ]
  const footer = `Primești acest email pentru că ai acceptat emailuri de la Biohack Tech. Te poți dezabona oricând: ${x.unsubscribeUrl}`
  const company = companyLine()
  const text = [hello, '', intro, ...list.map((l) => `- ${l}`), '', ...how, '', `Reiau comanda: ${x.link}`, '', 'Echipa Biohack Tech', '', footer, ...(company ? [company] : [])].join('\n')
  const p = (t: string) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#27343a">${esc(t)}</p>`
  const content = `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0b1316">${esc(hello)}</h1>
${p(intro)}
${list.length ? `<ul style="margin:0 0 16px;padding-left:20px;font-size:16px;line-height:1.6;color:#27343a">${list.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
<div style="margin:6px 0 18px;padding:16px 18px;border:1px dashed #0e7490;border-radius:14px;background:#f2f9fb;text-align:center">
<div style="font-size:13px;color:#5a6870;letter-spacing:.4px">CODUL TĂU</div>
<div style="font-size:26px;font-weight:800;letter-spacing:3px;color:#0b1316;padding:4px 0">${esc(x.code)}</div>
<div style="font-size:14px;color:#27343a">${esc(`${RECOVERY_PERCENT}% reducere din prețul întreg`)}</div>
</div>
${how.slice(2).map(p).join('\n')}
<p style="margin:22px 0 0"><a href="${esc(x.link)}" style="display:inline-block;background:#d23b3b;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 22px;border-radius:12px">Reiau comanda</a></p>`
  const html = emailShell({ subject, content, footer: `Primești acest email pentru că ai acceptat emailuri de la Biohack Tech. <a href="${esc(x.unsubscribeUrl)}" style="color:#8a969c">Dezabonare</a>` })
  return { subject, html, text }
}

export type PreparedOffer = { code: PromoCode; emailStatus: OfferEmailStatus; link: string } | null

/**
 * Sends the code's email (once per lead: a second attempt sends nothing more). The email needs the
 * address's marketing consent in force and our own mailbox; it is sent here, before the call, so the agent knows
 * whether it was accepted. A failure is recorded and never stops the call.
 */
export async function prepareOffer(q: Queryable, c: Config, lead: Lead, opts: { dryRun: boolean }): Promise<PreparedOffer> {
  const code = await recoveryCode(q)
  if (!code) return null
  const link = recoveryLink(lead, code.code, c)
  const prior = await q.query<{ email_status: string }>("select email_status from calls where lead_id = $1 and email_status = 'sent' limit 1", [lead.id])
  if (prior.rows.length) return { code, emailStatus: 'sent', link }
  if (opts.dryRun) return { code, emailStatus: 'dry_run', link }
  const consent = await marketing.state(q, lead.email)
  if (!consent?.granted) return { code, emailStatus: 'no_consent', link }
  if (c.email.transport !== 'smtp' && c.email.transport !== 'file') return { code, emailStatus: 'not_sent', link }
  if (c.recovery.testRecipients && !c.recovery.testRecipients.includes(lead.email.toLowerCase())) return { code, emailStatus: 'not_sent', link }
  try {
    const token = await marketing.unsubscribeToken(q, lead.email)
    const items = leadItems(lead)
    const mail = renderRecoveryOffer({
      firstName: lead.name?.split(' ')[0] ?? null,
      items,
      cart: hasCart(lead),
      code: code.code,
      link,
      unsubscribeUrl: `${c.siteUrl}/dezabonare/${token}`,
    })
    await deliver(c, { ...mail, to: lead.email, name: `call-offer-${lead.id}` })
    // The first recovery email of this lead: the regular sequence skips its own first step.
    await q.query(
      `update leads set recovery_sent = greatest(recovery_sent, 1), last_recovery_at = now(), recovery_status = case when recovery_status = 'stopped' then recovery_status else 'sent' end,
         recovery_reason = 'call offer', abandonment = coalesce(abandonment, $2), updated_at = now() where id = $1`,
      [lead.id, lead.stage === 'lead' ? 'lead_abandoned' : 'checkout_abandoned'],
    )
    return { code, emailStatus: 'sent', link }
  } catch (e) {
    log.error('call.offer_email_failed', { leadId: lead.id, error: errText(e) })
    return { code, emailStatus: 'failed', link }
  }
}

/** What the agent may say about the products: names and quantities, in Romanian, from the catalog only. */
export function describeItems(lead: Pick<Lead, 'productId' | 'variantId' | 'cart'>) {
  const items = leadItems(lead)
  return {
    names: [...new Set(items.map((i) => i.name))].join(', ') || (getProduct(lead.productId)?.name ?? ''),
    quantities: items.map((i) => `${i.quantity} × ${i.name}${i.variant ? ` (${i.variant})` : ''}`).join(', '),
  }
}

export const lei = (minor: number | null) => (minor === null ? '' : formatLei(minor))

/** The agent's first sentence, per call: the reason for the call, and the question. */
const COUNT = ['', 'o bucată', 'două bucăți', 'trei bucăți', 'patru bucăți', 'cinci bucăți', 'șase bucăți', 'șapte bucăți', 'opt bucăți', 'nouă bucăți', 'zece bucăți']

/** "NEUROS Calm", "două bucăți de NEUROS Calm și NEUROS Amber": what the cart holds, said out loud. */
export function cartInWords(items: { name: string; quantity: number }[]) {
  const by = new Map<string, number>()
  for (const i of items) by.set(i.name, (by.get(i.name) ?? 0) + i.quantity)
  const parts = [...by].map(([name, q]) => (q > 1 ? `${COUNT[q] ?? `${q} bucăți`} de ${name}` : name))
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} și ${parts.at(-1)}` : (parts[0] ?? 'produsele noastre')
}

export function openingLine(x: { firstName: string; name?: string | null; cart: boolean; productNames: string; items?: { name: string; quantity: number }[]; at?: Date }) {
  // "Bună ziua" until 18:00, "Bună seara" after, in Bucharest time. The company name spelled the Romanian way,
  // so the Romanian voice does not switch to an English accent.
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', hour: '2-digit', hourCycle: 'h23' }).format(x.at ?? new Date()))
  // With the person's given name: "Bună ziua, doamna Ana!" (domnule/doamna only when the given name is known
  // for sure, otherwise the name alone; no usable name, the greeting alone). See names.ts.
  // Only the given name reaches the voice provider (data minimisation), found among the words when it is known.
  const who = addressee(x.name || x.firstName)
  const hello = `${hour >= 18 || hour < 5 ? 'Bună seara' : 'Bună ziua'}${who ? `, ${who}` : ''}!`
  // The reason comes first, so "Aveți un minut?" has a context: the cart, or the price asked for.
  const why = x.cart
    ? `Am văzut că ați adăugat în coș ${x.items?.length ? cartInWords(x.items) : x.productNames || 'produse de pe site'}.`
    : `Am văzut că v-ați interesat de prețul pentru ${x.productNames || 'produsele noastre'} pe site-ul nostru și m-am gândit să vă ajut cu informații.`
  return `${hello} Numele meu este Maria și vă sun din partea magazinului Baiohec Tec. ${why} Aveți un minut?`
}