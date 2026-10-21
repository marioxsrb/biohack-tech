/**
 * Leads: who reached the checkout's contact step, what for, from which site and campaign, and what happened
 * next (order, payment). Supabase is the source of
 * truth; GoHighLevel gets a copy of the identity and interest tags, never a decision.
 *
 * One lead per visitor and checkout (a refresh or a second visit updates it). Rows with stage 'lead' are the
 * history of the former price form on acces.<domain> (closed 20.10.2026): nothing new is created or sent for them. Abandonment and recovery are decided here, at the moment a step would happen, from the
 * current data: a recovery email needs the address's email marketing consent (Legea 506/2004 art. 12), so an
 * unfinished checkout alone never allows one. A purchase, an unsubscribe or a stop ends it.
 */
import 'server-only'
import { HOLD_MAX_MS, HOLD_RECHECK_MS, riskHold } from '@/server/risk'
import { randomBytes, randomUUID } from 'node:crypto'
import { getProduct, resolveLine } from '@/content/catalog'
import type { Attribution } from '@/lib/attribution'
import { LEAD_PRIVACY_VERSION, type LeadContact } from '@/lib/lead'
import { getConfig } from '@/server/config'
import type { Queryable, Row } from '@/server/db'
import { jobs, type NewJob } from '@/server/jobs/outbox'
import { marketing } from '@/server/marketing/consent'
import { callConsent, firstCallJob } from '@/server/calling/consent'
import { consentVersionFor } from '@/lib/consent/marketing'
import { romanianE164 } from '@/lib/consent/calling'
import type { Order } from '@/server/orders/model'

export type LeadStage = 'lead' | 'checkout_started' | 'ordered' | 'purchased'
export type CartSnapshot = { productId: string; variantId?: string; quantity: number }[]

export type Lead = {
  id: string
  visitorId: string
  productId: string
  variantId: string | null
  name: string | null
  email: string
  phone: string | null
  stage: LeadStage
  cart: CartSnapshot | null
  attribution: Attribution | null
  landingHost: string | null
  /** The language the visitor used: recovery emails follow it. */
  locale: 'ro' | 'en'
  fbclid: string | null
  privacyVersion: string | null
  marketingConsent: boolean
  callConsent: boolean
  /** AI calling: none | scheduled | dry_run | dialing | completed | failed | stopped | disabled. */
  callStatus: string
  callAttempts: number
  callOutcome: string | null
  lastCallAt: Date | null
  callDisabled: boolean
  orderId: string | null
  abandonment: 'lead_abandoned' | 'checkout_abandoned' | null
  recoveryStatus: string
  recoveryReason: string | null
  recoverySent: number
  lastRecoveryAt: Date | null
  recoveryToken: string | null
  ghlContactId: string | null
  checkoutStartedAt: Date | null
  orderedAt: Date | null
  purchasedAt: Date | null
  lastActivityAt: Date
  createdAt: Date
}

/** The row for a whole checkout (several products) in the lead table. */
export const CART_INTEREST = 'cart'

const d = (v: unknown) => (v ? new Date(v as string) : null)
const toLead = (r: Row): Lead => ({
  id: r.id as string,
  visitorId: r.visitor_id as string,
  productId: r.product_id as string,
  variantId: (r.variant_id as string) ?? null,
  name: (r.name as string) ?? null,
  email: r.email as string,
  phone: (r.phone as string) ?? null,
  stage: r.stage as LeadStage,
  cart: (r.cart as CartSnapshot) ?? null,
  attribution: (r.attribution as Attribution) ?? null,
  landingHost: (r.landing_host as string) ?? null,
  locale: r.locale === 'en' ? 'en' : 'ro',
  fbclid: (r.fbclid as string) ?? null,
  privacyVersion: (r.privacy_version as string) ?? null,
  marketingConsent: !!r.marketing_consent,
  callConsent: !!r.call_consent,
  callStatus: (r.call_status as string) ?? 'none',
  callAttempts: Number(r.call_attempts ?? 0),
  callOutcome: (r.call_outcome as string) ?? null,
  lastCallAt: d(r.last_call_at),
  callDisabled: !!r.call_disabled,
  orderId: (r.order_id as string) ?? null,
  abandonment: (r.abandonment as Lead['abandonment']) ?? null,
  recoveryStatus: r.recovery_status as string,
  recoveryReason: (r.recovery_reason as string) ?? null,
  recoverySent: Number(r.recovery_sent),
  lastRecoveryAt: d(r.last_recovery_at),
  recoveryToken: (r.recovery_token as string) ?? null,
  ghlContactId: (r.ghl_contact_id as string) ?? null,
  checkoutStartedAt: d(r.checkout_started_at),
  orderedAt: d(r.ordered_at),
  purchasedAt: d(r.purchased_at),
  lastActivityAt: new Date(r.last_activity_at as string),
  createdAt: new Date(r.created_at as string),
})

/** Only products and variants the store sells, with sane quantities. Anything else is dropped. */
export function sanitizeCart(raw: unknown): CartSnapshot {
  if (!Array.isArray(raw)) return []
  const out: CartSnapshot = []
  for (const item of raw.slice(0, 20)) {
    const { productId, variantId, quantity } = (item ?? {}) as Record<string, unknown>
    if (typeof productId !== 'string') continue
    const v = typeof variantId === 'string' && variantId ? variantId : undefined
    const r = resolveLine(productId, v)
    const q = Math.floor(Number(quantity))
    if (!r || r.unit === null || !Number.isFinite(q) || q < 1) continue
    out.push({ productId: r.product.id, ...(r.variant && { variantId: r.variant.id }), quantity: Math.min(q, 10) })
  }
  return out
}

export type CaptureInput = {
  visitorId: string
  stage: 'checkout_started'
  /** CART_INTEREST: the whole checkout. */
  productId: string
  variantId?: string | null
  contact: LeadContact
  marketingConsent: boolean
  /** The separate, optional AI calling box (never implied by anything else). */
  callConsent?: boolean
  cart?: CartSnapshot
  attribution?: Attribution | null
  landingHost?: string | null
  page?: string
  /** The visitor's language and site: emails follow the language; the international site never calls. */
  locale?: 'ro' | 'en'
  site?: 'ro' | 'net'
}

/**
 * Creates or updates the lead for (visitor, checkout) in one statement, so two submits at once give one
 * row. A stage only moves forward; an unticked box never removes an earlier consent. Queues the CRM copy and the
 * abandonment checks for a new stage.
 */
export async function captureLead(t: Queryable, input: CaptureInput): Promise<{ lead: Lead; created: boolean; stageChanged: boolean }> {
  const c = getConfig()
  const now = new Date()
  const { rows } = await t.query(
    `insert into leads (id, visitor_id, funnel, product_id, variant_id, name, email, phone, stage, cart, attribution, landing_host, fbclid,
       privacy_version, marketing_consent, recovery_token, checkout_started_at, last_activity_at, created_at, updated_at, call_consent, locale)
     values ($1,$2,'visible_price',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17,$17,$18,$19)
     on conflict (visitor_id, funnel, product_id) do update set
       variant_id = coalesce(excluded.variant_id, leads.variant_id),
       name = coalesce(nullif(excluded.name, ''), leads.name),
       email = excluded.email,
       phone = coalesce(nullif(excluded.phone, ''), leads.phone),
       stage = case when leads.stage = 'lead' and excluded.stage = 'checkout_started' then 'checkout_started' else leads.stage end,
       cart = coalesce(excluded.cart, leads.cart),
       attribution = coalesce(leads.attribution, excluded.attribution),
       fbclid = coalesce(leads.fbclid, excluded.fbclid),
       marketing_consent = leads.marketing_consent or excluded.marketing_consent,
       call_consent = leads.call_consent or excluded.call_consent,
       locale = excluded.locale,
       checkout_started_at = coalesce(leads.checkout_started_at, excluded.checkout_started_at),
       last_activity_at = excluded.last_activity_at,
       updated_at = excluded.updated_at
     returning *, (xmax = 0) as inserted, (select stage from leads l2 where l2.id = leads.id) as prev_stage`,
    [
      randomUUID(),
      input.visitorId,
      input.productId,
      input.variantId ?? null,
      input.contact.name || null,
      input.contact.email,
      input.contact.phone || null,
      input.stage,
      input.cart && input.cart.length ? JSON.stringify(input.cart) : null,
      input.attribution ? JSON.stringify(input.attribution) : null,
      input.landingHost ?? null,
      input.attribution?.fbclid ?? null,
      LEAD_PRIVACY_VERSION,
      input.marketingConsent,
      randomBytes(24).toString('base64url'),
      now,
      now,
      !!input.callConsent && input.site !== 'net',
      input.locale ?? 'ro',
    ],
  )
  const r = rows[0]
  const lead = toLead(r)
  const created = !!r.inserted
  const stageChanged = created || (r.prev_stage as string) !== lead.stage
  // Proof of the ticked box: the exact wording and version, linked to nothing but the address and page.
  let synced = false
  if (input.marketingConsent) {
    const state = await marketing.state(t, lead.email)
    if (!state?.granted) {
      const id = await marketing.grant(t, { email: lead.email, source: 'lead_form', page: input.page ?? '/checkout', version: consentVersionFor(input.site ?? 'ro', input.locale ?? 'ro') })
      // The consent reaches the CRM like an unsubscribe does: the marketing fields only, on its own job.
      // A minute later, so the lead's own contact sync (ghl.lead) has stored the contact id it updates: GHL's
      // search does not see a brand-new contact for a while, and a second lookup would create a duplicate.
      if (c.ghl) await jobs.enqueue(t, { kind: 'marketing.sync', dedupeKey: `marketing.sync:${id}`, payload: { email: lead.email }, runAt: new Date(Date.now() + 60_000) })
      synced = true
    }
  }
  if (stageChanged || created) for (const j of leadJobs(lead, c)) await jobs.enqueue(t, j)
  // AI calling: only with the separate box ticked here and a Romanian number. Recorded by phone number.
  const phone = romanianE164(lead.phone)
  if (input.callConsent && phone && input.site !== 'net') {
    const state = await callConsent.state(t, phone)
    if (!state?.granted) {
      const id = await callConsent.grant(t, { phone, email: lead.email, source: 'checkout', page: input.page, leadId: lead.id })
      // The CRM tag for calls follows on the same job as the marketing fields (one job when both changed).
      if (c.ghl && !synced) await jobs.enqueue(t, { kind: 'marketing.sync', dedupeKey: `marketing.sync:call:${id}`, payload: { email: lead.email }, runAt: new Date(Date.now() + 60_000) })
    }
  }
  if (lead.callConsent && phone && c.calling.enabled && input.site !== 'net') await jobs.enqueue(t, firstCallJob(lead, c, phone))
  return { lead, created, stageChanged }
}

/** The CRM copy and the abandonment checks of an unfinished checkout. */
function leadJobs(lead: Lead, c = getConfig()): NewJob[] {
  const list: NewJob[] = []
  if (c.ghl) list.push({ kind: 'ghl.lead', dedupeKey: `ghl.lead:${lead.id}:${lead.stage}`, payload: { leadId: lead.id } })
  if (c.features.abandonedCheckout && lead.stage === 'checkout_started') {
    const base = lead.lastActivityAt.getTime()
    list.push(
      { kind: 'lead.recovery', dedupeKey: `lead.recovery:${lead.id}:${lead.stage}:1`, payload: { leadId: lead.id, stage: lead.stage, step: 1 }, runAt: new Date(base + c.recovery.firstMinutes * 60_000) },
      { kind: 'lead.recovery', dedupeKey: `lead.recovery:${lead.id}:${lead.stage}:2`, payload: { leadId: lead.id, stage: lead.stage, step: 2 }, runAt: new Date(base + c.recovery.secondHours * 3_600_000) },
    )
    // A third, last email.
    list.push({ kind: 'lead.recovery', dedupeKey: `lead.recovery:${lead.id}:${lead.stage}:3`, payload: { leadId: lead.id, stage: lead.stage, step: 3 }, runAt: new Date(base + c.recovery.thirdHours * 3_600_000) })
  }
  return list
}

export const leads = {
  async byId(q: Queryable, id: string) {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null
    const { rows } = await q.query('select * from leads where id = $1', [id])
    return rows[0] ? toLead(rows[0]) : null
  },
  async byRecoveryToken(q: Queryable, token: string) {
    if (!/^[\w-]{20,64}$/.test(token)) return null
    const { rows } = await q.query('select * from leads where recovery_token = $1', [token])
    return rows[0] ? toLead(rows[0]) : null
  },
  async forVisitor(q: Queryable, visitorId: string) {
    return (await q.query('select * from leads where visitor_id = $1 order by created_at', [visitorId])).rows.map(toLead)
  },
  /** For /admin: newest first. `view`: abandoned (lead or checkout), converted (ordered or paid), or all. */
  async list(q: Queryable, f: { view?: 'abandoned' | 'converted'; limit?: number; unique?: boolean } = {}) {
    return (await leads.listWithForms(q, f)).map((x) => x.lead)
  },
  /**
   * The same list with, for each row, how many forms the person (email) sent in the filtered set. `unique`: one
   * row per person, their newest form (the duplicate filter); otherwise every form.
   */
  async listWithForms(q: Queryable, f: { view?: 'abandoned' | 'converted'; limit?: number; unique?: boolean } = {}) {
    const where = f.view === 'abandoned' ? 'and abandonment is not null and order_id is null' : f.view === 'converted' ? "and stage in ('ordered','purchased')" : ''
    const base = `select *, count(*) over (partition by email)::int as forms from leads where true ${where}`
    const sql = f.unique
      ? `select * from (select distinct on (email) * from (${base}) b order by email, created_at desc) u order by created_at desc limit $1`
      : `${base} order by created_at desc limit $1`
    return (await q.query(sql, [f.limit ?? 200])).rows.map((r) => ({ lead: toLead(r), forms: Number(r.forms) }))
  },
  update: (q: Queryable, id: string, patch: Record<string, unknown>) => {
    const keys = Object.keys(patch)
    return q.query(`update leads set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() where id = $1`, [id, ...keys.map((k) => patch[k])])
  },
}

/**
 * An order was placed from this browser: the visitor's open leads point to it. Cash on delivery and bank transfer are commitments, so the lead is
 * "ordered" at once; a card order stays at "checkout started" until Stripe confirms the payment.
 */
export async function linkOrder(t: Queryable, visitorId: string, o: Order) {
  const committed = o.paymentMethod !== 'card' || o.paymentStatus === 'paid'
  const { rows } = await t.query<{ id: string }>(
    `update leads set order_id = $2,
       stage = case when $3 then (case when stage = 'purchased' then stage else 'ordered' end) else stage end,
       ordered_at = case when $3 then coalesce(ordered_at, now()) else ordered_at end,
       cart = case when product_id = '${CART_INTEREST}' then $4::jsonb else cart end,
       updated_at = now()
     where visitor_id = $1 and stage in ('lead', 'checkout_started') returning id`,
    [visitorId, o.id, committed, JSON.stringify(o.items.map((i) => ({ productId: i.productId, ...(i.variantId && { variantId: i.variantId }), quantity: i.quantity })))],
  )
  const first = rows.find(Boolean)
  if (first) await t.query('update orders set lead_id = $2 where id = $1 and lead_id is null', [o.id, first.id])
  for (const r of rows) await jobs.enqueue(t, { kind: 'ghl.lead', dedupeKey: `ghl.lead:${r.id}:order:${o.id}`, payload: { leadId: r.id } })
  return rows.length
}

/**
 * A card order was marked abandoned (unpaid after its payment window): it gets a checkout lead if it has none
 * (no visitor cookie, or the contact step was not captured), so its recovery runs through the same lead
 * sequence, consent rules and suppression as every other unfinished checkout. Called in the order's transaction.
 */
export async function ensureOrderLead(t: Queryable, o: Order) {
  const c = getConfig()
  if (!c.features.abandonedCheckout) return null
  const { rows } = await t.query<{ id: string }>('select id from leads where order_id = $1 limit 1', [o.id])
  if (rows.length) return rows[0].id
  const r = await captureLead(t, {
    visitorId: `order:${o.id}`,
    stage: 'checkout_started',
    productId: CART_INTEREST,
    // The person's email consent is already recorded by the checkout itself (marketing_consent_events).
    contact: { name: `${o.customer.firstName} ${o.customer.lastName}`.trim(), email: o.email, phone: o.phone ?? '' },
    marketingConsent: false,
    cart: o.items.map((i) => ({ productId: i.productId, ...(i.variantId && { variantId: i.variantId }), quantity: i.quantity })),
    attribution: o.attribution,
    page: '/checkout',
    locale: o.locale,
    site: o.site,
    // The international site's leads are recognised by their host (no AI call, emails from biohack-tech.net).
    landingHost: o.site === 'net' ? 'www.biohack-tech.net' : null,
  })
  await t.query('update leads set order_id = $2 where id = $1', [r.lead.id, o.id])
  await t.query('update orders set lead_id = coalesce(lead_id, $2) where id = $1', [o.id, r.lead.id])
  return r.lead.id
}

/** Payment confirmed for an order: its leads are purchases (called inside the order's transaction). */
export async function markLeadsPurchased(t: Queryable, orderId: string) {
  await t.query("update leads set stage = 'purchased', purchased_at = coalesce(purchased_at, now()), recovery_status = case when recovery_status in ('none', 'scheduled', 'sent', 'ineligible', 'disabled') then 'stopped' else recovery_status end, recovery_reason = coalesce(recovery_reason, 'converted'), updated_at = now() where order_id = $1 and stage <> 'purchased'", [orderId])
}

export type RecoveryCheck =
  | { send: true; abandonment: 'checkout_abandoned' }
  | { send: false; reason: string; abandonment?: 'checkout_abandoned'; status?: string; later?: Date }

/**
 * Should recovery step `step` (1 to 3) go out now for this lead? Pure: the caller loads everything. The order
 * matters: abandonment is recorded even when no email may go out; consent is checked last, at sending time.
 */
export function recoveryDecision(
  lead: Lead,
  ctx: {
    stage: string
    step: number
    now: Date
    features: { abandonedCheckout: boolean; recoveryEmail: boolean }
    firstMinutes: number
    /** The second email waits at least half this long after the first, even if the queue ran late. */
    secondHours?: number
    /** The third waits at least half the time between the second and the third after the second. */
    thirdHours?: number
    /** An order of this address placed after the lead (any method), or the lead's own order, paid or committed. */
    converted: boolean
    /** A checkout of the same person started after this lead (the product interest went on to the checkout). */
    superseded: boolean
    /** Another lead of the same person already got a recovery email recently: one sequence per person. */
    otherRecovery: boolean
    consentGranted: boolean | null
    /** The lead's own order, when it has one: an unpaid card order is recovered here once it is abandoned. */
    order?: { status: string; paymentMethod: string; paymentStatus: string; createdAt: Date } | null
    abandonAfterMinutes?: number
    canSend: boolean
    /** RECOVERY_TEST_RECIPIENTS is set and this address is not on it. */
    notTestRecipient?: boolean
    /** One of this person's orders waits for a person's risk check (server/risk.ts): nothing goes out meanwhile. */
    riskHold?: boolean
  },
): RecoveryCheck {
  if (!ctx.features.abandonedCheckout) return { send: false, reason: 'abandoned checkout off' }
  if (lead.stage === 'ordered' || lead.stage === 'purchased' || ctx.converted) return { send: false, reason: 'converted', status: 'stopped' }
  if (lead.stage !== ctx.stage) return { send: false, reason: `stage changed to ${lead.stage}` }
  // The former price form (acces, closed 20.10.2026): no more emails for it.
  if (lead.stage === 'lead') return { send: false, reason: 'acces closed', status: 'stopped' }
  // The lead's own order, not paid (a card payment left unfinished): cancelled → stop; still within its payment
  // window → wait until it is marked abandoned; abandoned → recovered like any unfinished checkout (the
  // application owns this email; no GoHighLevel workflow sends one).
  if (lead.orderId) {
    const o = ctx.order
    if (!o || o.status === 'cancelled' || o.paymentStatus === 'cancelled') return { send: false, reason: 'order cancelled', status: 'stopped' }
    if (o.status !== 'abandoned') return { send: false, reason: 'order awaiting payment', later: new Date(Math.max(ctx.now.getTime(), o.createdAt.getTime() + ((ctx.abandonAfterMinutes ?? 60) + 5) * 60_000)) }
  }
  if (ctx.superseded) return { send: false, reason: 'went on to the checkout' }
  // A flagged order of this person: the email waits (no code, no link) and goes out once a person clears it; a review
  // still open after a week ends the sequence.
  if (ctx.riskHold) {
    if (ctx.now.getTime() - lead.lastActivityAt.getTime() >= HOLD_MAX_MS) return { send: false, reason: 'risk review', status: 'stopped' }
    return { send: false, reason: 'risk review', later: new Date(ctx.now.getTime() + HOLD_RECHECK_MS) }
  }
  if (ctx.otherRecovery) return { send: false, reason: 'another recovery for this person', status: 'stopped' }
  // Activity since the step was planned (another visit, the checkout typed into): not abandoned yet.
  const quietFor = ctx.now.getTime() - lead.lastActivityAt.getTime()
  if (ctx.step === 1 && quietFor < ctx.firstMinutes * 60_000) return { send: false, reason: 'still active', later: new Date(lead.lastActivityAt.getTime() + ctx.firstMinutes * 60_000) }
  const abandonment = 'checkout_abandoned'
  if (lead.recoveryStatus === 'stopped') return { send: false, reason: lead.recoveryReason ?? 'stopped', abandonment }
  if (!ctx.features.recoveryEmail) return { send: false, reason: 'recovery email off', abandonment, status: 'disabled' }
  if (ctx.notTestRecipient) return { send: false, reason: 'recovery email in test mode', abandonment, status: 'disabled' }
  if (ctx.consentGranted === null) return { send: false, reason: 'no marketing consent', abandonment, status: 'ineligible' }
  if (!ctx.consentGranted) return { send: false, reason: 'consent withdrawn', abandonment, status: 'stopped' }
  // A later email waits for the one before it when that one was moved (new activity, an AI call under way): never
  // lost, never out of order, for a week at most.
  if (ctx.step >= 2 && lead.recoverySent < ctx.step - 1 && ctx.now.getTime() - lead.lastActivityAt.getTime() < 7 * 86_400_000)
    return { send: false, reason: `waiting for email ${lead.recoverySent + 1}`, abandonment, later: new Date(ctx.now.getTime() + 12 * 3_600_000) }
  if (lead.recoverySent !== ctx.step - 1) return { send: false, reason: `step ${ctx.step} after ${lead.recoverySent} sent`, abandonment }
  const spacing = ctx.step === 2 ? ctx.secondHours : ctx.step === 3 && ctx.thirdHours && ctx.secondHours ? ctx.thirdHours - ctx.secondHours : undefined
  if (ctx.step >= 2 && lead.lastRecoveryAt && spacing && spacing > 0) {
    const gap = (spacing * 3_600_000) / 2
    if (ctx.now.getTime() - lead.lastRecoveryAt.getTime() < gap) return { send: false, reason: 'too soon after the previous email', abandonment, later: new Date(lead.lastRecoveryAt.getTime() + gap) }
  }
  if (!ctx.canSend) return { send: false, reason: 'no own email transport', abandonment, status: 'ineligible' }
  return { send: true, abandonment }
}

/** One recovery sequence per person in this window, however many products they looked at. */
export const RECOVERY_PERSON_DAYS = 7

/** The facts recoveryDecision needs, read now. */
export async function recoveryFacts(q: Queryable, lead: Lead) {
  const { rows: conv } = await q.query(
    `select 1 from orders where (id = $3 and (payment_status in ('paid','partially_refunded','refunded') or payment_method <> 'card'))
       or (email = $1 and created_at >= $2 and (payment_status in ('paid','partially_refunded','refunded') or payment_method <> 'card')) limit 1`,
    [lead.email, lead.createdAt, lead.orderId],
  )
  const { rows: sup } =
    lead.productId === CART_INTEREST
      ? { rows: [] }
      : await q.query(`select 1 from leads where email = $1 and product_id = '${CART_INTEREST}' and id <> $2 and coalesce(checkout_started_at, created_at) >= $3 limit 1`, [lead.email, lead.id, lead.createdAt])
  // One sequence per person: another lead already got an email recently, or an older lead of the same person
  // still has its own recovery to come (it owns the sequence, even if its step was moved by new activity).
  const { rows: other } = await q.query(
    `select 1 from leads l where l.email = $1 and l.id <> $2 and (
       l.last_recovery_at >= $3
       or (l.created_at < $4 and l.recovery_status not in ('stopped') and exists (
         select 1 from jobs j where j.kind = 'lead.recovery' and j.payload->>'leadId' = l.id::text and j.status in ('pending', 'retry', 'running') and (j.payload->>'step')::int = 1)))
     limit 1`,
    [lead.email, lead.id, new Date(Date.now() - RECOVERY_PERSON_DAYS * 86_400_000), lead.createdAt],
  )
  const consent = await marketing.state(q, lead.email)
  const { rows: own } = lead.orderId
    ? await q.query<{ status: string; payment_method: string; payment_status: string; created_at: string }>('select status, payment_method, payment_status, created_at from orders where id = $1', [lead.orderId])
    : { rows: [] }
  const order = own[0] ? { status: own[0].status, paymentMethod: own[0].payment_method, paymentStatus: own[0].payment_status, createdAt: new Date(own[0].created_at) } : null
  const held = await riskHold(q, { email: lead.email, phone: lead.phone, orderId: lead.orderId })
  return { converted: conv.length > 0, superseded: sup.length > 0, otherRecovery: other.length > 0, consentGranted: consent ? consent.granted : null, order, riskHold: held }
}

/** What a lead recovery link puts back in the cart (only what is still sold), or null. */
export async function leadRecoveryCart(q: Queryable, token: string) {
  const lead = await leads.byRecoveryToken(q, token)
  if (!lead || lead.stage === 'ordered' || lead.stage === 'purchased') return null
  const cart = sanitizeCart(lead.cart ?? (lead.productId && lead.productId !== CART_INTEREST ? [{ productId: lead.productId, variantId: lead.variantId ?? undefined, quantity: 1 }] : []))
  return cart.length ? { lead, cart } : null
}

/** The interest one lead shows, in words: "NEUROS Calm", or the products of a checkout. */
export function interestOf(lead: Pick<Lead, 'productId' | 'cart'>): string[] {
  const ids = lead.productId && lead.productId !== CART_INTEREST ? [lead.productId] : (lead.cart ?? []).map((l) => l.productId)
  return [...new Set(ids)].map((id) => getProduct(id)?.name).filter((n): n is string => !!n)
}

/** One page load (and, for the first page of a browser session, one session) in the anonymous daily counts. */
export async function countVisit(q: Queryable, page: string, v: { session?: boolean; source?: string; campaign?: string; site?: string } = {}) {
  await q.query(
    `insert into visit_stats (day, site, funnel, page, source, campaign, views, sessions) values ((now() at time zone 'Europe/Bucharest')::date, $5, 'visible_price', $1, $2, $3, 1, $4)
     on conflict (day, site, funnel, page, source, campaign) do update set views = visit_stats.views + 1, sessions = visit_stats.sessions + excluded.sessions`,
    [page, v.source ?? '', v.campaign ?? '', v.session ? 1 : 0, v.site ?? 'main'],
  )
}

/** How long a lead that never became an order is kept (privacy policy: 12 months after the last activity). */
export const LEAD_RETENTION_DAYS = 365

/** Deletes leads without an order, inactive for longer than the retention period. Run by the cron. */
export async function purgeStaleLeads(q: Queryable, now = new Date()) {
  const { rows } = await q.query(`delete from leads where order_id is null and last_activity_at < $1 returning id`, [new Date(now.getTime() - LEAD_RETENTION_DAYS * 86_400_000)])
  return rows.length
}
