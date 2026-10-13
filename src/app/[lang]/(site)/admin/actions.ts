'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { checkAdminAuth } from '@/lib/admin-auth'
import { getDb } from '@/server/db'
import { jobs } from '@/server/jobs/outbox'
import { runDueJobs } from '@/server/jobs/runner'
import { log } from '@/server/log'
import { courier } from '@/server/fulfillment/courier'
import { enquiries, type EnquiryStatus } from '@/server/enquiries'
import { cancelOrder, confirmPayment, markDelivered, markProcessing, markReturnReceived, markReturnRequested, markShipped, recordRefund } from '@/server/orders/service'

/**
 * Every action verifies the admin credentials itself. Server Actions are HTTP endpoints; the proxy's
 * /admin matcher is not treated as the only line of defense.
 */
async function guard() {
  if (checkAdminAuth((await headers()).get('authorization')) !== 'ok') {
    log.warn('admin.unauthorized_action')
    throw new Error('unauthorized')
  }
}

const text = (f: FormData, k: string, max = 200) => String(f.get(k) ?? '').trim().slice(0, max)
/** Money and cancellations need the ticked confirmation box; without it nothing changes. */
const confirmed = (f: FormData) => f.get('confirm') === 'da'

async function done(id: string, action: string, changed: boolean) {
  log.info('admin.action', { orderId: id, action, changed })
  await runDueJobs()
  revalidatePath(`/admin/orders/${id}`)
  revalidatePath('/admin')
}

export async function markPaidAction(f: FormData) {
  await guard()
  const id = text(f, 'id')
  if (!confirmed(f)) return
  const r = await confirmPayment(id, 'admin')
  await done(id, 'mark_paid', r.changed)
}

/**
 * Cash on delivery: the courier settled the money. Recorded only with the exact amount and the settlement
 * reference (borderou or payment order), both kept in the order's history.
 */
export async function codCollectedAction(f: FormData) {
  await guard()
  const id = text(f, 'id')
  const lei = Number(text(f, 'amount', 20).replace(/\./g, '').replace(',', '.'))
  const reference = text(f, 'reference', 120)
  if (!confirmed(f) || !Number.isFinite(lei) || lei <= 0 || reference.length < 3) return
  const r = await confirmPayment(id, 'admin', { amountMinor: Math.round(lei * 100), currency: 'RON', reference })
  await done(id, 'cod_collected', r.changed)
}

export async function processingAction(f: FormData) {
  await guard()
  const id = text(f, 'id')
  await done(id, 'processing', (await markProcessing(id, 'admin')).changed)
}

export async function shipAction(f: FormData) {
  await guard()
  const id = text(f, 'id')
  const courierName = text(f, 'courier', 60)
  const trackingNumber = text(f, 'tracking', 80)
  const url = text(f, 'trackingUrl', 400)
  if (!courierName || !trackingNumber) return
  const trackingUrl = /^https:\/\//.test(url) ? url : courier().trackingUrl(courierName, trackingNumber)
  await done(id, 'shipped', (await markShipped(id, 'admin', { courier: courierName, trackingNumber, trackingUrl })).changed)
}

export async function returnRequestedAction(f: FormData) {
  await guard()
  const id = text(f, 'id')
  await done(id, 'return_requested', (await markReturnRequested(id, 'admin', 'echipa')).changed)
}

export async function returnReceivedAction(f: FormData) {
  await guard()
  const id = text(f, 'id')
  await done(id, 'return_received', (await markReturnReceived(id, 'admin')).changed)
}

export async function deliveredAction(f: FormData) {
  await guard()
  const id = text(f, 'id')
  await done(id, 'delivered', (await markDelivered(id, 'admin')).changed)
}

export async function cancelAction(f: FormData) {
  await guard()
  const id = text(f, 'id')
  if (!confirmed(f)) return
  const reason = text(f, 'reason', 300) || 'anulată de echipă'
  await done(id, 'cancel', (await cancelOrder(id, 'admin', reason)).changed)
}

/** Bank-transfer refunds happen in the bank; this records them (card refunds come from Stripe automatically). */
export async function refundAction(f: FormData) {
  await guard()
  const id = text(f, 'id')
  const lei = Number(text(f, 'amount', 20).replace(/\./g, '').replace(',', '.'))
  if (!confirmed(f) || !Number.isFinite(lei) || lei <= 0) return
  await done(id, 'refund', (await recordRefund(id, 'admin', Math.round(lei * 100))).changed)
}

export async function retryJobsAction(f: FormData) {
  await guard()
  const id = text(f, 'id')
  const jobId = Number(f.get('jobId')) || undefined
  await jobs.retry(await getDb(), jobId ? { id: jobId } : { orderId: id || undefined })
  await done(id || 'all', 'retry_jobs', true)
}

export async function resyncCrmAction(f: FormData) {
  await guard()
  const id = text(f, 'id')
  await jobs.enqueue(await getDb(), { kind: 'ghl.sync', orderId: id, dedupeKey: `ghl.sync:${id}:admin:${Date.now()}` })
  await done(id, 'resync_crm', true)
}

export async function enquiryStatusAction(f: FormData) {
  await guard()
  const id = text(f, 'id', 40)
  const status = text(f, 'status', 20) as EnquiryStatus
  const changed = await enquiries.setStatus(id, status)
  log.info('admin.action', { enquiryId: id, action: `enquiry_${status}`, changed })
  revalidatePath('/admin/mesaje')
}
