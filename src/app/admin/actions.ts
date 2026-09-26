'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { getDb } from '@/server/db'
import { jobs } from '@/server/jobs/outbox'
import { runDueJobs } from '@/server/jobs/runner'
import { log } from '@/server/log'
import { cancelOrder, confirmPayment, markDelivered, markProcessing, markShipped, recordRefund } from '@/server/orders/service'

/** Defense in depth: the proxy already requires Basic Auth for /admin. */
async function guard() {
  const auth = (await headers()).get('authorization') ?? ''
  if (!process.env.ADMIN_PASSWORD || !auth.startsWith('Basic ')) throw new Error('unauthorized')
}

const text = (f: FormData, k: string, max = 200) => String(f.get(k) ?? '').trim().slice(0, max)

async function done(id: string, action: string, changed: boolean) {
  log.info('admin.action', { orderId: id, action, changed })
  await runDueJobs()
  revalidatePath(`/admin/orders/${id}`)
  revalidatePath('/admin')
}

export async function markPaidAction(f: FormData) {
  await guard()
  const id = text(f, 'id')
  const r = await confirmPayment(id, 'admin')
  await done(id, 'mark_paid', r.changed)
}

export async function processingAction(f: FormData) {
  await guard()
  const id = text(f, 'id')
  await done(id, 'processing', (await markProcessing(id, 'admin')).changed)
}

export async function shipAction(f: FormData) {
  await guard()
  const id = text(f, 'id')
  const courier = text(f, 'courier', 60)
  const trackingNumber = text(f, 'tracking', 80)
  const url = text(f, 'trackingUrl', 400)
  if (!courier || !trackingNumber) return
  const trackingUrl = /^https:\/\//.test(url) ? url : undefined
  await done(id, 'shipped', (await markShipped(id, 'admin', { courier, trackingNumber, trackingUrl })).changed)
}

export async function deliveredAction(f: FormData) {
  await guard()
  const id = text(f, 'id')
  await done(id, 'delivered', (await markDelivered(id, 'admin')).changed)
}

export async function cancelAction(f: FormData) {
  await guard()
  const id = text(f, 'id')
  const reason = text(f, 'reason', 300) || 'anulată de echipă'
  await done(id, 'cancel', (await cancelOrder(id, 'admin', reason)).changed)
}

/** Bank-transfer refunds happen in the bank; this records them (card refunds come from Stripe automatically). */
export async function refundAction(f: FormData) {
  await guard()
  const id = text(f, 'id')
  const lei = Number(text(f, 'amount', 20).replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(lei) || lei <= 0) return
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
