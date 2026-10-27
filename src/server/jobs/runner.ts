/**
 * Runs queued side effects. Called right after a request that queued work (via `after`),
 * every minute by the in-process timer (instrumentation.ts), and by /api/jobs/run.
 * A failure never touches the order's payment state: it is retried with backoff and,
 * after the last attempt, shown in /admin for a person.
 */
import 'server-only'
import { after } from 'next/server'
import { getConfig, type GhlConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { FgoError, fgo } from '@/server/integrations/fgo'
import { MetaError, sendMetaPurchase } from '@/server/integrations/meta'
import { digitalTags, GhlError, TAGS, ghl, placedTags, tagsFor } from '@/server/integrations/ghl'
import { entitlements } from '@/server/digital/entitlements'
import { renderEmail, stillDue, type EmailTemplate } from '@/server/integrations/email/templates'
import { deliver, EmailError } from '@/server/integrations/email/transport'
import { NOTIFICATIONS, renderNotification, type NotifyEvent } from '@/server/notifications'
import { CART_INTEREST, interestOf, leads, recoveryDecision, recoveryFacts } from '@/server/leads'
import { renderLeadRecovery } from '@/server/leads-email'
import { isIntlHost, siteOrigin } from '@/lib/sites'
import { marketing } from '@/server/marketing/consent'
import { CALL_TAGS, INTEREST_TAG, LEAD_TAGS, attributionTags, callOutcomeTag, landingTag, siteTag } from '@/server/integrations/ghl'
import { isLandingSlug } from '@/lib/landing-hosts'
import { prospectFor } from '@/server/prospects'
import { replies } from '@/server/replies'
import { deliverPush, stillTrue, type PushEvent } from '@/server/app/push'
import { callConsent } from '@/server/calling/consent'
import { leadItems, recoveryCode, recoveryLink, renderRecoveryOffer, RECOVERY_PERCENT } from '@/server/calling/offer'
import { renderCartRecovery } from '@/server/cart-email'
import { givenName } from '@/server/calling/names'
import { getProduct } from '@/content/catalog'
import { priceLines } from '@/lib/promotions'
import { shippingFor } from '@/lib/shipping'
import { convertUnit, formatMoney, type Currency } from '@/lib/currency'
import { promoCodes } from '@/server/promo'
import { renderWelcome } from '@/server/welcome'
import { syncAgentPrices } from '@/server/calling/agent-sync'
import { ensureStoreSettings, saveFx } from '@/server/store-settings'
import { fetchRates } from '@/server/fx'
import { revalidatePath } from 'next/cache'
import { WELCOME_GIFTS, isWelcomeGift } from '@/config/promotions'
import { calls, leadProduct, renderCallFollowUp, renderCallLink, runCallAttempt, runCallCheck, type StepResult } from '@/server/calling/calls'
import { companyLine } from '@/config/company'
import { errText, log } from '@/server/log'
import { marketingStatus } from '@/server/marketing/sync'
import { orders } from '@/server/orders/repository'
import { isPaid } from '@/server/orders/state'
import type { Order } from '@/server/orders/model'
import { reconcileCardPayment } from '@/server/orders/reconcile'
import { releaseUpsellCard } from '@/server/orders/upsell'
import { syncEnquiry } from '@/server/enquiries'
import { expireUnpaidTransfer, markAbandonedIfUnpaid } from '@/server/orders/service'
import { withdrawals } from '@/server/orders/withdrawal'
import { renderSupportNotice, supportRequests } from '@/server/assistant/support'
import { DigitalPermanent, DigitalSkip, runDigitalEmail } from '@/server/digital/delivery'
import { WORKFLOWS, type WorkflowId } from '@/config/workflows'
import { sendTag } from '@/server/workflows/ghl-map'
import { ghlFields, sendsLive, workflowValues, workflowsGhl } from '@/server/workflows/live'
import { jobs, type Job } from './outbox'

class Skip extends Error {}
class Permanent extends Error {}

/** The GHL contact this site already linked to an address (an order, a lead or a message), if any. */
async function knownContactId(db: Awaited<ReturnType<typeof getDb>>, email: string): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>(
    `select ghl_contact_id as id from orders where email = $1 and ghl_contact_id is not null
     union all select ghl_contact_id from leads where email = $1 and ghl_contact_id is not null
     union all select ghl_contact_id from enquiries where email = $1 and ghl_contact_id is not null
     limit 1`,
    [email.trim().toLowerCase()],
  )
  return rows[0]?.id ?? null
}

/** The product's photo (the chosen frame's, for Amber) for an email, resized by the site's image service. */
function productImageUrl(origin: string, productId: string, variantId?: string | null) {
  const p = getProduct(productId)
  const img = (variantId && p?.variants?.find((v) => v.id === variantId)?.images[0]) || p?.cutout
  // A built image is { src: '/_next/static/media/…' }; outside a Next build (tests) it can be a plain path.
  const src = typeof img?.src === 'string' ? (img.src as string) : img?.src.src
  return src?.startsWith('/') ? `${origin}/_next/image?url=${encodeURIComponent(src)}&w=384&q=75` : null
}

/** A calling step's result, in the queue's terms. */
const step = (r: StepResult) => {
  if ('skip' in r) throw new Skip(r.skip)
  return r.note
}

/**
 * The purchase tags also go to the mirror sub-accounts (only where the address already exists; never a new
 * contact), so a "has not bought" filter there sees the purchase. A mirror failure never fails the order's sync.
 */
async function mirrorPurchaseTags(c: ReturnType<typeof getConfig>, o: Order) {
  const tags = [...tagsFor(o).filter((t) => t.startsWith('bt-cumparat-')), ...placedTags(o)]
  if (!tags.length) return
  for (const m of c.ghlTagMirrors) {
    try {
      const id = await ghl.findContactId(m, o.email)
      if (id) await ghl.addTags(m, id, tags)
    } catch (e) {
      log.warn('ghl.mirror_tags_failed', { orderId: o.id, location: m.locationId, error: errText(e) })
    }
  }
}

async function syncCrm(orderId: string) {
  const c = getConfig()
  if (!c.ghl) throw new Skip('ghl not configured')
  const db = await getDb()
  const o = await orders.byId(db, orderId)
  if (!o) throw new Skip('order gone')
  // The contact shows the address's latest order and its current marketing status, whichever order is syncing.
  const latest = (await orders.latestKnown(db, o.email)) ?? o
  const m = await marketingStatus(db, o.email, c.siteUrl)
  const contactId = await ghl.upsertContact(c.ghl, latest, await orders.lifetime(db, o.email), m.fields, c.siteUrl, o.ghlContactId ?? latest.ghlContactId ?? (await knownContactId(db, o.email)))
  // The book's PDF state, from its entitlement (granted, emailed, downloaded; access removed when revoked).
  const digital = digitalTags(await entitlements.byOrder(db, o.id))
  await ghl.addTags(c.ghl, contactId, [...tagsFor(o), ...placedTags(o), ...digital.add])
  if (digital.remove.length) await ghl.removeTags(c.ghl, contactId, digital.remove)
  await mirrorPurchaseTags(c, o)
  // The application sends the recovery email (lead system); the W2 tag is never set, and removed where it was.
  if (m.recoverable || m.hadRecovery) await ghl.removeTags(c.ghl, contactId, [TAGS.recovery])
  const parentNumber = o.parentOrderId ? (await orders.byId(db, o.parentOrderId))?.orderNumber : null
  // The person's place in the leads / customers pipelines follows their orders (bought, cancelled, refunded);
  // first, so a problem with the order pipeline never holds it.
  await syncProspect(db, c.ghl, o.email, contactId)
  const oppId = await ghl.syncOpportunity(c.ghl, o, contactId, o.ghlOpportunityId, parentNumber)
  if (contactId !== o.ghlContactId || oppId !== o.ghlOpportunityId) await orders.update(db, o.id, { ghl_contact_id: contactId, ghl_opportunity_id: oppId })
  return contactId
}

/**
 * The address's opportunity in the leads pipeline, at the stage our database says. Never fails the job that
 * called it (the contact and tags are what matter most); a missing pipeline is logged by the client.
 */
async function syncProspect(db: Awaited<ReturnType<typeof getDb>>, c: GhlConfig, email: string, contactId: string, site?: 'ro' | 'net') {
  try {
    const p = await prospectFor(db, email, site ? { site } : undefined)
    if (!p) return null
    await ghl.addTags(c, contactId, [siteTag(p.site)])
    const addr = email.trim().toLowerCase()
    const known = await db.query<{ id: string }>('select ghl_opportunity_id as id from crm_prospects where email = $1', [addr])
    const id = await ghl.syncLeadOpportunity(c, contactId, { name: p.name === addr ? addr : `${p.name} · ${addr}`, stage: p.stage, products: p.products, valueRon: p.valueRon }, known.rows[0]?.id)
    if (id && id !== known.rows[0]?.id)
      await db.query(
        `insert into crm_prospects (email, ghl_opportunity_id) values ($1, $2)
         on conflict (email) do update set ghl_opportunity_id = excluded.ghl_opportunity_id, updated_at = now()`,
        [addr, id],
      )
    return id
  } catch (e) {
    log.warn('ghl.prospect_failed', { error: errText(e) })
    return null
  }
}

const handlers: Record<Job['kind'], (j: Job) => Promise<string | void>> = {
  'ghl.sync': async (j) => void (await syncCrm(j.orderId!)),

  // After an unsubscribe (or a consent change without an order): only the marketing fields and the recovery tag.
  'marketing.sync': async (j) => {
    const c = getConfig()
    if (!c.ghl) throw new Skip('ghl not configured')
    const db = await getDb()
    const email = String(j.payload.email ?? '')
    // Only addresses the CRM has (or gets) through an order or a lead; matched by email, so never a duplicate.
    const { rows } = await db.query(
      'select 1 from orders where email = $1 and ghl_contact_id is not null union all select 1 from leads where email = $1 union all select 1 from welcome_signups where email = $1 limit 1',
      [email],
    )
    if (!rows.length) {
      // An order placed a moment ago reaches the CRM on its own job: wait for it instead of losing the update.
      const pending = await db.query('select 1 from orders where email = $1 limit 1', [email])
      if (pending.rows.length) throw new Error('the order is not in the CRM yet')
      throw new Skip('address not in the CRM')
    }
    const m = await marketingStatus(db, email, c.siteUrl)
    const contactId = await ghl.updateMarketing(c.ghl, email, m.fields, await knownContactId(db, email))
    await db.query('update leads set ghl_contact_id = $2 where email = $1 and ghl_contact_id is null', [email, contactId])
    if (m.recoverable || m.hadRecovery) await ghl.removeTags(c.ghl, contactId, [TAGS.recovery])
    // AI calls: their own consent (by phone number), shown as a tag, never inferred from the email consent.
    const callable = await callConsent.grantedForEmail(db, email)
    if (callable) await ghl.addTags(c.ghl, contactId, [TAGS.callConsent])
    else await ghl.removeTags(c.ghl, contactId, [TAGS.callConsent])
    await syncProspect(db, c.ghl, email, contactId)
    return `${m.fields.consent ? 'consent' : 'no consent'}, calls ${callable ? 'yes' : 'no'}`
  },

  'email.send': async (j) => {
    const c = getConfig()
    const db = await getDb()
    let o = await orders.byId(db, j.orderId!)
    if (!o) throw new Skip('order gone')
    const template = j.payload.template as EmailTemplate
    const due = stillDue[template]
    if (due && !due(o)) throw new Skip(`no longer due: ${o.status} / ${o.paymentStatus}`)
    if (c.email.transport === 'ghl' && !o.ghlContactId) {
      await syncCrm(o.id)
      o = (await orders.byId(db, o.id))!
    }
    const withdrawal = template === 'withdrawal_received' ? await withdrawals.byId(String(j.payload.withdrawalId ?? '')) : null
    if (template === 'withdrawal_received' && !withdrawal) throw new Skip('withdrawal statement gone')
    const mail = renderEmail(template, o, { siteUrl: c.siteUrl, bank: c.bank, withdrawal: withdrawal ?? undefined })
    const ref = await deliver(c, { ...mail, name: `${o.orderNumber}-${template}${withdrawal ? `-${withdrawal.reference}` : ''}`, to: o.email, ghlContactId: o.ghlContactId })
    await orders.event(db, o.id, 'email.sent', 'system', { template, ref })
    return ref
  },

  // The team's notification for one event of one order (orders@), rechecked against the order first.
  'notify.send': async (j) => {
    const c = getConfig()
    if (!notificationsOn()) throw new Skip('notifications off')
    const db = await getDb()
    const o = await orders.byId(db, j.orderId!)
    if (!o) throw new Skip('order gone')
    const event = j.payload.event as NotifyEvent
    if (!NOTIFICATIONS[event]) throw new Permanent(`unknown notification ${String(event)}`)
    const failed = event === 'job_failed' ? await jobs.byId(db, Number(j.payload.jobId)) : null
    const ctx = {
      siteUrl: c.siteUrl,
      parentNumber: o.parentOrderId ? ((await orders.byId(db, o.parentOrderId))?.orderNumber ?? null) : null,
      ...(failed && { job: { id: failed.id, kind: failed.kind, status: failed.status, lastError: failed.lastError, template: failed.payload.template as string | undefined } }),
    }
    if (!NOTIFICATIONS[event].stillTrue(o, ctx)) throw new Skip(`no longer true: ${o.status} / ${o.paymentStatus}`)
    const mail = renderNotification(event, o, ctx)
    const ref = await deliver(c, { ...mail, to: c.email.notifyTo!, name: j.dedupeKey.replace(/[^\w.-]+/g, '-') })
    await orders.event(db, o.id, 'notify.sent', 'system', { event, ref })
    return ref
  },

  // A lead's identity and interest in the CRM: contact upsert and tags only (no opportunity, no order fields).
  'ghl.lead': async (j) => {
    const c = getConfig()
    if (!c.ghl) throw new Skip('ghl not configured')
    const db = await getDb()
    const lead = await leads.byId(db, String(j.payload.leadId ?? ''))
    if (!lead) throw new Skip('lead gone')
    const contactId = await ghl.upsertLeadContact(c.ghl, lead, lead.ghlContactId ?? (await knownContactId(db, lead.email)))
    // Stored at once on every lead of the address, so the next sync updates this contact instead of creating one.
    await db.query('update leads set ghl_contact_id = $2 where email = $1 and (ghl_contact_id is null or id = $3)', [lead.email, contactId, lead.id])
    const products = lead.productId && lead.productId !== CART_INTEREST ? [lead.productId] : (lead.cart ?? []).map((l) => l.productId)
    await ghl.addTags(c.ghl, contactId, [
      LEAD_TAGS.lead,
      LEAD_TAGS.visible,
      ...(lead.stage !== 'lead' ? [LEAD_TAGS.checkout] : []),
      ...(lead.stage === 'ordered' || lead.stage === 'purchased' ? [LEAD_TAGS.converted] : []),
      ...products.map((p) => INTEREST_TAG[p]).filter(Boolean),
      ...attributionTags(lead.attribution),
    ])
    await syncProspect(db, c.ghl, lead.email, contactId)
    return contactId
  },

  // A 10% popup address in the CRM: contact (email only), lead tags and the leads pipeline. Never an order workflow.
  'ghl.welcome': async (j) => {
    const c = getConfig()
    if (!c.ghl) throw new Skip('ghl not configured')
    const db = await getDb()
    const email = String(j.payload.email ?? '').trim().toLowerCase()
    if (!email) throw new Permanent('no email')
    const contactId = await ghl.upsertLeadContact(c.ghl, { name: null, email, phone: null }, await knownContactId(db, email))
    // bt-landing-<slug> starts that landing's sequence in GoHighLevel (only set while LANDING_GHL_SEQUENCES=on).
    const landing = isLandingSlug(j.payload.landing) ? [landingTag(j.payload.landing)] : []
    await ghl.addTags(c.ghl, contactId, [LEAD_TAGS.lead, LEAD_TAGS.popup, ...landing])
    await syncProspect(db, c.ghl, email, contactId, j.payload.site === 'net' ? 'net' : 'ro')
    return contactId
  },

  // One recovery step for a lead, decided now: abandonment is recorded; an email only with consent.
  'lead.recovery': async (j) => {
    const c = getConfig()
    const db = await getDb()
    const lead = await leads.byId(db, String(j.payload.leadId ?? ''))
    if (!lead) throw new Skip('lead gone')
    const step = Number(j.payload.step) === 3 ? 3 : Number(j.payload.step) === 2 ? 2 : 1
    // An unpaid card order whose Abandoned Cart workflow sends live for this address: its four approved emails replace
    // these, so the customer never gets both.
    if (lead.orderId && sendsLive('abandoned-cart', lead.email)) throw new Skip('handled by the abandoned-cart workflow')
    // An AI call for this lead is about to happen: its email (with the personal code) is the first recovery
    // email, so the regular first email waits until after it (and is skipped when the call's email went out).
    if (step === 1) {
      // Also while the call is ringing or under way (its job is done, the conversation is not): never an email mid-call.
      const { rows } = await db.query(
        `select 1 from jobs where kind = 'call.attempt' and payload->>'leadId' = $1 and status in ('pending', 'retry', 'running') and run_at <= now() + interval '15 minutes'
         union all select 1 from calls where lead_id::text = $1 and status in ('scheduled', 'dialing') and created_at > now() - interval '30 minutes'
         limit 1`,
        [lead.id],
      )
      if (rows.length && lead.recoverySent === 0) {
        await jobs.enqueue(db, { kind: 'lead.recovery', dedupeKey: `${j.dedupeKey}:after-call:${Date.now()}`, payload: j.payload, runAt: new Date(Date.now() + 20 * 60_000) })
        throw new Skip('waiting for the AI call')
      }
    }
    const own = c.email.transport === 'smtp' || c.email.transport === 'file'
    const facts = await recoveryFacts(db, lead)
    const now = new Date()
    const d = recoveryDecision(lead, { stage: String(j.payload.stage), step, now, features: c.features, firstMinutes: c.recovery.firstMinutes, secondHours: c.recovery.secondHours, thirdHours: c.recovery.thirdHours, abandonAfterMinutes: c.abandonAfterMinutes, ...facts, canSend: own, notTestRecipient: !!c.recovery.testRecipients && !c.recovery.testRecipients.includes(lead.email.toLowerCase()) })
    if (!d.send) {
      const patch: Record<string, unknown> = {}
      if (d.abandonment && !lead.abandonment) patch.abandonment = d.abandonment
      if (d.status && d.status !== lead.recoveryStatus && lead.recoveryStatus !== 'stopped') Object.assign(patch, { recovery_status: d.status, recovery_reason: d.reason })
      if (Object.keys(patch).length) await leads.update(db, lead.id, patch)
      // Still active: the same step is planned again from the latest activity (a new key, so it is queued once).
      if (d.later) await jobs.enqueue(db, { kind: 'lead.recovery', dedupeKey: `${j.dedupeKey}:${d.later.getTime()}`, payload: j.payload, runAt: d.later })
      throw new Skip(d.reason)
    }
    const token = await marketing.unsubscribeToken(db, lead.email)
    // The site the visitor used: the international biohack-tech.net, or the main site.
    const intl = isIntlHost(lead.landingHost)
    const origin = intl ? siteOrigin('net', c.siteUrl) : c.siteUrl
    const base = origin
    const unsubscribeUrl = `${origin}${lead.locale === 'en' ? '/en' : ''}/dezabonare/${token}`
    // An abandoned cart: the designed three-email sequence, with the cart, today's prices and the recovery code.
    const cartItems = leadItems(lead)
    if (cartItems.length) {
      await ensureStoreSettings()
      const code = await recoveryCode(db)
      const currency: Currency = intl || lead.locale === 'en' ? 'EUR' : 'RON'
      const lines = cartItems.map((l) => ({ ...l, unit: convertUnit(l.unit, currency) }))
      const pricing = priceLines(lines.map((l, i) => ({ key: String(i), productId: l.productId, variantId: l.variantId, quantity: l.quantity, unitAmount: l.unit })))
      const shippingMinor = shippingFor(lines, currency)
      const mail = renderCartRecovery({
        step,
        locale: lead.locale,
        firstName: lead.name ? givenName(lead.name) || null : null,
        items: lines.map((l) => ({ name: l.name, variant: l.variant, quantity: l.quantity, lineMinor: l.unit * l.quantity, image: productImageUrl(origin, l.productId, l.variantId) })),
        totalMinor: pricing.totalMinor + shippingMinor,
        shippingMinor,
        format: (m) => formatMoney(m, currency),
        code: code ? { code: code.code, percent: RECOVERY_PERCENT } : null,
        link: `${base}/api/lead/resume?t=${lead.recoveryToken}${code ? `&cod=${encodeURIComponent(code.code)}` : ''}`,
        siteUrl: origin,
        unsubscribeUrl,
      })
      const ref = await deliver(c, { ...mail, to: lead.email, name: `lead-recovery-${lead.id}-${step}` })
      await leads.update(db, lead.id, { abandonment: lead.abandonment ?? d.abandonment, recovery_status: 'sent', recovery_reason: `step ${step}`, recovery_sent: step, last_recovery_at: now })
      return ref
    }
    if (step === 3) throw new Skip('the third email needs the cart')
    const mail = renderLeadRecovery({
      locale: lead.locale,
      siteUrl: intl ? siteOrigin('net', c.siteUrl) : c.siteUrl,
      step,
      firstName: lead.name?.split(' ')[0] ?? null,
      products: interestOf(lead),
      link: `${base}/api/lead/resume?t=${lead.recoveryToken}`,
      unsubscribeUrl,
    })
    const ref = await deliver(c, { ...mail, to: lead.email, name: `lead-recovery-${lead.id}-${step}` })
    await leads.update(db, lead.id, { abandonment: lead.abandonment ?? d.abandonment, recovery_status: 'sent', recovery_reason: `step ${step}`, recovery_sent: step, last_recovery_at: now })
    return ref
  },

  // AI calling: one attempt, decided now (consent, purchase, refusal, hours, limits). Never retried by the
  // queue after the provider was asked to dial: an uncertain request is left for a person, not redialed.
  'call.attempt': async (j) => step(await runCallAttempt(await getDb(), getConfig(), { leadId: String(j.payload.leadId ?? ''), attempt: Number(j.payload.attempt ?? 1) }, j.dedupeKey)),

  // A call whose result did not arrive by webhook: read it back from ElevenLabs.
  'call.check': async (j) => step(await runCallCheck(await getDb(), getConfig(), { callId: String(j.payload.callId ?? ''), round: Number(j.payload.round ?? 1) })),

  // The product link the person asked for during the call (a service email, on request).
  'call.link': async (j) => {
    const c = getConfig()
    const db = await getDb()
    const call = await calls.byId(db, String(j.payload.callId ?? ''))
    if (!call) throw new Skip('call gone')
    const lead = await leads.byId(db, call.leadId)
    const product = lead && leadProduct(lead)
    if (!lead || !product || !lead.recoveryToken) throw new Skip('lead gone')
    const own = c.email.transport === 'smtp' || c.email.transport === 'file'
    if (!own) throw new Skip('no own email transport')
    if (call.optedOut) throw new Skip('opted out')
    // Asked for during the call: the code and the link (once; already sent before the call → nothing more).
    if (call.discountCode) {
      if (call.emailStatus === 'sent' || call.emailStatus === 'sent_on_request') throw new Skip('offer already emailed')
      const code = await promoCodes.get(db, call.discountCode)
      if (!code?.active) throw new Skip('code switched off')
      const token = await marketing.unsubscribeToken(db, lead.email)
      const mail = renderRecoveryOffer({ firstName: lead.name?.split(' ')[0] ?? null, items: leadItems(lead), code: code.code, link: recoveryLink(lead, code.code, c), unsubscribeUrl: `${c.siteUrl}/dezabonare/${token}` })
      const ref = await deliver(c, { ...mail, to: lead.email, name: `call-offer-request-${call.id}` })
      await calls.update(db, call.id, { email_status: 'sent_on_request' })
      // It is the lead's first recovery email: the regular sequence skips its own first one (one email with the code).
      await db.query(
        `update leads set recovery_sent = greatest(recovery_sent, 1), last_recovery_at = now(), recovery_status = case when recovery_status = 'stopped' then recovery_status else 'sent' end,
           recovery_reason = 'call offer (asked)', updated_at = now() where id = $1`,
        [lead.id],
      )
      return ref
    }
    // The recovery link puts the checkout's cart back.
    const mail = renderCallLink({ firstName: lead.name?.split(' ')[0] ?? null, productName: product.name, link: `${c.siteUrl}/api/lead/resume?t=${lead.recoveryToken}`, company: companyLine() || null })
    return deliver(c, { ...mail, to: lead.email, name: `call-link-${call.id}` })
  },

  // The AI agent learns the prices and stock set in /admin/setari (instructions and knowledge rebuilt).
  'agent.sync': async () => {
    const c = getConfig()
    if (!c.elevenlabs) throw new Skip('ElevenLabs not configured')
    await ensureStoreSettings(0)
    return `knowledge ${await syncAgentPrices(c.elevenlabs, c.siteUrl)}`
  },

  // The private iOS app's notification: a payment (KA-CHING) or an unpaid order placed (server/app/push.ts).
  'push.send': async (j) => {
    const c = getConfig()
    if (!c.apns) throw new Skip('APNs not configured')
    const db = await getDb()
    const o = await orders.byId(db, j.orderId!)
    if (!o) throw new Skip('order gone')
    const event = j.payload.event as PushEvent
    if (event !== 'payment' && event !== 'new_cod' && event !== 'new_transfer') throw new Permanent(`unknown push ${String(event)}`)
    if (!stillTrue(event, o)) throw new Skip(`no longer true: ${o.status} / ${o.paymentStatus}`)
    return deliverPush(db, c.apns, j.dedupeKey, event, o)
  },

  // A reply the team wrote in /admin (Mesaje, Suport): sent from our own mailbox, marked in the conversation.
  'email.reply': async (j) => {
    const c = getConfig()
    const db = await getDb()
    const id = String(j.payload.replyId ?? '')
    const mail = await replies.render(db, id)
    if (!mail) throw new Skip('reply gone')
    if (c.email.transport !== 'smtp' && c.email.transport !== 'file') {
      await replies.mark(db, id, 'failed', 'fără căsuța noastră de email (EMAIL_TRANSPORT)')
      throw new Skip('no own email transport')
    }
    try {
      const ref = await deliver(c, { ...mail, name: `reply-${id}` })
      await replies.mark(db, id, 'sent')
      return ref
    } catch (e) {
      await replies.mark(db, id, 'failed', errText(e))
      throw e
    }
  },

  // The website popup's code (LONGEVITY10, or the gift drawn from a box), once per address; still only with the marketing consent in force.
  'email.welcome': async (j) => {
    const c = getConfig()
    const db = await getDb()
    const email = String(j.payload.email ?? '')
    if (c.email.transport !== 'smtp' && c.email.transport !== 'file') throw new Skip('no own email transport')
    if (!(await marketing.state(db, email))?.granted) throw new Skip('no marketing consent')
    const gift = isWelcomeGift(j.payload.gift) ? j.payload.gift : 'p10'
    const code = await promoCodes.get(db, WELCOME_GIFTS[gift].code)
    if (!code?.active) throw new Skip('code switched off')
    const token = await marketing.unsubscribeToken(db, email)
    const origin = siteOrigin(j.payload.site === 'net' ? 'net' : 'ro', c.siteUrl)
    const en = j.payload.locale === 'en'
    const mail = renderWelcome({ siteUrl: origin, unsubscribeUrl: `${origin}${en ? '/en' : ''}/dezabonare/${token}`, code: code.code, locale: en ? 'en' : 'ro', gift })
    return deliver(c, { ...mail, to: email, name: `welcome-${email.replace(/[^\w.-]+/g, '-')}` })
  },

  // The team hears about a call that needs a person (asked for a human, or a question the agent could not answer).
  'call.notify': async (j) => {
    const c = getConfig()
    if (!notificationsOn()) throw new Skip('notifications off')
    const db = await getDb()
    const call = await calls.byId(db, String(j.payload.callId ?? ''))
    if (!call) throw new Skip('call gone')
    const lead = await leads.byId(db, call.leadId)
    if (!lead) throw new Skip('lead gone')
    const mail = renderCallFollowUp({ call, lead, adminUrl: `${c.siteUrl}/admin/leaduri` })
    return deliver(c, { ...mail, to: c.email.notifyTo!, name: `call-follow-up-${call.id}` })
  },

  // A call's result in the CRM: contact upsert (no duplicate: by email) and outcome tags. Retried on its own.
  // The team hears about each new support request from the website assistant (once: the job's dedupe key).
  'support.notify': async (j) => {
    const c = getConfig()
    if (!notificationsOn()) throw new Skip('notifications off')
    const db = await getDb()
    const r = await supportRequests.byId(db, String(j.payload.id ?? ''))
    if (!r) throw new Skip('request gone')
    const mail = renderSupportNotice(r, `${c.siteUrl}/admin/suport/${r.id}`)
    return deliver(c, { ...mail, to: c.email.notifyTo!, name: `support-${r.id}` })
  },

  // Today's BNR rates for the euro and dollar prices; pages are refreshed so they show the new prices.
  'fx.refresh': async () => {
    const r = await fetchRates()
    const changed = await saveFx(await getDb(), { EUR: r.EUR, USD: r.USD, date: r.date })
    if (changed) {
      try {
        revalidatePath('/', 'layout')
      } catch {}
    }
    return `${r.source} ${r.date} EUR ${r.EUR} USD ${r.USD}${changed ? '' : ' (unchanged)'}`
  },

  'ghl.call': async (j) => {
    const c = getConfig()
    if (!c.ghl) throw new Skip('ghl not configured')
    const db = await getDb()
    const call = await calls.byId(db, String(j.payload.callId ?? ''))
    if (!call) throw new Skip('call gone')
    const lead = await leads.byId(db, call.leadId)
    if (!lead) throw new Skip('lead gone')
    const contactId = await ghl.upsertLeadContact(c.ghl, lead, lead.ghlContactId ?? (await knownContactId(db, lead.email)))
    // Stored at once on every lead of the address, so the next sync updates this contact instead of creating one.
    await db.query('update leads set ghl_contact_id = $2 where email = $1 and (ghl_contact_id is null or id = $3)', [lead.email, contactId, lead.id])
    await ghl.addTags(c.ghl, contactId, [
      CALL_TAGS.called,
      ...(call.outcome ? [callOutcomeTag(call.outcome)] : []),
      ...(call.followUp ? [CALL_TAGS.followUp] : []),
      ...(call.optedOut ? [CALL_TAGS.optedOut] : []),
      ...(call.discountCode ? [CALL_TAGS.discount] : []),
      ...(call.emailStatus === 'sent' ? [CALL_TAGS.offerEmail] : []),
      ...(INTEREST_TAG[call.productId] ? [INTEREST_TAG[call.productId]] : []),
    ])
    return contactId
  },

  'fgo.invoice': async (j) => {
    const c = getConfig()
    const db = await getDb()
    const o = await orders.byId(db, j.orderId!)
    if (!o) throw new Skip('order gone')
    if (o.fgoInvoiceNumber) return `already ${o.fgoInvoiceSeries} ${o.fgoInvoiceNumber}`
    // Cancelled before the invoice went out and no money was taken (a cash-on-delivery parcel refused right
    // after shipping): nothing to invoice, so no document that would then need a credit note.
    if (o.status === 'cancelled' && !['paid', 'partially_refunded', 'refunded'].includes(o.paymentStatus)) {
      await orders.update(db, o.id, { invoice_status: 'none' })
      throw new Skip('order cancelled before invoicing')
    }
    if (!c.fgo) {
      await orders.update(db, o.id, { invoice_status: 'manual' })
      throw new Skip('fgo not configured')
    }
    try {
      const inv = await fgo.issueInvoice(c.fgo, o)
      await orders.update(db, o.id, { invoice_status: 'issued', fgo_invoice_series: inv.series, fgo_invoice_number: inv.number, fgo_invoice_link: inv.link })
      await orders.event(db, o.id, 'invoice.issued', 'system', { series: inv.series, number: inv.number })
      // One email with the invoice; FGO does not email it through the API.
      if (c.email.transport !== 'none') await jobs.enqueue(db, { kind: 'email.send', orderId: o.id, dedupeKey: `email:invoice_issued:${o.id}`, payload: { template: 'invoice_issued' } })
      return `${inv.series} ${inv.number}`
    } catch (e) {
      if (e instanceof FgoError && !e.retryable) {
        await orders.update(db, o.id, { invoice_status: 'failed' })
        throw new Permanent(e.message)
      }
      throw e
    }
  },

  'fgo.storno': async (j) => {
    const c = getConfig()
    const db = await getDb()
    const o = await orders.byId(db, j.orderId!)
    if (!o?.fgoInvoiceNumber || !o.fgoInvoiceSeries) throw new Skip('no invoice')
    if (o.fgoStornoNumber) return `already ${o.fgoStornoNumber}`
    if (!c.fgo) throw new Skip('fgo not configured')
    const s = await fgo.stornoInvoice(c.fgo, o.fgoInvoiceSeries, o.fgoInvoiceNumber)
    await orders.update(db, o.id, { fgo_storno_number: `${s.series} ${s.number}` })
    await orders.event(db, o.id, 'invoice.storno', 'system', s)
  },

  'meta.purchase': async (j) => {
    const c = getConfig()
    if (!c.metaCapi) throw new Skip('META_CAPI_ACCESS_TOKEN not set')
    const o = await orders.byId(await getDb(), j.orderId!)
    if (!o) throw new Skip('order gone')
    if (!isPaid(o.paymentStatus)) throw new Skip('not paid')
    // GDPR: hashed email and phone are still personal data. Only an order whose visitor accepted marketing cookies is
    // sent (orders placed before this was recorded have no choice stored: not sent either).
    if (c.metaCapi.requireConsent && o.attribution?.cookieMarketing !== true) throw new Skip('no marketing cookie consent')
    return sendMetaPurchase(c.metaCapi, o, c.siteUrl)
  },
  // The book's PDF link by email (automatic after a grant, or asked for in /admin); checked again before sending.
  'digital.email': async (j) => {
    try {
      return await runDigitalEmail(j)
    } catch (e) {
      if (e instanceof DigitalSkip) throw new Skip(e.message)
      if (e instanceof DigitalPermanent) throw new Permanent(e.message)
      throw e
    }
  },
  // One live workflow email: checked again now (still active, still allowed, consent for a promotional one), its values
  // written on the contact, then the tag that starts the approved GHL workflow. Never sent with a value missing.
  'ghl.workflow_send': async (j) => {
    const c = getConfig()
    const db = await getDb()
    const template = String(j.payload.template ?? '')
    const { rows } = await db.query('select * from workflow_enrollments where id = $1', [String(j.payload.enrollmentId ?? '')])
    const r = rows[0]
    if (!r) throw new Permanent('enrollment gone')
    const workflow = r.workflow as WorkflowId
    const email = String(r.email)
    const mark = (status: 'sent' | 'skipped', reason: string | null) =>
      db.query('update email_sends set status = $3, reason = $4 where enrollment_id = $1 and template = $2', [r.id, template, status, reason])
    if (r.status === 'stopped') {
      await mark('skipped', `stopped_${r.stop_reason ?? ''}`)
      throw new Skip('enrollment stopped')
    }
    if (!sendsLive(workflow, email)) {
      await mark('skipped', 'not_live')
      throw new Skip('not live for this address')
    }
    const step = WORKFLOWS[workflow].steps.find((s) => s.template === template)
    if (step?.promotional && !(await marketing.state(db, email))?.granted) {
      await mark('skipped', 'no_consent')
      throw new Skip('no marketing consent')
    }
    const { values, missing } = await workflowValues(db, { id: String(r.id), email, workflow, ref: String(r.ref), step: Number(r.step), data: (r.data ?? {}) as Record<string, unknown> }, template, c.siteUrl, (j.payload.voucherId as string | null) ?? null)
    if (missing.length) {
      await mark('skipped', `missing_${missing.join('+')}`)
      throw new Permanent(`missing values: ${missing.join(', ')}`)
    }
    const g = workflowsGhl()
    if (!g) throw new Skip('ghl workflows location not configured')
    const contactId = await ghl.upsertLeadContact(g, { name: null, email, phone: null }, await knownContactId(db, email))
    await ghl.updateFields(g, contactId, ghlFields(values))
    await ghl.addTags(g, contactId, [sendTag(template)])
    await mark('sent', null)
    return contactId
  },
  'stripe.reconcile': async (j) => reconcileCardPayment(j.orderId!),
  'upsell.release': async (j) => releaseUpsellCard(j.orderId!),
  'ghl.enquiry': async (j) => syncEnquiry(String(j.payload.enquiryId ?? '')),
  'order.transfer_expiry': async (j) => {
    const r = await expireUnpaidTransfer(j.orderId!)
    return r.changed ? 'cancelled' : (r.reason ?? 'unchanged')
  },
  // Ask Stripe first: a payment whose webhook was lost must never be marked abandoned.
  'order.abandon_check': async (j) => {
    const reconciled = await reconcileCardPayment(j.orderId!)
    const r = await markAbandonedIfUnpaid(j.orderId!)
    return `${reconciled}; ${r.changed ? r.order?.status : (r.reason ?? 'unchanged')}`
  },
}

/** Team notifications go out only through our own mailbox (or files in development). */
export const notificationsOn = () => {
  const e = getConfig().email
  return !!e.notifyTo && (e.transport === 'smtp' || e.transport === 'file')
}

let running: Promise<number> | null = null

/** Runs due jobs; concurrent calls in one process share the same run. */
export function runDueJobs(limit = 20): Promise<number> {
  running ??= (async () => {
    let n = 0
    try {
      const db = await getDb()
      for (const job of await jobs.claim(db, limit)) {
        n++
        try {
          const note = await handlers[job.kind](job)
          await jobs.done(db, job.id, 'done', note || undefined)
          log.info('job.done', { job: job.kind, jobId: job.id, orderId: job.orderId })
        } catch (e) {
          if (e instanceof Skip) {
            await jobs.done(db, job.id, 'skipped', e.message)
            continue
          }
          const permanent =
            e instanceof Permanent || (e instanceof EmailError && !e.retryable) || (e instanceof GhlError && !e.retryable && e.status !== 404 && e.status !== 401) || (e instanceof MetaError && !e.retryable)
          const dead = await jobs.fail(db, job, errText(e), permanent)
          log[dead ? 'error' : 'warn'](dead ? 'job.failed' : 'job.retry', { job: job.kind, jobId: job.id, orderId: job.orderId, attempt: job.attempts, error: errText(e) })
          // Stopped for good: the team hears about it once (never about its own notifications, which would loop).
          if (dead && job.orderId && job.kind !== 'notify.send' && job.kind !== 'support.notify' && job.kind !== 'push.send' && notificationsOn())
            await jobs
              .enqueue(db, { kind: 'notify.send', orderId: job.orderId, dedupeKey: `notify:job_failed:${job.id}`, payload: { event: 'job_failed', jobId: job.id } })
              .catch((err) => log.error('job.failed_alert_error', { jobId: job.id, error: errText(err) }))
        }
      }
    } catch (e) {
      log.error('jobs.run_error', { error: errText(e) })
    } finally {
      running = null
    }
    return n
  })()
  return running
}

/** Schedules a job run right after the current response is sent. */
export function kickJobs() {
  after(() => runDueJobs().then(() => undefined))
}
