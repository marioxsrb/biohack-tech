'use server'

import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { ADMIN_COOKIE, checkAdminRequest } from '@/lib/admin-auth'
import { getDb } from '@/server/db'
import { jobs } from '@/server/jobs/outbox'
import { runDueJobs } from '@/server/jobs/runner'
import { log } from '@/server/log'
import { courier } from '@/server/fulfillment/courier'
import { adminKeys } from '@/server/admin-keys'
import { audit, readStoreSettings, saveStoreSettings, type StoreSettings } from '@/server/store-settings'
import { enquiries, type EnquiryStatus } from '@/server/enquiries'
import { cancelScheduledCalls, disableCalling, retryCall } from '@/server/calling/admin'
import { getConfig } from '@/server/config'
import { CODE_RE, normalizeCode, promoCodes } from '@/server/promo'
import { products } from '@/content/catalog'
import { cancelOrder, confirmPayment, markDelivered, markProcessing, markReturnReceived, markReturnRequested, markShipped, recordRefund } from '@/server/orders/service'

/**
 * Every action verifies the admin credentials itself. Server Actions are HTTP endpoints; the proxy's
 * /admin matcher is not treated as the only line of defense.
 */
async function guard() {
  const h = await headers()
  if ((await checkAdminRequest((await cookies()).get(ADMIN_COOKIE)?.value, h.get('authorization'))) !== 'ok') {
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
  revalidatePath('/admin/comenzi')
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

/** AI calling, per lead: cancel the waiting attempt, stop calling for good, or queue one more attempt. */
export async function callAction(f: FormData) {
  await guard()
  const id = text(f, 'lead')
  if (!/^[0-9a-f-]{36}$/.test(id)) return
  const db = await getDb()
  const op = text(f, 'op')
  let result = ''
  if (op === 'cancel') result = `${await cancelScheduledCalls(db, id)} cancelled`
  else if (op === 'disable') {
    await disableCalling(db, id)
    result = 'disabled'
  } else if (op === 'retry') result = await retryCall(db, getConfig(), id)
  log.info('admin.call_action', { leadId: id, op, result })
  if (op === 'retry') await runDueJobs()
  revalidatePath('/admin/leaduri')
}

/** A Bucharest date and time from the form (`2026-11-01T00:00`) as an instant, or null. */
function bucharest(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null
  // Romania is UTC+3 in summer (last Sunday of March to last Sunday of October), UTC+2 otherwise.
  const guess = new Date(`${v}:00Z`)
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Bucharest', timeZoneName: 'shortOffset' }).formatToParts(guess).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+2'
  const hours = Number(offset.replace('GMT', '')) || 2
  return new Date(guess.getTime() - hours * 3_600_000)
}

export type PromoFormState = { error?: string; created?: string }

export async function createPromoAction(_: PromoFormState, f: FormData): Promise<PromoFormState> {
  await guard()
  const code = normalizeCode(text(f, 'code', 40))
  if (!CODE_RE.test(code)) return { error: 'Codul are 3–32 caractere: litere, cifre, - sau _.' }
  const kind = text(f, 'kind') === 'fixed' ? 'fixed' : 'percent'
  const raw = Number(text(f, 'value').replace(',', '.'))
  const value = kind === 'percent' ? Math.round(raw) : Math.round(raw * 100)
  if (!Number.isFinite(raw) || value <= 0 || (kind === 'percent' && value > 90)) return { error: kind === 'percent' ? 'Procentul este între 1 și 90.' : 'Suma este mai mare decât 0 lei.' }
  const chosen = f.getAll('products').map(String).filter((id) => products.some((p) => p.id === id))
  const min = Number(text(f, 'min').replace(',', '.') || '0')
  if (!Number.isFinite(min) || min < 0) return { error: 'Comanda minimă nu este validă.' }
  const startsAt = bucharest(text(f, 'starts'))
  const endsAt = bucharest(text(f, 'ends'))
  if (startsAt && endsAt && endsAt <= startsAt) return { error: 'Data de sfârșit este înaintea celei de început.' }
  const maxRaw = text(f, 'max')
  const maxUses = maxRaw ? Math.round(Number(maxRaw)) : null
  if (maxUses !== null && (!Number.isFinite(maxUses) || maxUses < 1)) return { error: 'Numărul maxim de utilizări este cel puțin 1.' }
  const ok = await promoCodes.create(await getDb(), {
    code,
    kind,
    value,
    products: chosen.length && chosen.length < products.length ? chosen : null,
    minOrderMinor: Math.round(min * 100),
    startsAt,
    endsAt,
    maxUses,
    oncePerEmail: f.get('once') === 'da',
    note: text(f, 'note', 200) || null,
  })
  if (!ok) return { error: `Codul ${code} există deja.` }
  log.info('admin.promo_created', { code })
  revalidatePath('/admin/coduri')
  return { created: code }
}

export async function togglePromoAction(f: FormData) {
  await guard()
  const code = normalizeCode(text(f, 'code', 40))
  const active = text(f, 'active') === 'true'
  await promoCodes.setActive(await getDb(), code, active)
  log.info('admin.promo_toggled', { code, active })
  revalidatePath('/admin/coduri')
}


// ─── store settings and API keys (/admin/setari) ─────────────────────────────

export type SettingsFormState = { error?: string; problems?: string[]; saved?: boolean }

const adminActor = () => `admin:${process.env.ADMIN_USER || 'admin'}`

/**
 * Prices (lei, per product; empty = the code's price), stock, the website popup and the AI calls pause. A price
 * change needs the ticked confirmation; every change is validated and kept in the admin log.
 */
export async function saveSettingsAction(_: SettingsFormState, f: FormData): Promise<SettingsFormState> {
  await guard()
  const db = await getDb()
  const now = await readStoreSettings(db)
  const prices: StoreSettings['prices'] = {}
  for (const p of products) {
    const raw = text(f, `price:${p.id}`, 20).replace(/\s/g, '')
    if (!raw) continue
    const value = Number(raw.replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(value)) return { error: `${p.name}: prețul nu este un număr.` }
    prices[p.id] = Math.round(value * 100)
  }
  const next: StoreSettings = {
    prices,
    soldOut: products.filter((p) => f.get(`soldOut:${p.id}`) === 'da').map((p) => p.id),
    welcomePopup: f.get('welcomePopup') === 'da',
    callsPaused: f.get('callsPaused') === 'da',
  }
  if (JSON.stringify(next.prices) !== JSON.stringify(now.prices) && f.get('confirmPrices') !== 'da')
    return { error: 'Ai schimbat un preț: bifează confirmarea de sub prețuri ca să salvezi.' }
  const r = await saveStoreSettings(db, next, adminActor())
  if (!r.ok) return { problems: r.problems.map((x) => x.message) }
  log.info('admin.settings_saved', { prices: Object.keys(next.prices).length, soldOut: next.soldOut.length })
  revalidatePath('/', 'layout')
  await runDueJobs()
  return { saved: true }
}

export type KeyFormState = { error?: string; token?: string; name?: string }

export async function createKeyAction(_: KeyFormState, f: FormData): Promise<KeyFormState> {
  await guard()
  const name = text(f, 'name', 60)
  if (name.length < 2) return { error: 'Dă-i cheii un nume (de exemplu „Grok”).' }
  const scope = f.get('scope') === 'full' ? 'full' : 'read'
  const db = await getDb()
  const k = await adminKeys.create(db, name, scope)
  await audit(db, adminActor(), 'api_key.create', { id: k.id, name, scope, prefix: k.prefix })
  revalidatePath('/admin/setari')
  return { token: k.token, name }
}

export async function revokeKeyAction(f: FormData) {
  await guard()
  const id = text(f, 'id', 40)
  const db = await getDb()
  if (await adminKeys.revoke(db, id)) await audit(db, adminActor(), 'api_key.revoke', { id })
  revalidatePath('/admin/setari')
}
