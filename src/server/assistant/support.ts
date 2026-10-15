/**
 * Support requests: what the website assistant hands to a person (a cancellation it may not do itself, a return,
 * a delivery problem, a question it could not answer, "I want to talk to someone"). One row per request, shown in
 * /admin/suport; the team hears about each new one by email (orders@, through the outbox, once per request).
 *
 * The same request is never recorded twice: the same category for the same order (or the same email when there is
 * no verified order) within 24 hours returns the request already open. Only what the customer chose to give is
 * kept: the verified order, the contact they typed, a short summary in their words.
 */
import 'server-only'
import { randomBytes, randomUUID } from 'node:crypto'
import type { Queryable } from '@/server/db'
import { jobs } from '@/server/jobs/outbox'

export const SUPPORT_CATEGORIES = {
  cancellation: 'Anulare',
  return: 'Retur',
  delivery: 'Problemă la livrare',
  product: 'Întrebare despre produs',
  payment: 'Problemă la plată',
  other: 'Altceva',
} as const
export type SupportCategory = keyof typeof SUPPORT_CATEGORIES
export const isSupportCategory = (c: unknown): c is SupportCategory => typeof c === 'string' && Object.prototype.hasOwnProperty.call(SUPPORT_CATEGORIES, c)

export const SUPPORT_STATUS = { open: 'Deschisă', in_progress: 'În lucru', resolved: 'Rezolvată' } as const
export type SupportStatus = keyof typeof SUPPORT_STATUS
export const isSupportStatus = (s: unknown): s is SupportStatus => typeof s === 'string' && Object.prototype.hasOwnProperty.call(SUPPORT_STATUS, s)

export type SupportRequest = {
  id: string
  ref: string
  category: SupportCategory
  summary: string
  status: SupportStatus
  urgent: boolean
  orderId: string | null
  orderNumber: string | null
  email: string | null
  name: string | null
  phone: string | null
  source: string
  resolutionNotes: string | null
  createdAt: Date
  updatedAt: Date
  resolvedAt: Date | null
}

const toRequest = (r: Record<string, unknown>): SupportRequest => ({
  id: r.id as string,
  ref: r.ref as string,
  category: (isSupportCategory(r.category) ? r.category : 'other') as SupportCategory,
  summary: r.summary as string,
  status: (isSupportStatus(r.status) ? r.status : 'open') as SupportStatus,
  urgent: !!r.urgent,
  orderId: (r.order_id as string) ?? null,
  orderNumber: (r.order_number as string) ?? null,
  email: (r.email as string) ?? null,
  name: (r.name as string) ?? null,
  phone: (r.phone as string) ?? null,
  source: r.source as string,
  resolutionNotes: (r.resolution_notes as string) ?? null,
  createdAt: new Date(r.created_at as string),
  updatedAt: new Date(r.updated_at as string),
  resolvedAt: r.resolved_at ? new Date(r.resolved_at as string) : null,
})

/** A short reference the customer can quote: S-7KQ2M9 (no 0/O/1/I). */
function newRef() {
  const abc = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  return `S-${[...randomBytes(6)].map((b) => abc[b % abc.length]).join('')}`
}

const SELECT = `select s.*, o.order_number from support_requests s left join orders o on o.id = s.order_id`
const clip = (s: string | null | undefined, n: number) => (s ? s.replace(/\s+/g, ' ').trim().slice(0, n) || null : null)

export type NewSupportRequest = {
  category: SupportCategory
  summary: string
  orderId?: string | null
  email?: string | null
  name?: string | null
  phone?: string | null
  urgent?: boolean
  source?: string
  /** Recorded as already resolved (a cancellation the assistant did itself): the team is told, nothing to do. */
  resolved?: { notes: string }
}

export const supportRequests = {
  /** Creates the request, or returns the one already open for the same thing in the last 24 hours. */
  async create(q: Queryable, x: NewSupportRequest, notify: boolean): Promise<{ request: SupportRequest; created: boolean }> {
    const email = clip(x.email?.toLowerCase(), 200)
    const subject = x.orderId ?? email
    const dedupeKey = subject ? `${x.category}:${subject}` : null
    if (dedupeKey && !x.resolved) {
      const { rows } = await q.query(`${SELECT} where s.dedupe_key = $1 and s.status <> 'resolved' and s.created_at > now() - interval '24 hours' order by s.created_at desc limit 1`, [dedupeKey])
      if (rows[0]) return { request: toRequest(rows[0]), created: false }
    }
    const id = randomUUID()
    await q.query(
      `insert into support_requests (id, ref, category, summary, status, urgent, order_id, email, name, phone, dedupe_key, source, resolution_notes, resolved_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        id,
        newRef(),
        x.category,
        clip(x.summary, 1000) ?? '(fără rezumat)',
        x.resolved ? 'resolved' : 'open',
        !!x.urgent,
        x.orderId ?? null,
        email,
        clip(x.name, 120),
        clip(x.phone, 40),
        dedupeKey,
        x.source ?? 'assistant',
        x.resolved ? clip(x.resolved.notes, 1000) : null,
        x.resolved ? new Date() : null,
      ],
    )
    if (notify) await jobs.enqueue(q, { kind: 'support.notify', orderId: x.orderId ?? undefined, dedupeKey: `support.notify:${id}`, payload: { id } })
    return { request: (await supportRequests.byId(q, id))!, created: true }
  },

  async byId(q: Queryable, id: string) {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null
    const { rows } = await q.query(`${SELECT} where s.id = $1`, [id])
    return rows[0] ? toRequest(rows[0]) : null
  },

  async list(q: Queryable, opts: { filter?: 'open' | 'urgent' | 'orders' | 'resolved' | 'all'; limit?: number } = {}) {
    const where = {
      open: `s.status <> 'resolved'`,
      urgent: `s.status <> 'resolved' and s.urgent`,
      orders: `s.order_id is not null`,
      resolved: `s.status = 'resolved'`,
      all: 'true',
    }[opts.filter ?? 'open']
    const { rows } = await q.query(`${SELECT} where ${where} order by s.urgent desc, s.created_at desc limit $1`, [Math.min(500, opts.limit ?? 200)])
    return rows.map(toRequest)
  },

  async counts(q: Queryable) {
    const { rows } = await q.query<{ open: string; urgent: string; orders: string }>(
      `select count(*) filter (where status <> 'resolved') as open,
              count(*) filter (where status <> 'resolved' and urgent) as urgent,
              count(*) filter (where status <> 'resolved' and order_id is not null) as orders
       from support_requests`,
    )
    return { open: Number(rows[0]?.open ?? 0), urgent: Number(rows[0]?.urgent ?? 0), orders: Number(rows[0]?.orders ?? 0) }
  },

  /** The operator's change: status, urgency and resolution notes (all optional). */
  async update(q: Queryable, id: string, patch: { status?: SupportStatus; urgent?: boolean; notes?: string | null }) {
    const cur = await supportRequests.byId(q, id)
    if (!cur) return null
    const status = patch.status ?? cur.status
    await q.query(
      `update support_requests set status = $2, urgent = $3, resolution_notes = $4, updated_at = now(),
         resolved_at = case when $2 = 'resolved' then coalesce(resolved_at, now()) else null end where id = $1`,
      [id, status, patch.urgent ?? cur.urgent, patch.notes === undefined ? cur.resolutionNotes : clip(patch.notes, 2000)],
    )
    return supportRequests.byId(q, id)
  },

  /** Requests about one order (shown on the order's admin page). */
  async forOrder(q: Queryable, orderId: string) {
    const { rows } = await q.query(`${SELECT} where s.order_id = $1 order by s.created_at desc`, [orderId])
    return rows.map(toRequest)
  },
}

/** The team's email for a new request: what was asked and where to answer it. Contact data stays in /admin. */
export function renderSupportNotice(r: SupportRequest, adminUrl: string) {
  const subject = `${r.urgent ? '[URGENT] ' : ''}Cerere de suport ${r.ref}: ${SUPPORT_CATEGORIES[r.category]}${r.orderNumber ? ` (${r.orderNumber})` : ''}`
  const lines = [
    r.status === 'resolved' ? 'Asistentul site-ului a rezolvat singur cererea (de reținut, nimic de făcut):' : 'Un client are nevoie de un coleg (prin asistentul site-ului).',
    '',
    `Categorie: ${SUPPORT_CATEGORIES[r.category]}`,
    ...(r.orderNumber ? [`Comanda: ${r.orderNumber} (emailul verificat cu cod)`] : []),
    `Rezumat: ${r.summary}`,
    ...(r.resolutionNotes ? [`Rezolvare: ${r.resolutionNotes}`] : []),
    '',
    `Detalii și contact: ${adminUrl}`,
  ]
  const text = lines.join('\n')
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return { subject, text, html: `<pre style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;white-space:pre-wrap">${esc(text)}</pre>` }
}
