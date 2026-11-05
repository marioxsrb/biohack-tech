/**
 * A "Cumpără în rate prin TBI Bank" request from the Shopify store (lib/rate-tbi.ts has the shape).
 * 1. GoHighLevel (NEUROS, the Biohack location): the contact (found by email, created only if new, with the city), the
 *    fields bt_tbi_produs / bt_tbi_valoare / bt_tbi_cantitate, the tags rate-tbi and rate-tbi-<product> (the tag starts the
 *    workflow "BT · Rate TBI · cerere nouă"), a note with every detail, a task "Generează Link 2 Pay – X lei" due in 30 min
 *    and the card in the "Rate TBI" pipeline, column "Cerere nouă". The team pastes the TBI link in the contact field
 *    bt_tbi_link, which starts "BT · Rate TBI · trimite link" (email to the customer, card to "Link trimis").
 * 2. The workflow "BT · Rate TBI · cerere nouă" through its inbound webhook (RATE_TBI_GHL_HOOK): it notifies the team
 *    and confirms to the customer. While the workflow is a draft, GHL ignores the webhook; step 1 still happens.
 * 3. Meta Conversions API: Lead and RateTBIRequest with the browser's event ids, only with marketing consent.
 * Step 1 must succeed (the team works from it); steps 2 and 3 are logged when they fail.
 */
import 'server-only'
import { lei, RATE_TBI_PRODUCTS, type RateTbiRequest } from '@/lib/rate-tbi'
import type { Config } from '@/server/config'
import { ghl } from '@/server/integrations/ghl'
import { metaFormUserData, sendMetaEvents } from '@/server/integrations/meta'
import { errText, log } from '@/server/log'

export const RATE_TBI_TAGS = { request: 'rate-tbi', product: (p: string) => `rate-tbi-${p}`, site: 'bt-site-ro' } as const
/** The team's board in GHL (NEUROS, Opportunities): every request lands (back) in the first column. */
export const RATE_TBI_PIPELINE = { name: 'Rate TBI', newStage: 'Cerere nouă' } as const
/** Contact fields in GHL (NEUROS, folder BiohackTech Ecommerce), read by the workflow's notification and confirmation. */
export const RATE_TBI_FIELDS = { product: 'contact.bt_tbi_produs', value: 'contact.bt_tbi_valoare', qty: 'contact.bt_tbi_cantitate' } as const
const STORE = 'https://biohack-tech.ro'

export type RateTbiResult = { contactId: string; opportunityId: string | null; hook: 'sent' | 'off' | 'failed'; meta: 'sent' | 'off' | 'no-consent' | 'failed' }

export function rateTbiNote(r: RateTbiRequest, now = new Date()): string {
  const p = RATE_TBI_PRODUCTS[r.product]
  const when = now.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', dateStyle: 'short', timeStyle: 'short' })
  const source = Object.entries(r.utm).map(([k, v]) => `${k}=${v}`).join(', ') || 'direct / fără UTM'
  return [
    `Cerere rate TBI (${when})`,
    `Produs: ${p.title} × ${r.qty}`,
    `Valoare comandă (de pus în Link 2 Pay): ${lei(r.valueLei)} lei`,
    `Nume: ${r.name}`,
    `Telefon: ${r.phone}`,
    `Email: ${r.email}`,
    `Oraș: ${r.city}`,
    `Pagina: ${r.page ? STORE + r.page : '-'}`,
    `Sursa: ${source}`,
    'Pasul următor: generează Link 2 Pay în bankly.tbicredit.ro și lipește-l în câmpul „bt_tbi_link” al contactului; emailul către client pleacă singur.',
  ].join('\n')
}

export async function submitRateTbi(cfg: Pick<Config, 'ghl' | 'metaCapi' | 'rateTbi'>, r: RateTbiRequest, client: { ip: string | null; ua: string | null }, now = new Date()): Promise<RateTbiResult> {
  if (!cfg.ghl) throw new Error('ghl not configured')
  const p = RATE_TBI_PRODUCTS[r.product]
  const value = lei(r.valueLei)

  const contactId = await ghl.upsertLeadContact(cfg.ghl, { name: r.name, email: r.email, phone: r.phone, city: r.city })
  // The workflow's messages read these fields, so they are written before the tag that starts it.
  // The API takes the short key (without "contact."); with the full one GHL answers 200 and saves nothing.
  const field = (key: string, field_value: string) => ({ key: key.replace(/^contact\./, ''), field_value })
  await ghl.updateFields(cfg.ghl, contactId, [
    field(RATE_TBI_FIELDS.product, p.title),
    field(RATE_TBI_FIELDS.value, value),
    field(RATE_TBI_FIELDS.qty, String(r.qty)),
  ])
  // A repeated request starts the workflow again: GHL fires "tag added" only when the tag was absent.
  await ghl.removeTags(cfg.ghl, contactId, [RATE_TBI_TAGS.request, RATE_TBI_TAGS.product(r.product)])
  await ghl.addTags(cfg.ghl, contactId, [RATE_TBI_TAGS.request, RATE_TBI_TAGS.product(r.product), RATE_TBI_TAGS.site])
  const note = rateTbiNote(r, now)
  await ghl.addNote(cfg.ghl, contactId, note)
  await ghl.addTask(cfg.ghl, contactId, {
    title: `Generează Link 2 Pay – ${value} lei`,
    body: note,
    dueDate: new Date(now.getTime() + 30 * 60_000).toISOString(),
  })
  // The card: GHL shows its name and value on the board, and the date and time in stage on its own.
  const opportunityId = await ghl.placeOpportunity(cfg.ghl, contactId, {
    pipeline: RATE_TBI_PIPELINE.name,
    stage: RATE_TBI_PIPELINE.newStage,
    name: `${r.firstName} – ${p.title} x${r.qty} – ${value} lei`,
    valueRon: r.valueLei,
  })

  let hook: RateTbiResult['hook'] = 'off'
  if (cfg.rateTbi.hook) {
    try {
      const res = await fetch(cfg.rateTbi.hook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contact_id: contactId,
          first_name: r.firstName,
          name: r.name,
          phone: r.phone,
          email: r.email,
          city: r.city,
          produs: p.title,
          cantitate: r.qty,
          valoare: value,
          pagina: r.page ? STORE + r.page : '',
          utm_source: r.utm.source ?? '',
          utm_medium: r.utm.medium ?? '',
          utm_campaign: r.utm.campaign ?? '',
          utm_content: r.utm.content ?? '',
          utm_term: r.utm.term ?? '',
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      })
      hook = res.ok ? 'sent' : 'failed'
      if (!res.ok) log.warn('rate_tbi.hook_failed', { status: res.status })
    } catch (e) {
      hook = 'failed'
      log.warn('rate_tbi.hook_failed', { error: errText(e) })
    }
  }

  let meta: RateTbiResult['meta'] = 'off'
  if (cfg.metaCapi) {
    if (cfg.metaCapi.requireConsent && !r.marketing) meta = 'no-consent'
    else {
      const base = {
        event_time: Math.floor(now.getTime() / 1000),
        event_source_url: STORE + (r.page ?? `/products/${r.product}`),
        action_source: 'website' as const,
        user_data: metaFormUserData({ email: r.email, phone: r.phone, name: r.name, city: r.city, fbp: r.fbp, fbc: r.fbc, ip: client.ip, ua: client.ua }),
      }
      const custom_data = { currency: 'RON', value: r.valueLei, content_name: p.title, content_ids: [r.product], content_type: 'product', num_items: r.qty }
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
  return { contactId, opportunityId, hook, meta }
}
