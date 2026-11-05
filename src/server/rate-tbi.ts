/**
 * A "Cumpără în rate prin TBI Bank" request from the Shopify store (lib/rate-tbi.ts has the shape).
 * 1. GoHighLevel (NEUROS, the Biohack location): the contact (found by email, created only if new), the fields
 *    bt_tbi_produs / bt_tbi_valoare / bt_tbi_cantitate, the tags rate-tbi and rate-tbi-<product> (the tag starts the workflow
 *    "BT · Rate TBI · cerere nouă"), a note with every detail and a task "Generează Link 2 Pay – X lei" due in 30 min.
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
/** Contact fields in GHL (NEUROS, folder BiohackTech Ecommerce), read by the workflow's notification and confirmation. */
export const RATE_TBI_FIELDS = { product: 'contact.bt_tbi_produs', value: 'contact.bt_tbi_valoare', qty: 'contact.bt_tbi_cantitate' } as const
const STORE = 'https://biohack-tech.ro'

export type RateTbiResult = { contactId: string; hook: 'sent' | 'off' | 'failed'; meta: 'sent' | 'off' | 'no-consent' | 'failed' }

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
    'Pasul următor: generează Link 2 Pay în bankly.tbicredit.ro și trimite-l clientului pe SMS și email; apoi pune tagul rate-tbi-link-trimis.',
  ].join('\n')
}

export async function submitRateTbi(cfg: Pick<Config, 'ghl' | 'metaCapi' | 'rateTbi'>, r: RateTbiRequest, client: { ip: string | null; ua: string | null }, now = new Date()): Promise<RateTbiResult> {
  if (!cfg.ghl) throw new Error('ghl not configured')
  const p = RATE_TBI_PRODUCTS[r.product]
  const value = lei(r.valueLei)

  const contactId = await ghl.upsertLeadContact(cfg.ghl, { name: r.name, email: r.email, phone: r.phone })
  // The workflow's messages read these fields, so they are written before the tag that starts it.
  await ghl.updateFields(cfg.ghl, contactId, [
    { key: RATE_TBI_FIELDS.product, field_value: p.title },
    { key: RATE_TBI_FIELDS.value, field_value: value },
    { key: RATE_TBI_FIELDS.qty, field_value: String(r.qty) },
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
  return { contactId, hook, meta }
}
