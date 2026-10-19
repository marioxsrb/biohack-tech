'use server'

import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { ADMIN_COOKIE } from '@/lib/admin-auth'
import { actorName, FULFIL_COOKIE, fulfilAccess, type FulfilActor } from '@/lib/fulfillment-auth'
import { getDb } from '@/server/db'
import { courier } from '@/server/fulfillment/courier'
import { runDueJobs } from '@/server/jobs/runner'
import { log } from '@/server/log'
import { markPrepared, markProcessing, markShipped, noteAwb, reportIssue } from '@/server/orders/service'
import { audit } from '@/server/store-settings'

/**
 * The portal's only mutations: start preparing, packed, note the AWB, shipped, report or clear a problem. Each one
 * checks access itself (Server Actions are HTTP endpoints), goes through the canonical transitions (state.ts: a
 * refused transition changes nothing), is idempotent and lands in the admin audit and the order's history.
 * Nothing here can refund, change a price, a discount or a payment, touch settings or delete an order.
 */
async function guard(): Promise<FulfilActor> {
  const c = await cookies()
  const actor = await fulfilAccess(c.get(FULFIL_COOKIE)?.value, c.get(ADMIN_COOKIE)?.value, (await headers()).get('authorization'))
  if (!actor) {
    log.warn('fulfillment.unauthorized_action')
    throw new Error('unauthorized')
  }
  return actor
}

const text = (f: FormData, k: string, max = 200) => String(f.get(k) ?? '').trim().slice(0, max)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

async function done(actor: FulfilActor, id: string, action: string, changed: boolean, details: Record<string, unknown> = {}) {
  log.info('fulfillment.action', { orderId: id, action, changed, role: actor.role })
  if (changed) await audit(await getDb(), actorName(actor), `fulfillment.${action}`, { orderId: id, ...details })
  await runDueJobs()
  revalidatePath('/fulfillment')
  revalidatePath(`/fulfillment/${id}`)
  revalidatePath(`/admin/orders/${id}`)
}

const orderId = (f: FormData) => {
  const id = text(f, 'id', 40)
  if (!UUID.test(id)) throw new Error('bad order')
  return id
}

export async function startPreparingAction(f: FormData) {
  const actor = await guard()
  const id = orderId(f)
  await done(actor, id, 'processing', (await markProcessing(id, 'fulfillment')).changed)
}

export async function preparedAction(f: FormData) {
  const actor = await guard()
  const id = orderId(f)
  await done(actor, id, 'prepared', (await markPrepared(id, 'fulfillment', actorName(actor))).changed)
}

export async function noteAwbAction(f: FormData) {
  const actor = await guard()
  const id = orderId(f)
  const courierName = text(f, 'courier', 60)
  const trackingNumber = text(f, 'tracking', 80)
  if (!courierName || !trackingNumber) return
  const url = text(f, 'trackingUrl', 400)
  const trackingUrl = /^https:\/\//.test(url) ? url : courier().trackingUrl(courierName, trackingNumber)
  await done(actor, id, 'awb_noted', (await noteAwb(id, 'fulfillment', actorName(actor), { courier: courierName, trackingNumber, trackingUrl })).changed, { courier: courierName, trackingNumber })
}

export async function shippedAction(f: FormData) {
  const actor = await guard()
  const id = orderId(f)
  const courierName = text(f, 'courier', 60)
  const trackingNumber = text(f, 'tracking', 80)
  if (!courierName || !trackingNumber) return
  const url = text(f, 'trackingUrl', 400)
  const trackingUrl = /^https:\/\//.test(url) ? url : courier().trackingUrl(courierName, trackingNumber)
  await done(actor, id, 'shipped', (await markShipped(id, 'fulfillment', { courier: courierName, trackingNumber, trackingUrl })).changed, { courier: courierName, trackingNumber })
}

export async function issueAction(f: FormData) {
  const actor = await guard()
  const id = orderId(f)
  const clear = f.get('clear') === '1'
  const issue = clear ? null : text(f, 'issue', 500)
  if (!clear && !issue) return
  await done(actor, id, clear ? 'issue_cleared' : 'issue_reported', (await reportIssue(id, 'fulfillment', actorName(actor), issue)).changed)
}
