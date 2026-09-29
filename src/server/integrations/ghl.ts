/**
 * GoHighLevel (API v2, Version 2021-07-28, Private Integration token).
 * GHL is the CRM and the email sender; our database stays the source of truth.
 * Every call here is an upsert or keyed by ids we store, so retries never duplicate.
 */
import 'server-only'
import type { GhlConfig } from '@/server/config'
import { customerName, type Order } from '@/server/orders/model'

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
} as const
export type StageKey = keyof typeof STAGES

/** Where an order sits in the pipeline, from its two state axes. */
export function stageFor(o: Pick<Order, 'status' | 'paymentStatus'>): { stage: StageKey; status: 'open' | 'won' | 'lost' | 'abandoned' } {
  if (o.paymentStatus === 'refunded') return { stage: 'refunded', status: 'lost' }
  if (o.status === 'cancelled') return { stage: 'cancelled', status: 'lost' }
  if (o.status === 'delivered') return { stage: 'delivered', status: 'won' }
  if (o.status === 'shipped') return { stage: 'shipped', status: 'won' }
  if (o.status === 'processing') return { stage: 'processing', status: 'won' }
  if (o.status === 'confirmed') return { stage: 'paid', status: 'won' }
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
} as const
const PRODUCT_TAG: Record<string, string> = { 'balance-wave': 'bt-cumparat-calm', 'brainlink-pro': 'bt-cumparat-focus', 'ochelari-biohack': 'bt-cumparat-amber' }

const PAYMENT_STATUS_RO: Record<Order['paymentStatus'], string> = {
  pending: 'în curs',
  awaiting_transfer: 'așteaptă transferul',
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

/** What the site decided about marketing for this address, as GHL fields. The database stays the proof. */
export type MarketingFields = { consent: boolean; recoveryUrl: string; unsubscribeUrl: string }

const marketingFields = (m: MarketingFields) =>
  [
    [CONTACT_FIELDS.marketingConsent, m.consent ? 'Da' : 'Nu'],
    [CONTACT_FIELDS.recoveryUrl, m.recoveryUrl],
    [CONTACT_FIELDS.unsubscribeUrl, m.unsubscribeUrl],
  ].map(([key, value]) => ({ key, fieldValue: value }))

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
    country: 'RO',
    source: 'biohack-tech.ro',
    customFields: [
      [CONTACT_FIELDS.customerType, o.customer.buyerType === 'pj' ? 'Persoană juridică' : 'Persoană fizică'],
      [CONTACT_FIELDS.lastOrderNumber, o.orderNumber],
      [CONTACT_FIELDS.lastOrderDate, o.createdAt.toISOString().slice(0, 10)],
      [CONTACT_FIELDS.lastOrderValue, (o.totalMinor / 100).toFixed(2)],
      [CONTACT_FIELDS.lastOrderProducts, products],
      [CONTACT_FIELDS.lastPaymentMethod, o.paymentMethod === 'card' ? 'Card' : 'Transfer bancar'],
      [CONTACT_FIELDS.lastPaymentStatus, PAYMENT_STATUS_RO[o.paymentStatus]],
      [CONTACT_FIELDS.lastOrderStatus, ORDER_STATUS_RO[o.status]],
      [CONTACT_FIELDS.lifetimeOrders, String(lifetime.orders)],
      [CONTACT_FIELDS.lifetimeValue, (lifetime.valueMinor / 100).toFixed(2)],
      [CONTACT_FIELDS.lastOrderUrl, `${siteUrl}/comanda/${o.publicToken}`],
    ]
      .map(([key, value]) => ({ key, fieldValue: value }))
      .concat(marketingFields(m)),
  }
}

/** Tags are added (never replaced): client + one per product bought, only once paid. */
export function tagsFor(o: Order): string[] {
  const paid = o.paymentStatus === 'paid' || o.paymentStatus === 'partially_refunded' || o.status === 'shipped' || o.status === 'delivered'
  if (!paid) return []
  const tags = new Set<string>([TAGS.client])
  for (const i of o.items) if (PRODUCT_TAG[i.productId]) tags.add(PRODUCT_TAG[i.productId])
  if (o.customer.buyerType === 'pj') tags.add(TAGS.company)
  return [...tags]
}

const stageCache = new Map<string, { at: number; ids: Map<string, string> }>()

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
  async upsertContact(c: GhlConfig, o: Order, lifetime: { orders: number; valueMinor: number }, m: MarketingFields, siteUrl: string) {
    const r = await call<{ contact: { id: string } }>(c, 'POST', '/contacts/upsert', contactPayload(c, o, lifetime, m, siteUrl))
    return r.contact.id
  },

  /** Only the marketing fields of an existing contact (after an unsubscribe), matched by email. */
  async updateMarketing(c: GhlConfig, email: string, m: MarketingFields) {
    const r = await call<{ contact: { id: string } }>(c, 'POST', '/contacts/upsert', { locationId: c.locationId, email, customFields: marketingFields(m) })
    return r.contact.id
  },

  async addTags(c: GhlConfig, contactId: string, tags: string[]) {
    if (tags.length) await call(c, 'POST', `/contacts/${contactId}/tags`, { tags })
  },

  async removeTags(c: GhlConfig, contactId: string, tags: string[]) {
    if (tags.length) await call(c, 'DELETE', `/contacts/${contactId}/tags`, { tags })
  },

  /** Creates the order's opportunity once (found again by name if our id was lost), then moves it. */
  async syncOpportunity(c: GhlConfig, o: Order, contactId: string, knownId: string | null) {
    const { stage, status } = stageFor(o)
    const stageId = (await stageIds(c)).get(STAGES[stage].toLowerCase())
    if (!stageId) throw new GhlError(`etapa „${STAGES[stage]}” lipsește din pipeline`, 404)
    const body = {
      name: `${o.orderNumber} · ${customerName(o.customer)}`,
      pipelineStageId: stageId,
      status,
      monetaryValue: Number(((o.totalMinor - o.refundedMinor) / 100).toFixed(2)),
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

