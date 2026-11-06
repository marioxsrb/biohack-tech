/**
 * A "Cumpără în rate prin tbi bank" request from the Shopify store (lib/rate-tbi.ts has the shape).
 * TBI's Link 2 Pay is not active yet: a colleague calls the customer within 24 hours and sends the TBI link by hand.
 * 0. The basket is valued here with the store's price rules (lib/tbi.ts, server/tbi-prices.ts), never with the browser's.
 * 1. GoHighLevel (NEUROS): the contact (found by email, created only if new), the fields bt_tbi_produs / bt_tbi_cantitate /
 *    bt_tbi_valoare / bt_tbi_perioada / bt_tbi_avans / bt_tbi_rata / bt_tbi_total_plata / bt_tbi_whatsapp, the tags
 *    rate-tbi (starts "BT · Rate TBI · cerere nouă": confirmation email to the customer, notification to Mario),
 *    rate-tbi-cerere and rate-tbi-<product>, a note with every line, a task due in 24 hours and a new card in the
 *    "Rate TBI" pipeline, column "Cerere nouă". Contact, card and task go to the assignee (Mario Sirbu, who sends the
 *    tbi link on WhatsApp).
 * 2. Meta Conversions API: Lead and RateTBIRequest with the browser's event ids, only with marketing consent.
 * Runs as the job "rate_tbi.submit" (jobs/runner.ts): when GHL does not answer, the job is retried with backoff.
 */
import 'server-only'
import { lei, plausibleValue, RATE_TBI_PRODUCTS, type RateTbiRequest } from '@/lib/rate-tbi'
import { allowedPeriods, instalment, quote, tbiTerms, type TbiInstalment, type TbiQuoteLine, type TbiTerms } from '@/lib/tbi'
import type { Config } from '@/server/config'
import { ghl } from '@/server/integrations/ghl'
import { metaFormUserData, sendMetaEvents } from '@/server/integrations/meta'
import { errText, log } from '@/server/log'
import { getDb } from '@/server/db'
import { applyToCard, type TbiRegistration } from '@/server/tbi-applications'
import { tbiPriceRules } from '@/server/tbi-prices'

export const RATE_TBI_TAGS = {
  request: 'rate-tbi',
  received: 'rate-tbi-cerere',
  product: (p: string) => `rate-tbi-${p}`,
  site: 'bt-site-ro',
  linkSent: 'rate-tbi-link-trimis',
} as const
/** The team's board in GHL (NEUROS, Opportunities): every request is a new card in the first column. */
export const RATE_TBI_PIPELINE = { name: 'Rate TBI', newStage: 'Cerere nouă' } as const
/** Contact fields in GHL (NEUROS, folder BiohackTech Ecommerce), read by the workflow's notification and confirmation. */
export const RATE_TBI_FIELDS = {
  product: 'contact.bt_tbi_produs',
  value: 'contact.bt_tbi_valoare',
  qty: 'contact.bt_tbi_cantitate',
  period: 'contact.bt_tbi_perioada',
  advance: 'contact.bt_tbi_avans',
  rate: 'contact.bt_tbi_rata',
  totalToPay: 'contact.bt_tbi_total_plata',
  whatsapp: 'contact.bt_tbi_whatsapp',
  link: 'contact.bt_tbi_link',
} as const
export const RATE_TBI_CALL_WITHIN_H = 24
const STORE = 'https://biohack-tech.ro'

export type RateTbiValuation = {
  lines: TbiQuoteLine[]
  total: number
  verified: boolean
  terms: TbiTerms
  /** The period used: the one asked for, or the longest tbi allows for the amount when it allows less. */
  period: number
  rate: TbiInstalment
}

/** The period tbi allows for the credit (the customer's choice when allowed) and the instalment for it. */
export function financing(total: number, r: Pick<RateTbiRequest, 'advance' | 'period'>, terms: TbiTerms) {
  const credit = Math.max(0, Math.round((total - r.advance) * 100) / 100)
  const ok = allowedPeriods(credit, terms)
  const period = ok.includes(r.period) ? r.period : Math.max(...ok)
  return { period, rate: instalment(credit, period, terms) }
}

/** The basket's value with the store's rules; without them, the page's total if believable; otherwise null. */
export async function valueRateTbi(cfg: Pick<Config, 'rateTbi'>, r: RateTbiRequest, now = Date.now()): Promise<RateTbiValuation | null> {
  const rules = await tbiPriceRules(cfg.rateTbi.pricesUrl, now)
  const q = rules ? quote(rules, r.items, now) : null
  if (q) {
    if (r.clientTotal !== null && Math.abs(r.clientTotal - q.total) > 1) log.warn('rate_tbi.total_mismatch', { client: r.clientTotal, server: q.total })
    const terms = tbiTerms(rules?.terms)
    return { ...q, verified: true, terms, ...financing(q.total, r, terms) }
  }
  if (r.clientTotal === null || !plausibleValue(r.items, r.clientTotal)) return null
  // The store did not answer: the page's total, split per product at full price for the note only.
  const full = r.items.map((i) => ({ ...i, title: RATE_TBI_PRODUCTS[i.handle].title, full: RATE_TBI_PRODUCTS[i.handle].normalLei * i.qty }))
  const sum = full.reduce((s, l) => s + l.full, 0)
  const lines = full.map((l) => {
    const total = Math.round((r.clientTotal! * l.full) / sum * 100) / 100
    return { handle: l.handle, qty: l.qty, title: l.title, total, unit: Math.round((total / l.qty) * 100) / 100 }
  })
  const terms = tbiTerms(rules?.terms)
  return { lines, total: r.clientTotal, verified: false, terms, ...financing(r.clientTotal, r, terms) }
}

const short = (h: string) => RATE_TBI_PRODUCTS[h as keyof typeof RATE_TBI_PRODUCTS]?.short ?? h
export const basketLabel = (lines: { handle: string; qty: number }[]) => lines.map((l) => `${short(l.handle)} x${l.qty}`).join(' + ')

export function rateTbiNote(r: RateTbiRequest, v: RateTbiValuation, now = new Date(), tbi?: TbiRegistration | null): string {
  const when = now.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', dateStyle: 'short', timeStyle: 'short' })
  const source = Object.entries(r.utm).map(([k, val]) => `${k}=${val}`).join(', ') || 'direct / fără UTM'
  const t = v.terms
  const costs = t.includeCosts ? `comision de analiză ${lei(t.commission)} lei și asigurare ${String(t.insurancePct).replace('.', ',')}%/lună incluse` : 'fără comision și asigurare'
  return [
    `Cerere rate tbi bank (${when})`,
    ...v.lines.map((l) => `• ${l.title} × ${l.qty}: ${lei(l.unit)} lei/buc., subtotal ${lei(l.total)} lei`),
    `Total comandă: ${lei(v.total)} lei${v.verified ? '' : ' (prețurile magazinului nu au putut fi citite: e totalul arătat pe pagină, verifică-l)'}`,
    `Avans: ${r.advance > 0 ? `${lei(r.advance)} lei` : 'fără'}`,
    `Perioada: ${v.period} luni${v.period !== r.period ? ` (a cerut ${r.period}; pentru suma asta tbi dă maximum ${v.period})` : ''}`,
    `Rată estimată: ${lei(v.rate.monthly)} lei/lună, total de plată ${lei(v.rate.total)} lei (dobândă fixă ${String(t.annualPct).replace('.', ',')}%/an, ${costs})`,
    `Nume: ${r.name}`,
    `Telefon: ${r.phone} (WhatsApp: ${whatsappLink(r.phone)})`,
    `Email: ${r.email}`,
    ...(r.city ? [`Oraș: ${r.city}`] : []),
    `Pagina: ${r.page ? STORE + r.page : '-'}`,
    `Sursa: ${source}`,
    tbi
      ? `TBI: cererea e înregistrată (comanda ${tbi.orderRef}, TBI ${tbi.orderId}${tbi.env === 'uat' ? ', mediu de TEST' : ''}). Clientul a primit pe site butonul „Continuă cererea la TBI”: ${tbi.url}\nPasul următor: cardul se mută singur după statusul de la TBI; sună clientul dacă rămâne pe „Link trimis”.`
      : `Pasul următor: sună clientul în maximum ${RATE_TBI_CALL_WITHIN_H} de ore și trimite-i linkul tbi bank pentru cererea online.`,
  ].join('\n')
}

/** +40722123456 → https://wa.me/40722123456 */
export const whatsappLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`

export type RateTbiJob = { request: RateTbiRequest; valuation: RateTbiValuation; client: { ip: string | null; ua: string | null }; at: string; tbi?: TbiRegistration | null }
export type RateTbiResult = { contactId: string; opportunityId: string | null; meta: 'sent' | 'off' | 'no-consent' | 'failed' }

export async function submitRateTbi(cfg: Pick<Config, 'ghl' | 'metaCapi' | 'rateTbi'>, job: RateTbiJob): Promise<RateTbiResult> {
  if (!cfg.ghl) throw new Error('ghl not configured')
  const { request: r, valuation: v, client } = job
  const tbi = job.tbi ?? null
  const now = new Date(job.at)
  const value = lei(v.total)
  const label = basketLabel(v.lines)

  const assignedTo = cfg.rateTbi.assignee
  const contactId = await ghl.upsertLeadContact(cfg.ghl, { name: r.name, email: r.email, phone: r.phone, city: r.city, assignedTo })
  // The workflow's messages read these fields, so they are written before the tag that starts it.
  // The API takes the short key (without "contact."); with the full one GHL answers 200 and saves nothing.
  const field = (key: string, field_value: string) => ({ key: key.replace(/^contact\./, ''), field_value })
  await ghl.updateFields(cfg.ghl, contactId, [
    field(RATE_TBI_FIELDS.product, v.lines.map((l) => `${l.title} x${l.qty}`).join(', ')),
    field(RATE_TBI_FIELDS.qty, String(v.lines.reduce((s, l) => s + l.qty, 0))),
    field(RATE_TBI_FIELDS.value, value),
    field(RATE_TBI_FIELDS.period, `${v.period} luni`),
    field(RATE_TBI_FIELDS.advance, r.advance > 0 ? lei(r.advance) : '0'),
    field(RATE_TBI_FIELDS.rate, lei(v.rate.monthly)),
    field(RATE_TBI_FIELDS.totalToPay, lei(v.rate.total)),
    field(RATE_TBI_FIELDS.whatsapp, whatsappLink(r.phone)),
    // A new request needs a new TBI link: TBI's (Fusion Pay) when it was registered, otherwise cleared for the team.
    field(RATE_TBI_FIELDS.link, tbi?.url ?? ''),
  ])
  // A repeated request starts the workflow again: GHL fires "tag added" only when the tag was absent.
  await ghl.removeTags(cfg.ghl, contactId, [RATE_TBI_TAGS.request, RATE_TBI_TAGS.linkSent])
  // With TBI's link already given on the site, "link sent" is set at once: the 30-minute reminder has nothing to remind.
  await ghl.addTags(cfg.ghl, contactId, [RATE_TBI_TAGS.request, RATE_TBI_TAGS.received, ...v.lines.map((l) => RATE_TBI_TAGS.product(l.handle)), RATE_TBI_TAGS.site, ...(tbi ? [RATE_TBI_TAGS.linkSent] : [])])
  const note = rateTbiNote(r, v, now, tbi)
  await ghl.addNote(cfg.ghl, contactId, note)
  await ghl.addTask(cfg.ghl, contactId, {
    title: `Sună ${r.name} – cerere rate tbi (${value} lei)`,
    body: note,
    dueDate: new Date(now.getTime() + RATE_TBI_CALL_WITHIN_H * 3_600_000).toISOString(),
    assignedTo,
  })
  // One card per request: GHL shows its name and value on the board, and the date and time in stage on its own.
  const opportunityId = await ghl.placeOpportunity(cfg.ghl, contactId, {
    pipeline: RATE_TBI_PIPELINE.name,
    stage: RATE_TBI_PIPELINE.newStage,
    name: `${r.name} – ${label} – ${value} lei`,
    valueRon: v.total,
    newCard: true,
    assignedTo,
  })
  if (tbi) await applyToCard(cfg, await getDb(), tbi, contactId, opportunityId)

  let meta: RateTbiResult['meta'] = 'off'
  if (cfg.metaCapi) {
    if (cfg.metaCapi.requireConsent && !r.marketing) meta = 'no-consent'
    else {
      const base = {
        event_time: Math.floor(now.getTime() / 1000),
        event_source_url: STORE + (r.page ?? '/pages/rate-tbi'),
        action_source: 'website' as const,
        user_data: metaFormUserData({ email: r.email, phone: r.phone, name: r.name, city: r.city ?? undefined, fbp: r.fbp, fbc: r.fbc, ip: client.ip, ua: client.ua }),
      }
      const custom_data = {
        currency: 'RON',
        value: v.total,
        content_ids: v.lines.map((l) => l.handle),
        contents: v.lines.map((l) => ({ id: l.handle, quantity: l.qty })),
        content_type: 'product',
        num_items: v.lines.reduce((s, l) => s + l.qty, 0),
      }
      try {
        await sendMetaEvents(cfg.metaCapi, [
          { ...base, event_name: 'Lead', event_id: r.eventId, custom_data },
          { ...base, event_name: 'RateTBIRequest', event_id: `${r.eventId}-r`, custom_data },
        ])
        meta = 'sent'
      } catch (e) {
        meta = 'failed'
        log.warn('rate_tbi.meta_failed', { error: errText(e) })
      }
    }
  }
  return { contactId, opportunityId, meta }
}
