/**
 * GoHighLevel (API v2, Version 2021-07-28, Private Integration token).
 * GHL is the CRM and the email sender; our database stays the source of truth.
 * Every call here is an upsert or keyed by ids we store, so retries never duplicate.
 */
import 'server-only'
import { attributionSummary } from '@/lib/attribution'
import { isConfirmedPurchase } from '@/lib/segments'
import type { GhlConfig } from '@/server/config'
import { log } from '@/server/log'
import { customerName, PAYMENT_METHOD_LABEL, type Order } from '@/server/orders/model'

export class GhlError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
  get retryable() {
    return this.status === 0 || this.status === 429 || this.status >= 500
  }
}

async function call<T>(c: GhlConfig, method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${c.apiBase}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${c.token}`,
        Version: '2021-07-28',
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
  } catch (e) {
    throw new GhlError(`network: ${e instanceof Error ? e.message : e}`, 0)
  }
  const json = (await res.json().catch(() => ({}))) as { message?: string | string[] }
  if (!res.ok) throw new GhlError(`${res.status} ${[json.message].flat().join('; ')}`.slice(0, 300), res.status)
  return json as T
}

/**
 * One contact per address: the known id (stored on the order or lead) or the oldest contact with this email is
 * updated (PUT, without `source`, so an existing NEUROS contact keeps where it came from); only an address GHL
 * does not have is created. A stale known id (contact deleted in GHL) falls back to the lookup.
 */
/** GHL refuses a phone number another contact already has (the location forbids duplicates). */
const isDuplicatePhone = (e: unknown) => e instanceof GhlError && e.status === 400 && /duplicat/i.test(e.message)

/**
 * The contact is the email's; a phone that belongs to another contact (two people sharing a number) is left out
 * rather than failing the sync or merging two people.
 */
async function saveContact(c: GhlConfig, body: { locationId: string; email: string; source?: string; [k: string]: unknown }, knownId?: string | null): Promise<string> {
  try {
    return await saveContactOnce(c, body, knownId)
  } catch (e) {
    if (!isDuplicatePhone(e) || !('phone' in body)) throw e
    const { phone: _p, ...withoutPhone } = body
    void _p
    return saveContactOnce(c, withoutPhone, knownId)
  }
}

async function saveContactOnce(c: GhlConfig, body: { locationId: string; email: string; source?: string; [k: string]: unknown }, knownId?: string | null): Promise<string> {
  const { locationId: _l, source: _s, ...update } = body
  void _l
  void _s
  for (const id of [knownId, null]) {
    const target = id ?? (await ghl.findContactId(c, body.email))
    if (!target) break
    try {
      await call(c, 'PUT', `/contacts/${encodeURIComponent(target)}`, update)
      return target
    } catch (e) {
      if (!(e instanceof GhlError) || !id || isDuplicatePhone(e) || (e.status !== 404 && e.status !== 400)) throw e
    }
  }
  const r = await call<{ contact: { id: string } }>(c, 'POST', '/contacts/upsert', body)
  return r.contact.id
}

/** Pipeline stage names, exactly as they must be created in GHL (see docs/PRODUCTION-LAUNCH.md). */
export const STAGES = {
  awaitingTransfer: 'Așteaptă transferul',
  abandoned: 'Plată nefinalizată',
  paid: 'Plătită, de pregătit',
  processing: 'În pregătire',
  shipped: 'Expediată',
  delivered: 'Livrată',
  cancelled: 'Anulată',
  refunded: 'Rambursată',
  /** Cash on delivery accepted, to prepare; nothing collected yet. Create it in the pipeline (see ghl-check). */
  codToPrepare: 'Ramburs, de pregătit',
} as const
export type StageKey = keyof typeof STAGES

/**
 * Where an order sits in the pipeline, from its two state axes. A cash-on-delivery order moves through the
 * same fulfilment stages but stays "open" until the courier's settlement is recorded: only money is "won".
 */
export function stageFor(o: Pick<Order, 'status' | 'paymentStatus'>): { stage: StageKey; status: 'open' | 'won' | 'lost' | 'abandoned' } {
  const won = o.paymentStatus === 'awaiting_collection' ? 'open' : 'won'
  if (o.paymentStatus === 'refunded') return { stage: 'refunded', status: 'lost' }
  if (o.status === 'cancelled') return { stage: 'cancelled', status: 'lost' }
  if (o.status === 'delivered') return { stage: 'delivered', status: won }
  if (o.status === 'shipped') return { stage: 'shipped', status: won }
  if (o.status === 'processing') return { stage: 'processing', status: won }
  if (o.status === 'confirmed') return o.paymentStatus === 'awaiting_collection' ? { stage: 'codToPrepare', status: 'open' } : { stage: 'paid', status: 'won' }
  if (o.status === 'abandoned') return { stage: 'abandoned', status: 'abandoned' }
  return { stage: o.paymentStatus === 'awaiting_transfer' ? 'awaitingTransfer' : 'abandoned', status: 'open' }
}

/** Contact custom field keys (create them in GHL with these exact keys). */
export const CONTACT_FIELDS = {
  customerType: 'contact.bt_customer_type',
  lastOrderNumber: 'contact.bt_last_order_number',
  lastOrderDate: 'contact.bt_last_order_date',
  lastOrderValue: 'contact.bt_last_order_value',
  lastOrderProducts: 'contact.bt_last_order_products',
  lastPaymentMethod: 'contact.bt_last_payment_method',
  lastPaymentStatus: 'contact.bt_last_payment_status',
  lastOrderStatus: 'contact.bt_last_order_status',
  lifetimeOrders: 'contact.bt_lifetime_orders',
  lifetimeValue: 'contact.bt_lifetime_value',
  marketingConsent: 'contact.bt_marketing_consent',
  /** Link to the latest order's page (opaque token); used by the transfer reminder (W3). */
  lastOrderUrl: 'contact.bt_last_order_url',
  /** Checkout recovery link, set only while a recovery email is allowed (W2); empty otherwise. */
  recoveryUrl: 'contact.bt_recovery_url',
  /** The site's own unsubscribe link for marketing emails (never GHL's DND, which would also block order emails). */
  unsubscribeUrl: 'contact.bt_unsubscribe_url',
  /** Where the latest order came from: "site", or "landing calm · facebook / paid / campanie". */
  lastOrderSource: 'contact.bt_last_order_source',
} as const

/**
 * Tags are prefixed `bt-` because the GHL location (NEUROS) is shared with other funnels (courses, events):
 * generic names like `client` could collide with their automations. Create them in GHL with these exact names.
 */
export const TAGS = {
  client: 'bt-client',
  company: 'bt-client-firma',
  /** Present only while the site allows a checkout recovery email (consent, still unpaid, link valid). W2 starts on it. */
  recovery: 'bt-recuperare-eligibil',
  /** A withdrawal was declared for a paid order (the product may still be on its way back). */
  returnRequested: 'bt-retur-solicitat',
  /** The returned product arrived back; the refund follows (W7 on Rambursată). */
  returnReceived: 'bt-retur-primit',
  /** Wrote to us through the site's contact form. Starts no order workflow. */
  enquiry: 'bt-mesaj-contact',
  /**
   * The person placed an order (cash on delivery or transfer as soon as placed, card once paid; not a cancelled
   * one). Unlike bt-cumparat-* (only once the money is in), it stops campaign reminders right after the order.
   */
  orderPlaced: 'bt-comanda-plasata',
  /** Present only while an AI call consent is in force for one of the address's numbers (Supabase stays the proof). */
  callConsent: 'bt-acord-apel-ai',
} as const
/** One tag per product bought. Every catalog product must have one (tested). */
/**
 * Lead tags. None is used by a BiohackTech or NEUROS workflow: they only describe interest and source.
 * The application, not GoHighLevel, sends any recovery email.
 */
export const LEAD_TAGS = {
  lead: 'bt-lead',
  gated: 'bt-lead-acces',
  visible: 'bt-lead-site',
  checkout: 'bt-lead-checkout',
  converted: 'bt-lead-convertit',
}
/**
 * AI call results on the contact (tags only: no opportunity, no workflow trigger the app relies on). One tag
 * per outcome, e.g. bt-apel-ai-interested; follow-up and refusal have their own, so the team can filter.
 */
export const CALL_TAGS = { called: 'bt-apel-ai', followUp: 'bt-apel-ai-urmarire', optedOut: 'bt-apel-ai-refuz', discount: 'bt-apel-ai-cod-10', offerEmail: 'bt-apel-ai-email-cod' }
export const callOutcomeTag = (outcome: string) => `bt-apel-ai-${outcome.replace(/_/g, '-')}`

/** Campaign tags for a lead: bt-sursa-facebook, bt-campanie-toamna (lowercase slugs, short; anything else is dropped). */
export function attributionTags(a: { utm?: Record<string, string> } | null | undefined): string[] {
  const slug = (v: string | undefined) => {
    const s = (v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return s.length >= 2 && s.length <= 40 ? s : null
  }
  const source = slug(a?.utm?.utm_source)
  const campaign = slug(a?.utm?.utm_campaign)
  return [...(source ? [`bt-sursa-${source}`] : []), ...(campaign ? [`bt-campanie-${campaign}`] : [])]
}

export const INTEREST_TAG: Record<string, string> = {
  'balance-wave': 'bt-interes-calm',
  'brainlink-pro': 'bt-interes-focus',
  'ochelari-biohack': 'bt-interes-amber',
}

export const PRODUCT_TAG: Record<string, string> = {
  'balance-wave': 'bt-cumparat-calm',
  'brainlink-pro': 'bt-cumparat-focus',
  'ochelari-biohack': 'bt-cumparat-amber',
  // Discontinued 13.10.2026; kept so orders placed before still get their tag on a CRM resync.
  'brain-flow': 'bt-cumparat-brain-flow',
}

const PAYMENT_STATUS_RO: Record<Order['paymentStatus'], string> = {
  pending: 'în curs',
  awaiting_transfer: 'așteaptă transferul',
  awaiting_collection: 'ramburs, de încasat la livrare',
  failed: 'eșuată',
  cancelled: 'anulată',
  paid: 'plătită',
  partially_refunded: 'rambursată parțial',
  refunded: 'rambursată',
}
const ORDER_STATUS_RO: Record<Order['status'], string> = {
  pending: 'nouă',
  abandoned: 'plată nefinalizată',
  confirmed: 'de pregătit',
  processing: 'în pregătire',
  shipped: 'expediată',
  delivered: 'livrată',
  cancelled: 'anulată',
}
export const paymentStatusRo = (s: Order['paymentStatus']) => PAYMENT_STATUS_RO[s]
export const orderStatusRo = (s: Order['status']) => ORDER_STATUS_RO[s]

/**
 * A custom field as the GHL API accepts it: the short key (without "contact.") and `field_value`. The
 * "contact.bt_…" key with `fieldValue` was silently ignored by the live API (verified 14.10.2026).
 */
const customField = (key: string, value: string) => ({ key: key.replace(/^contact\./, ''), field_value: value })

/** What the site decided about marketing for this address, as GHL fields. The database stays the proof. */
export type MarketingFields = { consent: boolean; recoveryUrl: string; unsubscribeUrl: string }

const marketingFields = (m: MarketingFields) =>
  [
    [CONTACT_FIELDS.marketingConsent, m.consent ? 'Da' : 'Nu'],
    [CONTACT_FIELDS.recoveryUrl, m.recoveryUrl],
    [CONTACT_FIELDS.unsubscribeUrl, m.unsubscribeUrl],
  ].map(([key, value]) => customField(key, value))

/** The contact as GHL receives it: identity, address, the latest order at a glance, and the marketing decision. */
export function contactPayload(c: GhlConfig, o: Order, lifetime: { orders: number; valueMinor: number }, m: MarketingFields, siteUrl: string) {
  const products = o.items.map((i) => `${i.quantity} x ${i.productName}${i.variantName ? ` (${i.variantName})` : ''}`).join(', ')
  return {
    locationId: c.locationId,
    firstName: o.customer.firstName,
    lastName: o.customer.lastName,
    name: customerName(o.customer),
    email: o.email,
    phone: o.phone,
    ...(o.customer.buyerType === 'pj' && o.customer.company && { companyName: o.customer.company }),
    address1: o.billingAddress.address,
    city: o.billingAddress.city,
    state: o.billingAddress.county,
    postalCode: o.billingAddress.postalCode,
    country: o.billingAddress.country || 'RO',
    source: o.site === 'net' ? 'biohack-tech.net' : 'biohack-tech.ro',
    customFields: [
      [CONTACT_FIELDS.customerType, o.customer.buyerType === 'pj' ? 'Persoană juridică' : 'Persoană fizică'],
      [CONTACT_FIELDS.lastOrderNumber, o.orderNumber],
      [CONTACT_FIELDS.lastOrderDate, o.createdAt.toISOString().slice(0, 10)],
      // In lei (an order in euro or dollars at its own rate), like every value in the CRM.
      [CONTACT_FIELDS.lastOrderValue, ((o.totalMinor * o.fxRate) / 100).toFixed(2)],
      [CONTACT_FIELDS.lastOrderProducts, products],
      [CONTACT_FIELDS.lastPaymentMethod, PAYMENT_METHOD_LABEL[o.paymentMethod]],
      [CONTACT_FIELDS.lastPaymentStatus, PAYMENT_STATUS_RO[o.paymentStatus]],
      [CONTACT_FIELDS.lastOrderStatus, ORDER_STATUS_RO[o.status]],
      [CONTACT_FIELDS.lifetimeOrders, String(lifetime.orders)],
      [CONTACT_FIELDS.lifetimeValue, (lifetime.valueMinor / 100).toFixed(2)],
      [CONTACT_FIELDS.lastOrderUrl, `${siteUrl}/comanda/${o.publicToken}`],
      [CONTACT_FIELDS.lastOrderSource, attributionSummary(o.attribution)],
    ]
      .map(([key, value]) => customField(key, value))
      .concat(marketingFields(m)),
  }
}

/** bt-comanda-plasata for an order that stands (see TAGS.orderPlaced); never for an upsell or a cancelled order. */
export function placedTags(o: Order): string[] {
  if (o.kind !== 'checkout' || o.status === 'cancelled') return []
  const committed = o.paymentMethod !== 'card' || o.paymentStatus === 'paid' || o.paymentStatus === 'partially_refunded'
  return committed ? [TAGS.orderPlaced] : []
}

/** Tags are added (never replaced): client + one per product bought, only once paid. */
export function tagsFor(o: Order): string[] {
  if (!isConfirmedPurchase(o)) return []
  const tags = new Set<string>([TAGS.client])
  for (const i of o.items) if (PRODUCT_TAG[i.productId]) tags.add(PRODUCT_TAG[i.productId])
  if (o.customer.buyerType === 'pj') tags.add(TAGS.company)
  if (o.returnStatus) tags.add(TAGS.returnRequested)
  if (o.returnStatus === 'received') tags.add(TAGS.returnReceived)
  return [...tags]
}

const stageCache = new Map<string, { at: number; ids: Map<string, string> }>()

/** Test helper: forget the cached pipeline stages (like resetConfig). */
export const resetStageCache = () => stageCache.clear()

async function stageIds(c: GhlConfig): Promise<Map<string, string>> {
  const hit = stageCache.get(c.pipelineId)
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.ids
  const r = await call<{ pipelines: { id: string; stages: { id: string; name: string }[] }[] }>(c, 'GET', `/opportunities/pipelines?locationId=${encodeURIComponent(c.locationId)}`)
  const p = r.pipelines.find((x) => x.id === c.pipelineId)
  if (!p) throw new GhlError(`pipeline ${c.pipelineId} nu există în locația configurată`, 404)
  const ids = new Map(p.stages.map((s) => [s.name.trim().toLowerCase(), s.id]))
  stageCache.set(c.pipelineId, { at: Date.now(), ids })
  return ids
}

export const ghl = {
  /**
   * The contact for an address, oldest first. The NEUROS location allows duplicate contacts, so GHL's own
   * upsert does not match by email (verified on the live API, 14.10.2026): every save looks the address up first.
   */
  async findContactId(c: GhlConfig, email: string): Promise<string | null> {
    const r = await call<{ contacts?: { id: string }[] }>(c, 'POST', '/contacts/search', {
      locationId: c.locationId,
      pageLimit: 1,
      filters: [{ field: 'email', operator: 'eq', value: email.trim().toLowerCase() }],
      sort: [{ field: 'dateAdded', direction: 'asc' }],
    })
    return r.contacts?.[0]?.id ?? null
  },

  async upsertContact(c: GhlConfig, o: Order, lifetime: { orders: number; valueMinor: number }, m: MarketingFields, siteUrl: string, knownId?: string | null) {
    return saveContact(c, contactPayload(c, o, lifetime, m, siteUrl), knownId)
  },

  /** Only the marketing fields of an existing contact (after an unsubscribe or a consent), matched by email. */
  async updateMarketing(c: GhlConfig, email: string, m: MarketingFields, knownId?: string | null) {
    return saveContact(c, { locationId: c.locationId, email, customFields: marketingFields(m) }, knownId)
  },

  /**
   * A contact-form sender: identity only (no order fields, no marketing fields, no pipeline), so no
   * ecommerce workflow can start from it. Matched by email like every other upsert.
   */
  async upsertEnquiryContact(c: GhlConfig, e: { name: string; email: string; phone: string }, knownId?: string | null) {
    const [firstName, ...rest] = e.name.split(' ')
    return saveContact(
      c,
      {
        locationId: c.locationId,
        email: e.email,
        firstName,
        ...(rest.length && { lastName: rest.join(' ') }),
        ...(e.phone && { phone: e.phone }),
        source: 'biohack-tech.ro contact',
      },
      knownId,
    )
  },

  /**
   * A lead (price form or checkout contact step): identity only, like a contact-form sender. No order fields,
   * no pipeline or opportunity, so no ecommerce workflow (W1-W7) can start from it. The contact's own `source`
   * is never set here, so an existing NEUROS contact keeps its own; the funnel and campaign go in bt- tags.
   */
  async upsertLeadContact(c: GhlConfig, l: { name: string | null; email: string; phone: string | null; funnel: string }, knownId?: string | null) {
    const [firstName, ...rest] = (l.name ?? '').split(' ')
    return saveContact(
      c,
      {
        locationId: c.locationId,
        email: l.email,
        ...(firstName && { firstName }),
        ...(rest.length && { lastName: rest.join(' ') }),
        ...(l.phone && { phone: l.phone }),
      },
      knownId,
    )
  },

  async addTags(c: GhlConfig, contactId: string, tags: string[]) {
    if (tags.length) await call(c, 'POST', `/contacts/${contactId}/tags`, { tags })
  },

  async removeTags(c: GhlConfig, contactId: string, tags: string[]) {
    if (tags.length) await call(c, 'DELETE', `/contacts/${contactId}/tags`, { tags })
  },

  /**
   * Creates the order's opportunity once (found again by name if our id was lost), then moves it. An order
   * added after payment (post-purchase offer) names its parent, so the team packs both in one parcel.
   */
  async syncOpportunity(c: GhlConfig, o: Order, contactId: string, knownId: string | null, parentOrderNumber?: string | null) {
    const { stage, status } = stageFor(o)
    const ids = await stageIds(c)
    let stageId = ids.get(STAGES[stage].toLowerCase())
    // Until "Ramburs, de pregătit" exists in the pipeline, a cash-on-delivery order waits in "În pregătire",
    // never in a "paid" stage, so no payment workflow starts. The contact fields still say "ramburs, de încasat".
    if (!stageId && stage === 'codToPrepare') {
      stageId = ids.get(STAGES.processing.toLowerCase())
      log.warn('ghl.stage_missing', { stage: STAGES.codToPrepare, fallback: STAGES.processing, orderNumber: o.orderNumber })
    }
    if (!stageId) throw new GhlError(`etapa „${STAGES[stage]}” lipsește din pipeline`, 404)
    const body = {
      name: `${o.orderNumber} · ${customerName(o.customer)}${parentOrderNumber ? ` · adăugată la ${parentOrderNumber}` : ''}`,
      pipelineStageId: stageId,
      status,
      monetaryValue: Number((((o.totalMinor - o.refundedMinor) * o.fxRate) / 100).toFixed(2)),
    }
    let id = knownId
    if (!id) {
      const found = await call<{ opportunities: { id: string; name: string }[] }>(
        c,
        'GET',
        `/opportunities/search?location_id=${encodeURIComponent(c.locationId)}&pipeline_id=${encodeURIComponent(c.pipelineId)}&q=${encodeURIComponent(o.orderNumber)}`,
      )
      id = found.opportunities.find((x) => x.name.startsWith(o.orderNumber))?.id ?? null
    }
    if (id) {
      await call(c, 'PUT', `/opportunities/${id}`, body)
      return id
    }
    const r = await call<{ opportunity: { id: string } }>(c, 'POST', '/opportunities/', { ...body, pipelineId: c.pipelineId, locationId: c.locationId, contactId })
    return r.opportunity.id
  },

  /** Sends an email through the contact's conversation (GHL's email sending and domain). */
  async sendEmail(c: GhlConfig, contactId: string, e: { subject: string; html: string; text: string }) {
    const r = await call<{ messageId?: string; emailMessageId?: string }>(c, 'POST', '/conversations/messages', {
      type: 'Email',
      contactId,
      subject: e.subject,
      html: e.html,
      message: e.text,
      ...(c.emailFrom && { emailFrom: c.emailFrom }),
    })
    return r.emailMessageId ?? r.messageId ?? ''
  },
}

