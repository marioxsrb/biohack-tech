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
    currency: 'RON',
    subtotalMinor: Number(r.subtotal_minor),
    discountMinor: Number(r.discount_minor ?? 0),
    promotions: (r.promotions as Order['promotions']) ?? [],
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

  async list(q: Queryable, opts: { limit?: number; search?: string } = {}) {
    const params: unknown[] = [opts.limit ?? 100]
    let where = ''
    if (opts.search) {
      params.push(`%${opts.search.toLowerCase()}%`)
      where = `where lower(order_number) like $2 or lower(email) like $2 or lower(customer->>'lastName') like $2 or lower(coalesce(customer->>'company','')) like $2`
    }
    const { rows } = await q.query(`select * from orders ${where} order by created_at desc limit $1`, params)
    return withItems(q, rows)
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
        marketing_consent, terms_accepted_at, attribution, discount_minor, promotions, kind, parent_order_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)`,
      [
        o.id, o.orderNumber, o.publicToken, idempotencyKey, o.status, o.paymentStatus, o.paymentMethod, o.invoiceStatus,
        o.currency, o.subtotalMinor, o.shippingMinor, o.totalMinor, o.email, o.phone, JSON.stringify(o.customer),
        JSON.stringify(o.billingAddress), JSON.stringify(o.shippingAddress), o.notes, o.marketingConsent, termsAcceptedAt,
        o.attribution ? JSON.stringify(o.attribution) : null,
        o.discountMinor,
        JSON.stringify(o.promotions),
        o.kind,
        o.parentOrderId,
      ],
    )
    for (const i of o.items) {
      await q.query(
        `insert into order_items (order_id, position, product_id, variant_id, product_name, variant_name, sku, quantity, unit_price_minor, line_total_minor, discount_minor, promotion_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [o.id, i.position, i.productId, i.variantId, i.productName, i.variantName, i.sku, i.quantity, i.unitPriceMinor, i.lineTotalMinor, i.discountMinor, i.promotionId],
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
      "select count(*) as n, sum(total_minor - refunded_minor) as v from orders where email = $1 and payment_status in ('paid','partially_refunded')",
      [email],
    )
    return { orders: Number(rows[0].n), valueMinor: Number(rows[0].v ?? 0) }
  },
}
