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
import { audit, ensureStoreSettings, readStoreSettings, saveStoreSettings, type StoreSettings } from '@/server/store-settings'
import { callBlocklist } from '@/server/calling/blocklist'
import { placeTestCall } from '@/server/calling/test-call'
import { enquiries, type EnquiryStatus } from '@/server/enquiries'
import { replies } from '@/server/replies'
import { imapSource, syncInbox } from '@/server/inbox'
import { APP_PASSWORD_MIN, appUsers } from '@/server/app/auth'
import { deliverPush } from '@/server/app/push'
import { redirect } from 'next/navigation'
import { isSupportStatus, supportRequests } from '@/server/assistant/support'
import { isChatSound, type ChatSound } from '@/lib/chat-sounds'
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
/** Back to a page with a short message (?mesaj=…) the page shows once. */
const redirectWith = (path: string, message: string): never => redirect(`${path}?mesaj=${encodeURIComponent(message.slice(0, 200))}`)
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
  revalidatePath(`/admin/mesaje/${id}`)
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
    assistant: f.get('assistant') === 'da',
    chatSound: isChatSound(f.get('chatSound')) ? (f.get('chatSound') as ChatSound) : now.chatSound,
    fx: now.fx,
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

// ─── AI calls: do-not-call list and test calls (/admin/apeluri) ─────────────

export async function addBlockAction(f: FormData) {
  await guard()
  const db = await getDb()
  const phone = await callBlocklist.add(db, text(f, 'phone', 30), text(f, 'note', 120) || null, adminActor())
  if (phone) await audit(db, adminActor(), 'call_blocklist.add', { phone })
  revalidatePath('/admin/apeluri')
}

export async function removeBlockAction(f: FormData) {
  await guard()
  const db = await getDb()
  const phone = text(f, 'phone', 30)
  if (await callBlocklist.remove(db, phone)) await audit(db, adminActor(), 'call_blocklist.remove', { phone })
  revalidatePath('/admin/apeluri')
}

export type TestCallState = { error?: string; placed?: string }

/** One test call with an imaginary order; needs the ticked confirmation that the person agreed to it. */
export async function testCallAction(_: TestCallState, f: FormData): Promise<TestCallState> {
  await guard()
  if (f.get('consent') !== 'da') return { error: 'Bifează că persoana a acceptat apelul de test.' }
  const items = products.flatMap((p) => {
    const quantity = Math.min(10, Math.max(0, Math.round(Number(text(f, `qty:${p.id}`, 3)) || 0)))
    const variantId = text(f, `variant:${p.id}`, 40) || p.variants?.[0]?.id
    return quantity ? [{ productId: p.id, variantId, quantity }] : []
  })
  const scenario = f.get('scenario') === 'price_reveal' ? 'price_reveal' : 'cart'
  const db = await getDb()
  await ensureStoreSettings(0)
  const r = await placeTestCall(
    db,
    getConfig(),
    {
      phone: text(f, 'phone', 30),
      firstName: text(f, 'firstName', 40),
      scenario,
      funnel: f.get('funnel') === 'gated_price' ? 'gated_price' : 'visible_price',
      // The price form is about one product: the first one chosen.
      items: scenario === 'price_reveal' ? items.slice(0, 1).map((i) => ({ ...i, quantity: 1 })) : items,
      emailSent: f.get('emailSent') === 'da',
    },
    adminActor(),
  )
  if (!r.ok) return { error: r.message }
  await audit(db, adminActor(), 'test_call.place', { id: r.call.id, phone: r.call.phone, status: r.call.status })
  revalidatePath('/admin/apeluri')
  return r.call.status === 'failed' ? { error: `Apelul nu a pornit: ${r.call.error}` } : { placed: r.call.phone }
}

/** A support request from the website assistant: status, urgency and resolution notes (each change audited). */
/**
 * A reply to a customer from Mesaje or Suport: stored with the conversation, emailed from our own mailbox, and
 * the conversation moves to "în lucru" (or "rezolvat", when ticked).
 */
export async function replyAction(f: FormData) {
  await guard()
  const kind = text(f, 'kind', 10)
  const id = text(f, 'id', 40)
  if (kind !== 'enquiry' && kind !== 'support') return
  const db = await getDb()
  const r = await replies.create(db, { kind, threadId: id, body: String(f.get('body') ?? ''), actor: adminActor() })
  log.info('admin.action', { thread: `${kind}:${id}`, action: 'reply', ok: r.ok, ...(!r.ok && { reason: r.reason }) })
  if (!r.ok) return
  await audit(db, adminActor(), 'customer.reply', { kind, id, replyId: r.id })
  const resolve = f.get('resolve') === 'da'
  if (kind === 'enquiry') await enquiries.setStatus(id, resolve ? 'resolved' : 'in_progress')
  else await supportRequests.update(db, id, { status: resolve ? 'resolved' : 'in_progress' })
  await runDueJobs()
  revalidatePath(kind === 'enquiry' ? '/admin/mesaje' : '/admin/suport')
  revalidatePath(kind === 'enquiry' ? `/admin/mesaje/${id}` : `/admin/suport/${id}`)
}

/** A contact-form conversation marked urgent (or not): it shows under "Urgente". */
export async function enquiryUrgentAction(f: FormData) {
  await guard()
  const id = text(f, 'id', 40)
  const changed = await enquiries.setUrgent(id, f.get('urgent') === 'da')
  log.info('admin.action', { enquiryId: id, action: 'enquiry_urgent', changed })
  revalidatePath('/admin/mesaje')
  revalidatePath(`/admin/mesaje/${id}`)
}

/** The iOS app's accounts (at most two): created here with their password, never shown again. */
export async function appUserCreateAction(f: FormData) {
  await guard()
  const db = await getDb()
  const r = await appUsers.create(db, { email: text(f, 'email', 160), name: text(f, 'name', 80), password: String(f.get('password') ?? '').slice(0, 200) })
  if (r.ok) await audit(db, adminActor(), 'app_user.create', { id: r.id, email: text(f, 'email', 160) })
  log.info('admin.action', { action: 'app_user_create', ok: r.ok })
  revalidatePath('/admin/aplicatie')
  if (!r.ok) redirectWith('/admin/aplicatie', r.reason)
}

export async function appUserPasswordAction(f: FormData) {
  await guard()
  const db = await getDb()
  const id = text(f, 'id', 40)
  const ok = /^[0-9a-f-]{36}$/i.test(id) && (await appUsers.setPassword(db, id, String(f.get('password') ?? '').slice(0, 200)))
  if (ok) await audit(db, adminActor(), 'app_user.password', { id })
  revalidatePath('/admin/aplicatie')
  if (!ok) redirectWith('/admin/aplicatie', `Parola trebuie să aibă cel puțin ${APP_PASSWORD_MIN} caractere.`)
}

export async function appUserActiveAction(f: FormData) {
  await guard()
  const db = await getDb()
  const id = text(f, 'id', 40)
  if (/^[0-9a-f-]{36}$/i.test(id) && (await appUsers.setActive(db, id, f.get('active') === 'da'))) await audit(db, adminActor(), 'app_user.active', { id, active: f.get('active') === 'da' })
  revalidatePath('/admin/aplicatie')
}

/** A sample payment notification (KA-CHING) to every registered iPhone: checks APNs, the sound and the devices. */
export async function appPushTestAction() {
  await guard()
  const c = getConfig()
  if (!c.apns) return redirectWith('/admin/aplicatie', 'APNs nu este configurat (APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_PRIVATE_KEY).')
  const db = await getDb()
  const sample = { id: '00000000-0000-0000-0000-000000000000', orderNumber: 'TEST', totalMinor: 123400, currency: 'RON', paymentMethod: 'card', kind: 'checkout', status: 'confirmed', paymentStatus: 'paid' } as never
  let note: string
  try {
    note = await deliverPush(db, c.apns, `push:test:${Date.now()}`, 'payment', sample)
  } catch (e) {
    note = e instanceof Error ? e.message : String(e)
  }
  log.info('admin.action', { action: 'app_push_test', note })
  redirectWith('/admin/aplicatie', `Notificare de test: ${note}.`)
}

/** Reads the mailbox now (the cron does it every few minutes). */
export async function syncInboxAction() {
  await guard()
  const imap = getConfig().email.imap
  if (!imap) return
  const r = await syncInbox(await getDb(), imapSource(imap), { deadline: Date.now() + 20_000 })
  log.info('admin.action', { action: 'inbox_sync', imported: r.imported, ignored: r.ignored, ok: !r.error })
  revalidatePath('/admin/mesaje')
  revalidatePath('/admin/suport')
}

export async function supportAction(f: FormData) {
  await guard()
  const id = text(f, 'id', 40)
  const status = text(f, 'status', 20)
  const notes = f.get('notes')
  const urgent = f.get('urgent')
  const db = await getDb()
  const r = await supportRequests.update(db, id, {
    ...(isSupportStatus(status) && { status }),
    ...(urgent === 'da' || urgent === 'nu' ? { urgent: urgent === 'da' } : {}),
    ...(typeof notes === 'string' && { notes: notes.slice(0, 2000) }),
  })
  if (r) await audit(db, adminActor(), 'support.update', { id, ref: r.ref, status: r.status, urgent: r.urgent })
  log.info('admin.action', { supportId: id, action: `support_${status || 'notes'}`, changed: !!r })
  revalidatePath('/admin/suport')
}
