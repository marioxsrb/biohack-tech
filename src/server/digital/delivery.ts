/**
 * Delivering the book's PDF: the email job (automatic after a grant, or asked for by a person), the order page's
 * state, and the admin's operations. Every path asks `digitalAccess` again at the moment it acts, so a link, an email
 * or a button never outlives a cancellation or a refund, and every manual action is audited (digital_events +
 * admin_audit). The email goes through the shared outbox (job `digital.email`): retried on temporary failures,
 * listed in /admin when it keeps failing, and never sent twice for the same reason (dedupe key per send).
 */
import 'server-only'
import { getProduct, BOOK_ID } from '@/content/catalog'
import { getConfig, type Config } from '@/server/config'
import { getDb, type Queryable } from '@/server/db'
import { deliver } from '@/server/integrations/email/transport'
import { orderPageUrl } from '@/server/integrations/email/templates'
import { jobs, type NewJob } from '@/server/jobs/outbox'
import type { Order } from '@/server/orders/model'
import { orders } from '@/server/orders/repository'
import { audit } from '@/server/store-settings'
import { siteOrigin } from '@/lib/sites'
import { renderDigitalEmail } from './email'
import { entitlements, type Entitlement } from './entitlements'
import { createLink, downloadUrl, type LinkChannel } from './links'
import { blockText, digitalAccess, hasBook, type DigitalBlock } from './rules'

export class DigitalSkip extends Error {}
export class DigitalPermanent extends Error {}

/** A person may send again without confirming only after this long (a double click never sends twice). */
export const RESEND_COOLDOWN_MINUTES = 10

/** The automatic email after a grant: one per order, whatever replays upstream. */
export const autoEmailJob = (orderId: string): NewJob => ({ kind: 'digital.email', orderId, dedupeKey: `digital.email:${orderId}:auto`, payload: { mode: 'auto' } })

/** Why the PDF cannot go to this order now (null: it can). */
export function blockFor(o: Order, e: Entitlement | null, c: Config = getConfig()): { reason: DigitalBlock | 'revoked' | 'not_configured'; text: string } | null {
  const d = digitalAccess(o)
  if (!d.ok) return { reason: d.reason, text: blockText(d.reason, o) }
  if (e?.status === 'revoked') return { reason: 'revoked', text: blockText('revoked') }
  if (!c.digital) return { reason: 'not_configured', text: blockText('not_configured') }
  return null
}

/** A fresh signed link for an active entitlement. */
export function linkFor(c: Config, o: Order, e: Entitlement, channel: LinkChannel) {
  const { token, expiresAt } = createLink(c.digital!.linkSecret, { entitlementId: e.id, version: e.linkVersion, channel })
  return { url: downloadUrl(siteOrigin(o.site, c.siteUrl), token), expiresAt }
}

/** The cover for the email, through the site's image service (absolute URL), or null outside a Next build. */
function coverUrl(origin: string) {
  const img = getProduct(BOOK_ID)?.cutout ?? null
  const src = img ? (typeof img.src === 'string' ? (img.src as string) : img.src.src) : null
  return src?.startsWith('/') ? `${origin}/_next/image?url=${encodeURIComponent(src)}&w=256&q=80` : null
}

/** The email with a link, for sending or for the admin's preview (a placeholder link). */
export function digitalEmailFor(c: Config, o: Order, link: { url: string; expiresAt: Date }) {
  const origin = siteOrigin(o.site, c.siteUrl)
  return renderDigitalEmail({ order: o, link: link.url, orderUrl: orderPageUrl(o, c.siteUrl), coverUrl: coverUrl(origin), siteUrl: origin, expiresAt: link.expiresAt })
}

/** The `digital.email` job: checks everything again, sends, records. */
export async function runDigitalEmail(job: { orderId: string | null; dedupeKey: string; payload: Record<string, unknown> }) {
  const c = getConfig()
  const db = await getDb()
  const o = job.orderId ? await orders.byId(db, job.orderId) : null
  if (!o) throw new DigitalSkip('order gone')
  const e = await entitlements.byOrder(db, o.id)
  if (!e) throw new DigitalSkip('no entitlement')
  const mode = job.payload.mode === 'manual' ? 'manual' : 'auto'
  const by = String(job.payload.by ?? 'system')
  const block = blockFor(o, e, c)
  if (block) {
    await entitlements.event(db, { entitlementId: e.id, orderId: o.id, type: 'email.blocked', actor: by, details: { mode, reason: block.reason } })
    if (block.reason === 'not_configured') {
      await entitlements.update(db, e.id, { email_status: 'failed', last_attempt_at: new Date(), last_error: block.text })
      throw new DigitalPermanent(block.text)
    }
    throw new DigitalSkip(block.text)
  }
  if (c.email.transport === 'none') {
    await entitlements.update(db, e.id, { email_status: 'failed', last_attempt_at: new Date(), last_error: 'EMAIL_TRANSPORT=none' })
    throw new DigitalPermanent('emailurile sunt oprite (EMAIL_TRANSPORT=none)')
  }
  const link = linkFor(c, o, e, 'e')
  const mail = digitalEmailFor(c, o, link)
  await entitlements.update(db, e.id, { last_attempt_at: new Date() })
  try {
    const ref = await deliver(c, { ...mail, name: `${o.orderNumber}-carte-pdf-${job.dedupeKey.split(':').pop()}`, to: o.email, ghlContactId: o.ghlContactId })
    await db.tx(async (t) => {
      await t.query(
        `update digital_entitlements set email_status = 'sent', emails_sent = emails_sent + 1, email_sent_at = now(), last_error = null, updated_at = now() where id = $1`,
        [e.id],
      )
      await entitlements.event(t, { entitlementId: e.id, orderId: o.id, type: 'email.sent', actor: by, details: { mode, ref, expiresAt: link.expiresAt.toISOString() } })
      await orders.event(t, o.id, 'digital.email_sent', 'system', { mode, by })
      // The CRM shows that the PDF went out (tag), on the order's own sync job.
      if (c.ghl) await jobs.enqueue(t, { kind: 'ghl.sync', orderId: o.id, dedupeKey: `ghl.sync:${o.id}:digital.email:${e.emailsSent + 1}` })
    })
    return ref
  } catch (err) {
    await entitlements.update(db, e.id, { email_status: 'failed', last_error: (err instanceof Error ? err.message : String(err)).slice(0, 300) })
    await entitlements.event(db, { entitlementId: e.id, orderId: o.id, type: 'email.failed', actor: by, details: { mode, error: (err instanceof Error ? err.message : String(err)).slice(0, 200) } })
    throw err
  }
}

/** What the order page shows about the PDF. Read-only: it never grants anything. */
export type PageDigital =
  | { state: 'ready'; url: string }
  | { state: 'confirming' }
  | { state: 'after_transfer' }
  | { state: 'after_delivery' }
  | { state: 'by_email' }
  | { state: 'closed' }

export async function pageDigital(q: Queryable, o: Order, c: Config = getConfig()): Promise<PageDigital | null> {
  if (!hasBook(o)) return null
  const e = await entitlements.byOrder(q, o.id)
  const d = digitalAccess(o)
  if (d.ok) {
    if (e?.status === 'revoked') return { state: 'closed' }
    if (e && c.digital) return { state: 'ready', url: linkFor(c, o, e, 'p').url }
    // Paid a moment ago and the grant is in the same transaction: only a missing configuration lands here.
    return { state: 'by_email' }
  }
  if (d.reason === 'cancelled' || d.reason === 'refunded') return { state: 'closed' }
  if (o.paymentMethod === 'cash_on_delivery') return { state: 'after_delivery' }
  if (o.paymentMethod === 'bank_transfer') return { state: 'after_transfer' }
  // A card payment Stripe has not confirmed yet (the webhook can take a few seconds).
  return o.paymentStatus === 'pending' && o.stripePaymentIntentId ? { state: 'confirming' } : null
}

type AdminResult = { ok: true; message: string; url?: string } | { ok: false; message: string }

/**
 * A person sends (or resends) the PDF email. Entitlement first (granted here if the order earns it but has none, e.g.
 * an order from before the switch), never for a blocked order; a send within RESEND_COOLDOWN_MINUTES of the last one,
 * or while one is on its way, needs an explicit confirmation. Audited twice (digital_events, admin_audit).
 */
export async function adminSendDigital(orderId: string, actor: string, confirmed: boolean): Promise<AdminResult> {
  const c = getConfig()
  const db = await getDb()
  return db.tx(async (t) => {
    const o = await orders.byId(t, orderId, true)
    if (!o) return { ok: false, message: 'Comanda nu există.' }
    let e = await entitlements.byOrder(t, o.id, true)
    const block = blockFor(o, e, c)
    if (block) {
      await entitlements.event(t, { entitlementId: e?.id ?? null, orderId: o.id, type: 'email.manual_refused', actor, details: { reason: block.reason } })
      return { ok: false, message: block.text }
    }
    if (!e) {
      e = (await entitlements.grant(t, o, 'admin', actor)).entitlement
      await orders.event(t, o.id, 'digital.granted', 'admin', { by: actor })
    }
    const pending = await t.query("select 1 from jobs where kind = 'digital.email' and order_id = $1 and status in ('pending', 'running', 'retry') limit 1", [o.id])
    if (pending.rows.length) return { ok: false, message: 'Un email cu PDF-ul este deja în curs de trimitere pentru această comandă.' }
    const recent = e.emailSentAt && Date.now() - e.emailSentAt.getTime() < RESEND_COOLDOWN_MINUTES * 60_000
    if (recent && !confirmed) {
      const mins = Math.max(1, Math.round((Date.now() - e.emailSentAt!.getTime()) / 60_000))
      return { ok: false, message: `Emailul a fost trimis acum ${mins} min. Bifează „Confirm retrimiterea” dacă vrei să-l trimiți din nou.` }
    }
    const n = e.manualSends + 1
    await t.query("update digital_entitlements set manual_sends = $2, email_status = 'queued', updated_at = now() where id = $1", [e.id, n])
    await jobs.enqueue(t, { kind: 'digital.email', orderId: o.id, dedupeKey: `digital.email:${o.id}:manual:${n}`, payload: { mode: 'manual', by: actor } })
    await entitlements.event(t, { entitlementId: e.id, orderId: o.id, type: 'email.manual_requested', actor, details: { n, resend: e.emailsSent > 0 } })
    await audit(t, actor, e.emailsSent > 0 ? 'digital.email_resend' : 'digital.email_send', { orderId: o.id, orderNumber: o.orderNumber, n })
    return { ok: true, message: e.emailsSent > 0 ? 'Retrimiterea a fost programată. Pleacă în câteva secunde.' : 'Emailul a fost programat. Pleacă în câteva secunde.' }
  })
}

/** A fresh 7-day link for a person to give the customer (audited); refused for a blocked order. */
export async function adminCopyLink(orderId: string, actor: string): Promise<AdminResult> {
  const c = getConfig()
  const db = await getDb()
  return db.tx(async (t) => {
    const o = await orders.byId(t, orderId, true)
    if (!o) return { ok: false, message: 'Comanda nu există.' }
    let e = await entitlements.byOrder(t, o.id, true)
    const block = blockFor(o, e, c)
    if (block) return { ok: false, message: block.text }
    if (!e) e = (await entitlements.grant(t, o, 'admin', actor)).entitlement
    const link = linkFor(c, o, e, 'a')
    await entitlements.event(t, { entitlementId: e.id, orderId: o.id, type: 'link.copied', actor, details: { expiresAt: link.expiresAt.toISOString() } })
    await audit(t, actor, 'digital.link_copied', { orderId: o.id, orderNumber: o.orderNumber })
    return { ok: true, message: 'Link nou, valabil 7 zile.', url: link.url }
  })
}

/** Stops access at once (every link given so far dies) or gives it back (with new links). Audited. */
export async function adminSetAccess(orderId: string, actor: string, action: 'revoke' | 'restore', reason: string): Promise<AdminResult> {
  const db = await getDb()
  return db.tx(async (t) => {
    const o = await orders.byId(t, orderId, true)
    if (!o) return { ok: false, message: 'Comanda nu există.' }
    const e = await entitlements.byOrder(t, o.id, true)
    if (!e) return { ok: false, message: 'Comanda nu are încă acces la PDF.' }
    if (action === 'revoke') {
      if (!(await entitlements.revoke(t, e, reason || 'revocat manual', actor))) return { ok: false, message: 'Accesul era deja revocat.' }
      await orders.event(t, o.id, 'digital.revoked', 'admin', { by: actor, reason })
      await audit(t, actor, 'digital.revoke', { orderId: o.id, orderNumber: o.orderNumber, reason })
      return { ok: true, message: 'Accesul a fost revocat. Linkurile trimise nu mai funcționează.' }
    }
    if (e.status === 'active') return { ok: false, message: 'Accesul este deja activ.' }
    const d = digitalAccess(o)
    if (!d.ok) return { ok: false, message: blockText(d.reason, o) }
    await entitlements.update(t, e.id, { status: 'active', revoked_at: null, revoke_reason: null, link_version: e.linkVersion + 1 })
    await entitlements.event(t, { entitlementId: e.id, orderId: o.id, type: 'restored', actor, details: { reason } })
    await audit(t, actor, 'digital.restore', { orderId: o.id, orderNumber: o.orderNumber, reason })
    return { ok: true, message: 'Accesul a fost redat. Trimite un email nou ca clientul să primească un link valid.' }
  })
}

/** The orders with the book, newest first, with their entitlement and the last digital job (admin list). */
export async function bookOrders(q: Queryable, limit = 200) {
  const { rows } = await q.query<{ id: string }>(
    `select o.id from orders o where exists (select 1 from order_items i where i.order_id = o.id and i.product_id = $1)
     and not (o.payment_method = 'card' and o.status in ('pending', 'abandoned') and o.payment_status <> 'paid')
     order by o.created_at desc limit $2`,
    [BOOK_ID, limit],
  )
  const list = (await Promise.all(rows.map((r) => orders.byId(q, r.id)))).filter((o): o is Order => !!o)
  const ents = await entitlements.forOrders(q, list.map((o) => o.id))
  const failing = await q.query<{ order_id: string; status: string; last_error: string | null; updated_at: string }>(
    "select distinct on (order_id) order_id, status, last_error, updated_at from jobs where kind = 'digital.email' and order_id = any($1::uuid[]) order by order_id, id desc",
    [list.map((o) => o.id)],
  )
  const lastJob = new Map(failing.rows.map((r) => [r.order_id, { status: r.status, lastError: r.last_error, at: new Date(r.updated_at) }]))
  return list.map((o) => ({ order: o, entitlement: ents.get(o.id) ?? null, lastJob: lastJob.get(o.id) ?? null }))
}

/**
 * The PDF's state for a verified order, for the website assistant: where it stands, never a link (the customer gets
 * links only on the order page and by email).
 */
export async function digitalNote(q: Queryable, o: Order): Promise<{ digitalBook?: string }> {
  if (!hasBook(o)) return {}
  const e = await entitlements.byOrder(q, o.id)
  const block = blockFor(o, e)
  if (!block && e)
    return {
      digitalBook:
        e.emailStatus === 'sent'
          ? `PDF-ul este disponibil: linkul a fost trimis pe email${e.emailSentAt ? ` (${e.emailSentAt.toLocaleDateString('ro-RO', { timeZone: 'Europe/Bucharest' })})` : ''} și se poate lua oricând din pagina comenzii (linkurile expiră; pagina dă unul nou).`
          : 'PDF-ul este disponibil în pagina comenzii; emailul cu linkul este pe drum.',
    }
  if (!block) return { digitalBook: 'PDF-ul se pregătește; linkul vine pe email.' }
  const why: Record<string, string> = {
    not_paid: o.paymentMethod === 'bank_transfer' ? 'PDF-ul se trimite pe email după ce primim transferul.' : 'PDF-ul este disponibil după ce plata cu cardul este confirmată.',
    awaiting_delivery: 'PDF-ul se trimite pe email după livrarea coletului (ramburs).',
    cancelled: 'Comanda este anulată: PDF-ul nu mai este disponibil.',
    refunded: 'Comanda este rambursată: PDF-ul nu mai este disponibil.',
    revoked: 'Accesul la PDF a fost oprit; echipa poate ajuta (cerere de suport).',
    not_configured: 'PDF-ul vine pe email; dacă întârzie, deschide o cerere de suport.',
  }
  return { digitalBook: why[block.reason] ?? 'Pentru PDF, deschide o cerere de suport.' }
}
