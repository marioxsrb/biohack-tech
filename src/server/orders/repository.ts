/** SQL for orders. Rows in, typed Orders out. No business rules here. */
import 'server-only'
import type { Queryable, Row } from '@/server/db'
import type { Address, Customer, Order, OrderItem } from './model'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const date = (v: unknown) => (v ? new Date(v as string) : null)

function toOrder(r: Row, items: OrderItem[]): Order {
  return {
    id: r.id as string,
    orderNumber: r.order_number as string,
    publicToken: r.public_token as string,
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
    status: r.status as Order['status'],
    paymentStatus: r.payment_status as Order['paymentStatus'],
    paymentMethod: r.payment_method as Order['paymentMethod'],
    invoiceStatus: r.invoice_status as Order['invoiceStatus'],
    currency: ((r.currency as string) || 'RON') as Order['currency'],
    fxRate: r.fx_rate == null ? 1 : Number(r.fx_rate),
    locale: r.locale === 'en' ? 'en' : 'ro',
    site: r.site === 'net' ? 'net' : 'ro',
    subtotalMinor: Number(r.subtotal_minor),
    discountMinor: Number(r.discount_minor ?? 0),
    promotions: (r.promotions as Order['promotions']) ?? [],
    promoCode: (r.promo_code as string) ?? null,
    shippingMinor: Number(r.shipping_minor),
    totalMinor: Number(r.total_minor),
    refundedMinor: Number(r.refunded_minor),
    email: r.email as string,
    phone: r.phone as string,
    customer: r.customer as Customer,
    billingAddress: r.billing_address as Address,
    shippingAddress: r.shipping_address as Address,
    notes: (r.notes as string) ?? '',
    marketingConsent: !!r.marketing_consent,
    stripePaymentIntentId: (r.stripe_payment_intent_id as string) ?? null,
    codAmountMinor: r.cod_amount_minor == null ? null : Number(r.cod_amount_minor),
    codReference: (r.cod_reference as string) ?? null,
    paidAt: date(r.paid_at),
    cancelledAt: date(r.cancelled_at),
    cancelReason: (r.cancel_reason as string) ?? null,
    refundedAt: date(r.refunded_at),
    fgoInvoiceSeries: (r.fgo_invoice_series as string) ?? null,
    fgoInvoiceNumber: (r.fgo_invoice_number as string) ?? null,
    fgoInvoiceLink: (r.fgo_invoice_link as string) ?? null,
    fgoStornoNumber: (r.fgo_storno_number as string) ?? null,
    ghlContactId: (r.ghl_contact_id as string) ?? null,
    ghlOpportunityId: (r.ghl_opportunity_id as string) ?? null,
    courier: (r.courier as string) ?? null,
    trackingNumber: (r.tracking_number as string) ?? null,
    trackingUrl: (r.tracking_url as string) ?? null,
    shippedAt: date(r.shipped_at),
    deliveredAt: date(r.delivered_at),
    recoveryStatus: (r.recovery_status as Order['recoveryStatus']) ?? null,
    recoveryReason: (r.recovery_reason as string) ?? null,
    recoveryToken: (r.recovery_token as string) ?? null,
    recoveryExpiresAt: date(r.recovery_expires_at),
    attribution: (r.attribution as Order['attribution']) ?? null,
    returnStatus: (r.return_status as Order['returnStatus']) ?? null,
    returnRequestedAt: date(r.return_requested_at),
    returnReceivedAt: date(r.return_received_at),
    kind: ((r.kind as Order['kind']) ?? 'checkout'),
    parentOrderId: (r.parent_order_id as string) ?? null,
    stripeCustomerId: (r.stripe_customer_id as string) ?? null,
    stripePaymentMethodId: (r.stripe_payment_method_id as string) ?? null,
    upsellStatus: (r.upsell_status as Order['upsellStatus']) ?? null,
    upsellExpiresAt: date(r.upsell_expires_at),
    items,
  }
}

const toItem = (r: Row): OrderItem => ({
  position: Number(r.position),
  productId: r.product_id as string,
  variantId: (r.variant_id as string) ?? null,
  productName: r.product_name as string,
  variantName: (r.variant_name as string) ?? null,
  sku: r.sku as string,
  quantity: Number(r.quantity),
  unitPriceMinor: Number(r.unit_price_minor),
  lineTotalMinor: Number(r.line_total_minor),
  discountMinor: Number(r.discount_minor ?? 0),
  promotionId: (r.promotion_id as string) ?? null,
  codeDiscountMinor: Number(r.code_discount_minor ?? 0),
})

async function withItems(q: Queryable, rows: Row[]): Promise<Order[]> {
  if (!rows.length) return []
  const ids = rows.map((r) => r.id)
  const items = (await q.query('select * from order_items where order_id = any($1::uuid[]) order by position', [ids])).rows
  return rows.map((r) => toOrder(r, items.filter((i) => i.order_id === r.id).map(toItem)))
}

async function one(q: Queryable, sql: string, params: unknown[]): Promise<Order | null> {
  const { rows } = await q.query(sql, params)
  return (await withItems(q, rows))[0] ?? null
}

/**
 * The /admin work queues: what each person has to do next, straight from the order's own state.
 * "Atenție" gathers everything a person must settle: money to refund, invoices without a credit note,
 * failed invoices, returns waiting and synchronisations that stopped.
 */
export const QUEUES = {
  atentie: {
    label: 'Necesită atenție',
    where: `(status = 'cancelled' and payment_status in ('paid', 'partially_refunded'))
      or (fgo_invoice_number is not null and fgo_storno_number is null and (status = 'cancelled' or payment_status = 'refunded'))
      or invoice_status = 'failed' or return_status = 'requested'
      or exists (select 1 from jobs j where j.order_id = orders.id and j.status in ('failed', 'retry') and j.kind <> 'push.send')`,
  },
  noi: { label: 'Noi (48 h)', where: `created_at >= now() - interval '48 hours' and status <> 'cancelled' and (payment_method <> 'card' or payment_status in ('paid', 'partially_refunded'))` },
  transfer: { label: 'Așteaptă transferul', where: `payment_status = 'awaiting_transfer' and status <> 'cancelled'` },
  pregatire: { label: 'Plătite, de pregătit', where: `status in ('confirmed', 'processing') and payment_status in ('paid', 'partially_refunded')` },
  ramburs: { label: 'Ramburs, de pregătit', where: `status in ('confirmed', 'processing') and payment_status = 'awaiting_collection'` },
  expediate: { label: 'Expediate', where: `status = 'shipped'` },
  incasare: { label: 'Ramburs de încasat', where: `payment_status = 'awaiting_collection' and status in ('shipped', 'delivered')` },
  // A cash-on-delivery parcel that left and came back unpaid (refused or not picked up), cancelled by a person; nothing automatic.
  intoarse: { label: 'Ramburs întors, neîncasat', where: `payment_method = 'cash_on_delivery' and status = 'cancelled' and shipped_at is not null and payment_status = 'awaiting_collection'` },
  livrate: { label: 'Livrate', where: `status = 'delivered'` },
  retururi: { label: 'Retururi', where: `return_status is not null` },
  rambursari: { label: 'Rambursări', where: `payment_status in ('refunded', 'partially_refunded')` },
  anulate: { label: 'Anulate', where: `status = 'cancelled'` },
  joburi: { label: 'Joburi eșuate', where: `exists (select 1 from jobs j where j.order_id = orders.id and j.status in ('failed', 'retry') and j.kind <> 'push.send')` },
  facturi: {
    label: 'Facturi de verificat',
    where: `invoice_status = 'failed' or (fgo_invoice_number is not null and fgo_storno_number is null and (status = 'cancelled' or payment_status = 'refunded'))`,
  },
  nefinalizate: { label: 'Card nefinalizat', where: `payment_method = 'card' and status in ('pending', 'abandoned')` },
} as const
export type QueueKey = keyof typeof QUEUES
/** The iOS app's order filters (read-only views; card attempts never paid are only under "all" and "unpaid"). */
export const APP_FILTERS = {
  all: `true`,
  new: `created_at >= now() - interval '48 hours' and status <> 'cancelled' and (payment_method <> 'card' or payment_status in ('paid', 'partially_refunded'))`,
  paid: `payment_status in ('paid', 'partially_refunded')`,
  unpaid: `payment_status in ('pending', 'awaiting_transfer', 'awaiting_collection') and status not in ('cancelled')`,
  shipped: `status = 'shipped'`,
  delivered: `status = 'delivered'`,
  cancelled: `status = 'cancelled'`,
  refunded: `payment_status in ('refunded', 'partially_refunded')`,
} as const
export type AppOrderFilter = keyof typeof APP_FILTERS
export const isAppFilter = (k: string): k is AppOrderFilter => Object.prototype.hasOwnProperty.call(APP_FILTERS, k)

export const isQueue = (k: string): k is QueueKey => Object.prototype.hasOwnProperty.call(QUEUES, k)

export const orders = {
  byId: async (q: Queryable, id: string, lock = false) => (UUID.test(id) ? one(q, `select * from orders where id = $1${lock ? ' for update' : ''}`, [id]) : null),
  byToken: (q: Queryable, token: string) => one(q, 'select * from orders where public_token = $1', [token]),
  byNumber: (q: Queryable, n: string) => one(q, 'select * from orders where order_number = $1', [n]),
  byIdempotencyKey: (q: Queryable, key: string) => one(q, 'select * from orders where idempotency_key = $1', [key]),
  byPaymentIntent: (q: Queryable, pi: string) => one(q, 'select * from orders where stripe_payment_intent_id = $1', [pi]),
  byRecoveryToken: (q: Queryable, token: string) => one(q, 'select * from orders where recovery_token = $1', [token]),
  /** The post-purchase order linked to a parent, if one was created. */
  childOf: (q: Queryable, parentId: string) => one(q, 'select * from orders where parent_order_id = $1', [parentId]),

  /**
   * The address's "last order" for the CRM (bt_last_order_*): the newest order the customer actually
   * placed. Not counted: card attempts still in progress, and post-purchase additions that were never
   * paid (declined, failed, cancelled or still pending); those never replace the order before them.
   * Abandoned checkouts do count (the CRM shows "plată nefinalizată" on purpose).
   */
  latestKnown: (q: Queryable, email: string) =>
    one(
      q,
      `select * from orders where email = $1
         and not (payment_method = 'card' and status = 'pending')
         and not (kind = 'upsell' and payment_status not in ('paid', 'partially_refunded', 'refunded'))
       order by created_at desc limit 1`,
      [email],
    ),

  /** Unpaid card attempts of an address still left in `abandoned`, newest first. */
  async abandonedFor(q: Queryable, email: string) {
    const { rows } = await q.query("select * from orders where email = $1 and status = 'abandoned' order by created_at desc", [email])
    return withItems(q, rows)
  },

  async list(q: Queryable, opts: { limit?: number; search?: string; queue?: QueueKey } = {}) {
    const params: unknown[] = [opts.limit ?? 100]
    const where: string[] = []
    if (opts.search) {
      params.push(`%${opts.search.toLowerCase()}%`)
      where.push(`(lower(order_number) like $2 or lower(email) like $2 or lower(customer->>'lastName') like $2 or lower(coalesce(customer->>'company','')) like $2)`)
    }
    if (opts.queue && QUEUES[opts.queue]) where.push(`(${QUEUES[opts.queue].where})`)
    const { rows } = await q.query(`select * from orders ${where.length ? `where ${where.join(' and ')}` : ''} order by created_at desc limit $1`, params)
    return withItems(q, rows)
  },

  /** A page of orders matching a fixed filter (the iOS app), newest first, before a date (the previous page's last). */
  async page(q: Queryable, filter: AppOrderFilter, opts: { before?: Date; limit?: number } = {}) {
    const params: unknown[] = [Math.min(Math.max(opts.limit ?? 30, 1), 100)]
    const where: string[] = [APP_FILTERS[filter]]
    if (opts.before) {
      params.push(opts.before)
      where.push(`created_at < $${params.length}`)
    }
    const { rows } = await q.query(`select * from orders where ${where.map((w) => `(${w})`).join(' and ')} order by created_at desc limit $1`, params)
    return withItems(q, rows)
  },

  /** How many orders sit in each work queue (the /admin filters). */
  async queueCounts(q: Queryable): Promise<Record<QueueKey, number>> {
    const keys = Object.keys(QUEUES) as QueueKey[]
    const { rows } = await q.query<Record<string, string>>(`select ${keys.map((k) => `count(*) filter (where ${QUEUES[k].where}) as "${k}"`).join(', ')} from orders`)
    return Object.fromEntries(keys.map((k) => [k, Number(rows[0][k] ?? 0)])) as Record<QueueKey, number>
  },

  /**
   * Next sequence for the order's day. Must run inside the order transaction: the upsert row-locks
   * that day's counter until commit, so concurrent checkouts get distinct numbers, and a rolled-back
   * order releases its number. The unique index on order_number is the final guarantee.
   */
  async nextSeq(q: Queryable, day: string): Promise<number> {
    const { rows } = await q.query<{ n: number }>(
      `insert into order_day_counters (day, last_value) values ($1::date, 1)
       on conflict (day) do update set last_value = order_day_counters.last_value + 1
       returning last_value as n`,
      [day],
    )
    return Number(rows[0].n)
  },

  async insert(
    q: Queryable,
    o: Omit<Order, 'createdAt' | 'updatedAt' | 'refundedMinor' | 'paidAt' | 'cancelledAt' | 'cancelReason' | 'refundedAt' | 'fgoInvoiceSeries' | 'fgoInvoiceNumber' | 'fgoInvoiceLink' | 'fgoStornoNumber' | 'ghlContactId' | 'ghlOpportunityId' | 'courier' | 'trackingNumber' | 'trackingUrl' | 'shippedAt' | 'deliveredAt' | 'stripePaymentIntentId' | 'recoveryStatus' | 'recoveryReason' | 'recoveryToken' | 'recoveryExpiresAt' | 'returnStatus' | 'returnRequestedAt' | 'returnReceivedAt' | 'stripeCustomerId' | 'stripePaymentMethodId' | 'upsellStatus' | 'upsellExpiresAt' | 'codAmountMinor' | 'codReference'>,
    idempotencyKey: string,
    termsAcceptedAt: Date,
  ) {
    await q.query(
      `insert into orders (id, order_number, public_token, idempotency_key, status, payment_status, payment_method, invoice_status,
        currency, subtotal_minor, shipping_minor, total_minor, email, phone, customer, billing_address, shipping_address, notes,
        marketing_consent, terms_accepted_at, attribution, discount_minor, promotions, kind, parent_order_id, promo_code, fx_rate, locale, site)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)`,
      [
        o.id, o.orderNumber, o.publicToken, idempotencyKey, o.status, o.paymentStatus, o.paymentMethod, o.invoiceStatus,
        o.currency, o.subtotalMinor, o.shippingMinor, o.totalMinor, o.email, o.phone, JSON.stringify(o.customer),
        JSON.stringify(o.billingAddress), JSON.stringify(o.shippingAddress), o.notes, o.marketingConsent, termsAcceptedAt,
        o.attribution ? JSON.stringify(o.attribution) : null,
        o.discountMinor,
        JSON.stringify(o.promotions),
        o.kind,
        o.parentOrderId,
        o.promoCode,
        o.fxRate,
        o.locale,
        o.site,
      ],
    )
    for (const i of o.items) {
      await q.query(
        `insert into order_items (order_id, position, product_id, variant_id, product_name, variant_name, sku, quantity, unit_price_minor, line_total_minor, discount_minor, promotion_id, code_discount_minor)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [o.id, i.position, i.productId, i.variantId, i.productName, i.variantName, i.sku, i.quantity, i.unitPriceMinor, i.lineTotalMinor, i.discountMinor, i.promotionId, i.codeDiscountMinor],
      )
    }
  },

  /** Updates the given columns (snake_case) and bumps updated_at. */
  async update(q: Queryable, id: string, patch: Record<string, unknown>) {
    const keys = Object.keys(patch)
    if (!keys.length) return
    const set = keys.map((k, i) => `${k} = $${i + 2}`).join(', ')
    await q.query(`update orders set ${set}, updated_at = now() where id = $1`, [id, ...keys.map((k) => patch[k])])
  },

  /**
   * Money and documents a person still has to settle: paid orders that were cancelled but not refunded,
   * issued invoices of cancelled or fully refunded orders without a credit note, and Stripe payments of
   * ours the webhook could not apply (stored as "attention:<reason>").
   */
  async followUps(q: Queryable) {
    const due = await q.query<{ id: string; order_number: string; status: string; payment_status: string; fgo_invoice_number: string | null; total_minor: number; refunded_minor: number }>(
      `select id, order_number, status, payment_status, fgo_invoice_number, total_minor, refunded_minor from orders
        where (status = 'cancelled' and payment_status in ('paid', 'partially_refunded'))
           or (fgo_invoice_number is not null and fgo_storno_number is null and (status = 'cancelled' or payment_status = 'refunded'))
        order by updated_at desc limit 50`,
    )
    const payments = await q.query<{ event_id: string; type: string; outcome: string; received_at: Date }>(
      "select event_id, type, outcome, received_at from webhook_events where outcome like 'attention:%' order by received_at desc limit 20",
    )
    return {
      orders: due.rows.map((r) => ({
        id: r.id,
        orderNumber: r.order_number,
        refund: r.status === 'cancelled' && (r.payment_status === 'paid' || r.payment_status === 'partially_refunded'),
        storno: !!r.fgo_invoice_number,
        outstandingMinor: Number(r.total_minor) - Number(r.refunded_minor),
      })),
      payments: payments.rows.map((r) => ({ eventId: r.event_id, type: r.type, reason: r.outcome.slice('attention:'.length), receivedAt: new Date(r.received_at) })),
    }
  },

  event: (q: Queryable, orderId: string, type: string, source: string, data: Record<string, unknown> = {}) =>
    q.query('insert into order_events (order_id, type, source, data) values ($1,$2,$3,$4)', [orderId, type, source, JSON.stringify(data)]),

  async events(q: Queryable, orderId: string) {
    return (await q.query<{ type: string; source: string; data: Record<string, unknown>; created_at: string }>(
      'select type, source, data, created_at from order_events where order_id = $1 order by id',
      [orderId],
    )).rows
  },

  /** Lifetime numbers for the CRM: paid orders and their value, by email. */
  async lifetime(q: Queryable, email: string) {
    const { rows } = await q.query<{ n: string; v: string | null }>(
      "select count(*) as n, round(sum((total_minor - refunded_minor) * fx_rate)) as v from orders where email = $1 and payment_status in ('paid','partially_refunded')",
      [email],
    )
    return { orders: Number(rows[0].n), valueMinor: Number(rows[0].v ?? 0) }
  },
}
