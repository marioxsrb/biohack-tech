/**
 * Runs queued side effects. Called right after a request that queued work (via `after`),
 * every minute by the in-process timer (instrumentation.ts), and by /api/jobs/run.
 * A failure never touches the order's payment state: it is retried with backoff and,
 * after the last attempt, shown in /admin for a person.
 */
import 'server-only'
import { after } from 'next/server'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { FgoError, fgo } from '@/server/integrations/fgo'
import { GhlError, TAGS, ghl, tagsFor } from '@/server/integrations/ghl'
import { renderEmail, stillDue, type EmailTemplate } from '@/server/integrations/email/templates'
import { deliver, EmailError } from '@/server/integrations/email/transport'
import { NOTIFICATIONS, renderNotification, type NotifyEvent } from '@/server/notifications'
import { CART_INTEREST, interestOf, leads, recoveryDecision, recoveryFacts } from '@/server/leads'
import { renderLeadRecovery } from '@/server/leads-email'
import { gatedOrigin } from '@/lib/lead'
import { marketing } from '@/server/marketing/consent'
import { INTEREST_TAG, LEAD_TAGS } from '@/server/integrations/ghl'
import { errText, log } from '@/server/log'
import { marketingStatus } from '@/server/marketing/sync'
import { orders } from '@/server/orders/repository'
import { reconcileCardPayment } from '@/server/orders/reconcile'
import { releaseUpsellCard } from '@/server/orders/upsell'
import { syncEnquiry } from '@/server/enquiries'
import { expireUnpaidTransfer, markAbandonedIfUnpaid } from '@/server/orders/service'
import { withdrawals } from '@/server/orders/withdrawal'
import { jobs, type Job } from './outbox'

class Skip extends Error {}
class Permanent extends Error {}

async function syncCrm(orderId: string) {
  const c = getConfig()
  if (!c.ghl) throw new Skip('ghl not configured')
  const db = await getDb()
  const o = await orders.byId(db, orderId)
  if (!o) throw new Skip('order gone')
  // The contact shows the address's latest order and its current marketing status, whichever order is syncing.
  const latest = (await orders.latestKnown(db, o.email)) ?? o
  const m = await marketingStatus(db, o.email, c.siteUrl)
  const contactId = await ghl.upsertContact(c.ghl, latest, await orders.lifetime(db, o.email), m.fields, c.siteUrl)
  await ghl.addTags(c.ghl, contactId, [...tagsFor(o), ...(m.recoverable ? [TAGS.recovery] : [])])
  if (!m.recoverable && m.hadRecovery) await ghl.removeTags(c.ghl, contactId, [TAGS.recovery])
  const parentNumber = o.parentOrderId ? (await orders.byId(db, o.parentOrderId))?.orderNumber : null
  const oppId = await ghl.syncOpportunity(c.ghl, o, contactId, o.ghlOpportunityId, parentNumber)
  if (contactId !== o.ghlContactId || oppId !== o.ghlOpportunityId) await orders.update(db, o.id, { ghl_contact_id: contactId, ghl_opportunity_id: oppId })
  return contactId
}

const handlers: Record<Job['kind'], (j: Job) => Promise<string | void>> = {
  'ghl.sync': async (j) => void (await syncCrm(j.orderId!)),

  // After an unsubscribe (or a consent change without an order): only the marketing fields and the recovery tag.
  'marketing.sync': async (j) => {
    const c = getConfig()
    if (!c.ghl) throw new Skip('ghl not configured')
    const db = await getDb()
    const email = String(j.payload.email ?? '')
    const { rows } = await db.query('select 1 from orders where email = $1 and ghl_contact_id is not null limit 1', [email])
    if (!rows.length) throw new Skip('address not in the CRM')
    const m = await marketingStatus(db, email, c.siteUrl)
    const contactId = await ghl.updateMarketing(c.ghl, email, m.fields)
    if (!m.recoverable && m.hadRecovery) await ghl.removeTags(c.ghl, contactId, [TAGS.recovery])
    return m.fields.consent ? 'consent' : 'no consent'
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
    const contactId = await ghl.upsertLeadContact(c.ghl, lead)
    const products = lead.productId && lead.productId !== CART_INTEREST ? [lead.productId] : (lead.cart ?? []).map((l) => l.productId)
    await ghl.addTags(c.ghl, contactId, [
      LEAD_TAGS.lead,
      lead.funnel === 'gated_price' ? LEAD_TAGS.gated : LEAD_TAGS.visible,
      ...(lead.stage !== 'lead' ? [LEAD_TAGS.checkout] : []),
      ...(lead.stage === 'ordered' || lead.stage === 'purchased' ? [LEAD_TAGS.converted] : []),
      ...products.map((p) => INTEREST_TAG[p]).filter(Boolean),
    ])
    if (contactId !== lead.ghlContactId) await leads.update(db, lead.id, { ghl_contact_id: contactId })
    return contactId
  },

  // One recovery step for a lead, decided now: abandonment is recorded; an email only with consent.
  'lead.recovery': async (j) => {
    const c = getConfig()
    const db = await getDb()
    const lead = await leads.byId(db, String(j.payload.leadId ?? ''))
    if (!lead) throw new Skip('lead gone')
    const step = Number(j.payload.step) === 2 ? 2 : 1
    const own = c.email.transport === 'smtp' || c.email.transport === 'file'
    const facts = await recoveryFacts(db, lead)
    const now = new Date()
    const d = recoveryDecision(lead, { stage: String(j.payload.stage), step, now, features: c.features, firstMinutes: c.recovery.firstMinutes, secondHours: c.recovery.secondHours, ...facts, canSend: own, notTestRecipient: !!c.recovery.testRecipients && !c.recovery.testRecipients.includes(lead.email.toLowerCase()) })
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
    const base = lead.funnel === 'gated_price' ? gatedOrigin(c.siteUrl) : c.siteUrl
    const mail = renderLeadRecovery({
      step,
      firstName: lead.name?.split(' ')[0] ?? null,
      products: interestOf(lead),
      abandonment: d.abandonment,
      link: `${base}/api/lead/resume?t=${lead.recoveryToken}`,
      unsubscribeUrl: `${c.siteUrl}/dezabonare/${token}`,
    })
    const ref = await deliver(c, { ...mail, to: lead.email, name: `lead-recovery-${lead.id}-${step}` })
    await leads.update(db, lead.id, { abandonment: lead.abandonment ?? d.abandonment, recovery_status: 'sent', recovery_reason: `step ${step}`, recovery_sent: step, last_recovery_at: now })
    return ref
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
            e instanceof Permanent || (e instanceof EmailError && !e.retryable) || (e instanceof GhlError && !e.retryable && e.status !== 404 && e.status !== 401)
          const dead = await jobs.fail(db, job, errText(e), permanent)
          log[dead ? 'error' : 'warn'](dead ? 'job.failed' : 'job.retry', { job: job.kind, jobId: job.id, orderId: job.orderId, attempt: job.attempts, error: errText(e) })
          // Stopped for good: the team hears about it once (never about its own notifications, which would loop).
          if (dead && job.orderId && job.kind !== 'notify.send' && notificationsOn())
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
