/**
 * The workflow engine over the database (infrastructure, 21.10.2026). Enrollments (one per workflow and reference),
 * the facts the planner needs, and the tick that applies its decisions.
 *
 * WORKFLOWS_MODE:
 *   off      (default) nothing is enrolled and nothing runs: the store behaves exactly as before;
 *   dry_run  enrollments are recorded and each tick records in email_sends what WOULD be sent, when and why not.
 *            No email, no CRM call, no voucher issued (the tick only checks whether one could be).
 *   live     as dry_run, except that a workflow listed in WORKFLOWS_LIVE really sends, through GoHighLevel, to the
 *            addresses allowed (WORKFLOWS_TEST_RECIPIENTS while set): the voucher is issued, the send is queued
 *            (job ghl.workflow_send) and recorded as 'queued', then 'sent' (server/workflows/live.ts).
 */
import 'server-only'
import { randomUUID } from 'node:crypto'
import { WORKFLOWS, WEEKLY_PROMO_LIMIT, type WorkflowId } from '@/config/workflows'
import { isVoucherProduct } from '@/config/vouchers'
import type { Queryable, Row } from '@/server/db'
import { marketing } from '@/server/marketing/consent'
import type { Order } from '@/server/orders/model'
import { normalizeEmail, voucherEligibility } from '@/server/vouchers'
import { jobs } from '@/server/jobs/outbox'
import { decide, dueAt, type Decision, type Enrollment as Planned } from './planner'
import { liveBlocker, prepareVoucher, sendsLive } from './live'

export type WorkflowsMode = 'off' | 'dry_run' | 'live'

export function workflowsMode(env: Record<string, string | undefined> = process.env): WorkflowsMode {
  return env.WORKFLOWS_MODE === 'dry_run' ? 'dry_run' : env.WORKFLOWS_MODE === 'live' ? 'live' : 'off'
}

export function weeklyLimit(env: Record<string, string | undefined> = process.env) {
  const n = Number(env.WORKFLOWS_WEEKLY_LIMIT)
  return n === 2 || n === 3 ? n : WEEKLY_PROMO_LIMIT
}

export type Enrollment = Planned & { id: string; email: string; ref: string; status: 'active' | 'paused' | 'stopped' | 'completed'; nextAt: Date | null; data: Record<string, unknown> }

const toEnrollment = (r: Row): Enrollment => ({
  id: r.id as string,
  email: r.email as string,
  workflow: r.workflow as WorkflowId,
  ref: r.ref as string,
  status: r.status as Enrollment['status'],
  step: Number(r.step),
  startedAt: new Date(r.started_at as string),
  nextAt: r.next_at ? new Date(r.next_at as string) : null,
  data: (r.data ?? {}) as Record<string, unknown>,
})

export type EnrollResult = { ok: true; enrollment: Enrollment; created: boolean } | { ok: false; reason: 'mode_off' | 'exclusive' | 'unknown_workflow' }

/**
 * Enrolls a contact once per workflow and reference (the popup signup, the checkout, the order...). A workflow that
 * cannot run beside one the contact is already in (Win-back and Nudge) is refused. `startAt`: the campaign's date
 * for the seasonal ones (Black Friday day, 1 December, 27 December), now for the others.
 */
export async function enroll(q: Queryable, i: { email: string; workflow: WorkflowId; ref: string; startAt?: Date; data?: Record<string, unknown> }, mode = workflowsMode()): Promise<EnrollResult> {
  if (mode === 'off') return { ok: false, reason: 'mode_off' }
  const wf = WORKFLOWS[i.workflow]
  if (!wf) return { ok: false, reason: 'unknown_workflow' }
  const email = normalizeEmail(i.email)
  const existing = await q.query('select * from workflow_enrollments where workflow = $1 and ref = $2', [i.workflow, i.ref])
  if (existing.rows[0]) return { ok: true, enrollment: toEnrollment(existing.rows[0]), created: false }
  if (wf.exclusiveWith.length) {
    const other = await q.query(`select 1 from workflow_enrollments where email = $1 and status = 'active' and workflow = any($2::text[]) limit 1`, [email, wf.exclusiveWith])
    if (other.rows.length) return { ok: false, reason: 'exclusive' }
  }
  const startedAt = i.startAt ?? new Date()
  const first = dueAt({ workflow: i.workflow, step: 0, startedAt, data: i.data }, 0)
  const { rows } = await q.query(
    `insert into workflow_enrollments (id, email, workflow, ref, started_at, next_at, data) values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (workflow, ref) do nothing returning *`,
    [randomUUID(), email, i.workflow, i.ref, startedAt, first, JSON.stringify(i.data ?? {})],
  )
  if (rows[0]) return { ok: true, enrollment: toEnrollment(rows[0]), created: true }
  const raced = await q.query('select * from workflow_enrollments where workflow = $1 and ref = $2', [i.workflow, i.ref])
  return { ok: true, enrollment: toEnrollment(raced.rows[0]), created: false }
}

export async function stopEnrollment(q: Queryable, id: string, reason: string) {
  await q.query(`update workflow_enrollments set status = 'stopped', stop_reason = $2, next_at = null, updated_at = now() where id = $1 and status in ('active','paused')`, [id, reason])
}

/** Products bought (an order that stands, money or a COD commitment) by this contact since `since`. */
async function purchasedSince(q: Queryable, email: string, since: Date) {
  const { rows } = await q.query(
    `select distinct i.product_id from orders o join order_items i on i.order_id = o.id
     where lower(o.email) = $1 and o.created_at >= $2 and o.status not in ('cancelled','abandoned')
       and o.payment_status in ('paid','partially_refunded','awaiting_collection','awaiting_transfer')`,
    [email, since],
  )
  return rows.map((r) => r.product_id as string)
}

/** The facts the planner needs for this enrollment's next step. */
export async function factsFor(q: Queryable, e: Enrollment, now: Date, campaign?: Record<string, boolean>) {
  const consent = await marketing.state(q, e.email)
  const others = await q.query(`select workflow from workflow_enrollments where email = $1 and status = 'active' and id <> $2`, [e.email, e.id])
  const sent = await q.query(`select created_at from email_sends where email = $1 and promotional and status in ('sent','dry_run','queued') and created_at > $2`, [e.email, new Date(now.getTime() - 7 * 86_400_000)])
  const step = WORKFLOWS[e.workflow].steps[e.step]
  let voucher: 'ready' | 'refused' | undefined
  if (step?.voucher) {
    // Dry run: never issue, only check whether this contact could have the voucher the email states.
    const products = step.voucher === 'cart' ? ((e.data.products as string[] | undefined) ?? []).filter(isVoucherProduct) : [WORKFLOWS[e.workflow].product ?? (e.data.productId as string)]
    const checks = await Promise.all(products.filter(Boolean).map((p) => voucherEligibility(q, e.email, p)))
    voucher = checks.some((c) => c.ok) ? 'ready' : 'refused'
  }
  return {
    now,
    consent: !!consent?.granted,
    purchasedSince: await purchasedSince(q, e.email, e.startedAt),
    activeOther: others.rows.map((r) => r.workflow as WorkflowId),
    promoSent: sent.rows.map((r) => new Date(r.created_at as string)),
    voucher,
    campaign,
    limit: weeklyLimit(),
  }
}

/** Applies one decision: the step's record in email_sends and the enrollment's next state. */
async function apply(q: Queryable, e: Enrollment, d: Decision, now: Date, mode: WorkflowsMode) {
  const wf = WORKFLOWS[e.workflow]
  const advance = async (status: 'dry_run' | 'skipped' | 'queued', template: string, promotional: boolean, reason: string | null) => {
    await q.query(
      `insert into email_sends (email, workflow, template, enrollment_id, promotional, status, reason, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (enrollment_id, template) do nothing`,
      [e.email, e.workflow, template, e.id, promotional, status, reason, now],
    )
    const next = e.step + 1
    const done = next >= wf.steps.length
    await q.query(`update workflow_enrollments set step = $2, status = $3, next_at = $4, updated_at = now() where id = $1`, [e.id, next, done ? 'completed' : 'active', done ? null : dueAt(e, next)])
  }
  switch (d.action) {
    case 'send': {
      if (mode !== 'live' || !sendsLive(e.workflow, e.email)) return advance('dry_run', d.template, d.promotional, null)
      const blocked = liveBlocker(d.template)
      if (blocked) return advance('skipped', d.template, d.promotional, blocked)
      const voucher = await prepareVoucher(q, e, d.template)
      if ('skip' in voucher) return advance('skipped', d.template, d.promotional, voucher.skip)
      await advance('queued', d.template, d.promotional, null)
      await jobs.enqueue(q, { kind: 'ghl.workflow_send', dedupeKey: `ghl.workflow_send:${e.id}:${d.template}`, payload: { enrollmentId: e.id, template: d.template, voucherId: voucher.voucherId } })
      return
    }
    case 'skip':
      return advance('skipped', d.template, wf.steps[d.step].promotional, d.reason)
    case 'wait':
      return q.query(`update workflow_enrollments set next_at = $2, updated_at = now() where id = $1`, [e.id, d.until])
    case 'stop':
      return stopEnrollment(q, e.id, d.reason)
    case 'complete':
      return q.query(`update workflow_enrollments set status = 'completed', next_at = null, updated_at = now() where id = $1`, [e.id])
  }
}

/**
 * Runs the due enrollments (dry run only). Within a contact, the higher-priority workflow goes first, so the weekly
 * limit defers the lower ones. Returns what was decided, for the admin and the tests.
 */
export async function workflowTick(q: Queryable, opts: { now?: Date; limit?: number; campaign?: Record<string, boolean>; mode?: WorkflowsMode } = {}) {
  const mode = opts.mode ?? workflowsMode()
  if (mode === 'off') return []
  const now = opts.now ?? new Date()
  const { rows } = await q.query(`select * from workflow_enrollments where status = 'active' and next_at <= $1 order by next_at limit $2`, [now, opts.limit ?? 200])
  const due = rows.map(toEnrollment).sort((a, b) => a.email.localeCompare(b.email) || WORKFLOWS[a.workflow].priority - WORKFLOWS[b.workflow].priority)
  const out: { id: string; email: string; workflow: WorkflowId; decision: Decision }[] = []
  for (const e of due) {
    const d = decide(e, await factsFor(q, e, now, opts.campaign))
    await apply(q, e, d, now, mode)
    out.push({ id: e.id, email: e.email, workflow: e.workflow, decision: d })
  }
  return out
}

/** Whether a card order had a failed payment: it is a failed payment to follow up, not an abandoned checkout. */
export async function hadFailedPayment(q: Queryable, orderId: string) {
  const { rows } = await q.query(`select 1 from order_events where order_id = $1 and type = 'payment.failed' limit 1`, [orderId])
  return rows.length > 0
}

/**
 * The order events the workflows listen to, in the order's transaction (orders/service.ts), only when not 'off':
 *   order.abandoned    an unpaid card checkout: Abandoned Cart (one sequence per checkout), unless its payment
 *                      FAILED: then it is recorded as a failed payment (its own flow, emails not approved yet);
 *   order.delivered    Post-Purchase: one active sequence per contact; a new order within it joins it (no restart,
 *                      no email sent twice), its products added.
 * A purchase stops what it should at the next tick (the planner reads purchases).
 */
export async function onOrderEvent(q: Queryable, o: Order, event: string, mode = workflowsMode()) {
  if (mode === 'off') return null
  if (event === 'order.abandoned') {
    const products = [...new Set(o.items.map((i) => i.productId))]
    if (await hadFailedPayment(q, o.id)) {
      // Kept apart from Abandoned Cart: paused until its own emails are approved (nothing is planned for it).
      await q.query(
        `insert into workflow_enrollments (id, email, workflow, ref, status, started_at, next_at, stop_reason, data) values ($1,$2,'payment-failed',$3,'paused',now(),null,'copy_pending',$4)
         on conflict (workflow, ref) do nothing`,
        [randomUUID(), normalizeEmail(o.email), o.id, JSON.stringify({ orderNumber: o.orderNumber, products })],
      )
      return 'payment-failed'
    }
    const r = await enroll(q, { email: o.email, workflow: 'abandoned-cart', ref: o.id, data: { orderNumber: o.orderNumber, products, lines: o.items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })) } }, mode)
    return r.ok ? 'abandoned-cart' : null
  }
  if (event === 'order.delivered' && o.kind === 'checkout') {
    const email = normalizeEmail(o.email)
    // A paid post-purchase offer (upsell) is part of its parent order: its products join this sequence, never one of
    // its own (an upsell order is never enrolled: kind 'upsell').
    const upsold = await q.query(
      `select distinct i.product_id from orders u join order_items i on i.order_id = u.id
       where u.parent_order_id = $1 and u.kind = 'upsell' and u.status <> 'cancelled' and u.payment_status in ('paid','partially_refunded')`,
      [o.id],
    )
    const products = [...new Set([...o.items.map((i) => i.productId), ...upsold.rows.map((r) => r.product_id as string)])]
    const active = await q.query(`select * from workflow_enrollments where workflow = 'post-purchase' and email = $1 and status = 'active' for update`, [email])
    if (active.rows[0]) {
      const e = toEnrollment(active.rows[0])
      const orders = [...new Set([...((e.data.orders as string[]) ?? []), o.id])]
      const all = [...new Set([...((e.data.products as string[]) ?? []), ...products])]
      await q.query(`update workflow_enrollments set data = $2, updated_at = now() where id = $1`, [e.id, JSON.stringify({ ...e.data, orders, products: all })])
      return 'post-purchase:joined'
    }
    const r = await enroll(q, { email, workflow: 'post-purchase', ref: o.id, data: { orders: [o.id], products } }, mode)
    return r.ok ? 'post-purchase' : null
  }
  return null
}

export async function enrollmentsFor(q: Queryable, email: string) {
  const { rows } = await q.query('select * from workflow_enrollments where email = $1 order by started_at desc', [normalizeEmail(email)])
  return rows.map(toEnrollment)
}

export async function sendsFor(q: Queryable, email: string) {
  const { rows } = await q.query('select workflow, template, status, reason, promotional, created_at from email_sends where email = $1 order by id', [normalizeEmail(email)])
  return rows
}
