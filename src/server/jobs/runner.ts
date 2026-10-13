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
import { renderEmail, type EmailTemplate } from '@/server/integrations/email/templates'
import { deliver } from '@/server/integrations/email/transport'
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
  const oppId = await ghl.syncOpportunity(c.ghl, o, contactId, o.ghlOpportunityId)
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
    if (c.email.transport === 'ghl' && !o.ghlContactId) {
      await syncCrm(o.id)
      o = (await orders.byId(db, o.id))!
    }
    const withdrawal = template === 'withdrawal_received' ? await withdrawals.byId(String(j.payload.withdrawalId ?? '')) : null
    if (template === 'withdrawal_received' && !withdrawal) throw new Skip('withdrawal statement gone')
    const mail = renderEmail(template, o, { siteUrl: c.siteUrl, bank: c.bank, withdrawal: withdrawal ?? undefined })
    const ref = await deliver(c, { ...mail, name: `${o.orderNumber}-${template}${withdrawal ? `-${withdrawal.reference}` : ''}`, ghlContactId: o.ghlContactId })
    await orders.event(db, o.id, 'email.sent', 'system', { template, ref })
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
          const permanent = e instanceof Permanent || (e instanceof GhlError && !e.retryable && e.status !== 404 && e.status !== 401)
          const dead = await jobs.fail(db, job, errText(e), permanent)
          log[dead ? 'error' : 'warn'](dead ? 'job.failed' : 'job.retry', { job: job.kind, jobId: job.id, orderId: job.orderId, attempt: job.attempts, error: errText(e) })
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
