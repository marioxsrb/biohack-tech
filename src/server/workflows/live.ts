/**
 * Live sending through GoHighLevel (23.10.2026). The store decides; GHL only sends: for a "send" decision the store
 * writes the email's values on the contact (contact.bt_* fields) and then adds the tag bt-wf-<template>, which starts
 * the GHL workflow "tag added → send this approved email → remove the tag" (E01–E14, location confirmed 23.10.2026).
 *
 * Switches, all needed for an email to go out:
 *   WORKFLOWS_MODE=live            the engine runs (otherwise off / dry_run, engine.ts);
 *   WORKFLOWS_LIVE=a,b             the workflows that send; every other one is only recorded (dry_run);
 *   WORKFLOWS_TEST_RECIPIENTS=x,y  while set, only these addresses receive anything (internal tests);
 *   the GHL location: GHL_WF_TOKEN + GHL_WF_LOCATION_ID, or GHL_WF_LOCATION_ID equal to GHL_LOCATION_ID (the same
 *   location the store already syncs to), which reuses GHL_PRIVATE_TOKEN.
 * An email whose values cannot all be filled is skipped (recorded with the missing names), never sent with a raw
 * {{variable}}. Nothing here writes a sentence: the copy is the approved templates'.
 */
import 'server-only'
import { WORKFLOWS, type WorkflowId } from '@/config/workflows'
import { isVoucherProduct } from '@/config/vouchers'
import { templateVariables } from '@/config/workflow-templates'
import { catalogProduct } from '@/content/catalog'
import type { GhlConfig } from '@/server/config'
import type { Queryable } from '@/server/db'
import { videoStorage } from '@/server/integrations/video-storage'
import { marketing } from '@/server/marketing/consent'
import { orders } from '@/server/orders/repository'
import { issueVoucher, normalizeEmail } from '@/server/vouchers'
import { VARIABLE_FIELD, WORKFLOW_FIELDS, type WorkflowSend } from './ghl-map'
import { recommendationUrl, reviewUrl, voucherUrl } from './links'
import { cartItems, cartProductBenefits, cartVariant, joinRo, postPurchaseFacts, productGuides, productTypes, voucherAmount, voucherExpiry, type CartLine } from './variables'

type Env = Record<string, string | undefined>

const list = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

/** The GHL location the workflows send from, or null (then nothing is sent). */
export function workflowsGhl(env: Env = process.env): GhlConfig | null {
  const locationId = env.GHL_WF_LOCATION_ID?.trim()
  if (!locationId) return null
  const token = env.GHL_WF_TOKEN?.trim() || (locationId === env.GHL_LOCATION_ID?.trim() ? env.GHL_PRIVATE_TOKEN?.trim() : undefined)
  if (!token) return null
  return { token, locationId, pipelineId: '', apiBase: env.GHL_API_BASE?.trim() || 'https://services.leadconnectorhq.com' }
}

export const liveWorkflows = (env: Env = process.env) => list(env.WORKFLOWS_LIVE) as WorkflowId[]
export const testRecipients = (env: Env = process.env) => list(env.WORKFLOWS_TEST_RECIPIENTS)

/** Whether this workflow's email to this address really goes out now (all the switches above). */
export function sendsLive(workflow: WorkflowId, email: string, env: Env = process.env) {
  if (env.WORKFLOWS_MODE !== 'live' || !workflowsGhl(env)) return false
  if (!liveWorkflows(env).includes(workflow)) return false
  const only = testRecipients(env)
  return !only.length || only.includes(normalizeEmail(email))
}

export type LiveEnrollment = { id: string; email: string; workflow: WorkflowId; ref: string; step: number; data: Record<string, unknown> }

/** A step that cannot go live at all, whatever its values (its feature is off): the reason, or null. */
export function liveBlocker(template: string, env: Env = process.env): string | null {
  // The review email promises a video upload: only while the upload works (the storage is configured).
  if (template === 'post-purchase-03' && videoStorage(env).kind === 'none') return 'review_upload_off'
  return null
}

/**
 * Inside the tick's transaction, for a live "send": the voucher the email states (issued now, once per enrollment and
 * step), so the job only reads it. Returns the voucher id, null when the step has none, or a skip reason.
 */
export async function prepareVoucher(q: Queryable, e: LiveEnrollment, template: string): Promise<{ voucherId: string | null } | { skip: string }> {
  const wf = WORKFLOWS[e.workflow]
  const step = wf.steps[e.step]
  if (!step?.voucher) return { voucherId: (e.data.voucherId as string | undefined) ?? null }
  let product: string | undefined
  if (step.voucher === 'cart') {
    const lines = (e.data.lines as CartLine[] | undefined) ?? []
    // Only the one-product-type email is approved (abandoned-cart-04 names one product and one amount).
    if (cartVariant(lines) !== 'single') return { skip: 'voucher_variant_not_approved' }
    product = productTypes(lines).find(isVoucherProduct)
  } else {
    product = wf.product ?? (e.data.productId as string | undefined)
  }
  if (!product || !wf.voucherSource) return { skip: 'no_voucher_product' }
  const issued = await issueVoucher(q, { email: e.email, productId: product, source: wf.voucherSource, sourceRef: `${e.id}:${template}`, actor: 'workflow' })
  if (!issued.ok) return { skip: `voucher_${issued.reason}` }
  return { voucherId: issued.voucher.id }
}

/** The values of one email for one contact, from the store's data, and the names it could not fill. */
export async function workflowValues(q: Queryable, e: LiveEnrollment, template: string, siteUrl: string, voucherId: string | null) {
  const values: NonNullable<WorkflowSend['values']> = {}
  const site = siteUrl.replace(/\/$/, '')
  const token = await marketing.ensureUnsubscribeToken(q, e.email)
  values.unsubscribeUrl = `${site}/dezabonare/${token}`

  if (voucherId) {
    const { rows } = await q.query<{ code: string; product_id: string; amount_minor: number | null; expires_at: string }>('select code, product_id, amount_minor, expires_at from vouchers where id = $1', [voucherId])
    const v = rows[0]
    if (v) {
      if (v.amount_minor != null) values.voucherAmount = voucherAmount(v.amount_minor)
      values.voucherExpiry = voucherExpiry(new Date(v.expires_at))
      values.productName = catalogProduct(v.product_id)?.name ?? undefined
      const url = voucherUrl(site, e.email, v.code)
      if (url) values.voucherUrl = url
    }
  }

  if (e.workflow === 'abandoned-cart') {
    const lines = (e.data.lines as CartLine[] | undefined) ?? []
    if (lines.length) {
      values.cartItems = cartItems(lines).join(', ')
      values.cartBenefits = cartProductBenefits(lines).join('; ')
    }
    const o = await orders.byId(q, e.ref)
    if (o?.recoveryToken) values.checkoutUrl = `${site}/reluare/${o.recoveryToken}`
  }

  if (e.workflow === 'post-purchase') {
    const bought = (e.data.products as string[] | undefined) ?? []
    const { rows } = await q.query<{ product_id: string }>(
      `select distinct i.product_id from orders o join order_items i on i.order_id = o.id
       where lower(o.email) = $1 and o.status not in ('cancelled','abandoned') and o.payment_status in ('paid','partially_refunded','awaiting_collection')`,
      [normalizeEmail(e.email)],
    )
    const facts = postPurchaseFacts(bought, rows.map((r) => r.product_id))
    if (facts.productName) values.productName = facts.productName
    const guides = productGuides(facts.products)
    if (guides.firstSteps) values.firstSteps = guides.firstSteps.replace(/^- /gm, '').split('\n').filter(Boolean).join(' ')
    if (guides.usageTips) values.usageTips = guides.usageTips.replace(/^- /gm, '').split('\n').filter(Boolean).join(' ')
    if (!facts.ownsAll) {
      values.recommendation = joinRo(facts.complementary.map((id) => catalogProduct(id)?.name ?? id))
      values.recommendationUrl = recommendationUrl(site, facts.complementary[0])
    }
    const firstOrder = ((e.data.orders as string[] | undefined) ?? [])[0] ?? e.ref
    const review = reviewUrl(site, e.email, firstOrder)
    if (review) values.reviewUrl = review
  }

  const missing = templateVariables(template).filter((name) => {
    const field = VARIABLE_FIELD[name]
    return !field || !values[field]
  })
  return { values, missing }
}

/** The contact fields as the GHL API takes them (the short key, without "contact."). */
export const ghlFields = (values: NonNullable<WorkflowSend['values']>) =>
  Object.entries(values)
    .filter(([, v]) => typeof v === 'string' && v.length > 0)
    .map(([k, v]) => ({ key: WORKFLOW_FIELDS[k as keyof typeof WORKFLOW_FIELDS].replace(/^contact\./, ''), field_value: v as string }))
