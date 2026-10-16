/**
 * Replies to customers from /admin: a contact-form message (Mesaje) or a chat support request (Suport). The
 * reply is stored with the conversation and sent by email from our own mailbox through the outbox (retried,
 * failures visible in the thread); the customer's answer comes back to contact@ like any email. A service
 * message the customer asked for, so no marketing consent is needed and no unsubscribe link is added.
 */
import 'server-only'
import { randomUUID } from 'node:crypto'
import { ENQUIRY_TOPICS, type EnquiryTopic } from '@/lib/enquiry'
import type { Queryable } from '@/server/db'
import { emailShell, esc } from '@/server/integrations/email/shell'
import { jobs } from '@/server/jobs/outbox'

export type ThreadKind = 'enquiry' | 'support'
export type Reply = { id: string; body: string; toEmail: string; status: 'pending' | 'sent' | 'failed'; error: string | null; createdBy: string; createdAt: Date; sentAt: Date | null }

const toReply = (r: Record<string, unknown>): Reply => ({
  id: r.id as string,
  body: r.body as string,
  toEmail: r.to_email as string,
  status: r.status as Reply['status'],
  error: (r.error as string) ?? null,
  createdBy: r.created_by as string,
  createdAt: new Date(r.created_at as string),
  sentAt: r.sent_at ? new Date(r.sent_at as string) : null,
})

export const REPLY_MAX = 5000
const UUID_RE = /^[0-9a-f-]{36}$/i

/** The conversation's customer and what they wrote, from the message or the support request. */
async function thread(q: Queryable, kind: ThreadKind, id: string) {
  if (kind === 'enquiry') {
    const { rows } = await q.query<{ name: string; email: string; reference: string; topic: string; message: string }>('select name, email, reference, topic, message from enquiries where id = $1', [id])
    const e = rows[0]
    return e ? { name: e.name, email: e.email, ref: e.reference, about: ENQUIRY_TOPICS[e.topic as EnquiryTopic] ?? 'mesajul tău', original: e.message } : null
  }
  const { rows } = await q.query<{ name: string | null; email: string | null; ref: string; summary: string }>('select name, email, ref, summary from support_requests where id = $1', [id])
  const s = rows[0]
  return s ? { name: s.name, email: s.email, ref: s.ref, about: 'cererea ta', original: s.summary } : null
}

export const replies = {
  /** Stores the reply and queues its email. Refused without an address to write to or an empty text. */
  async create(q: Queryable, x: { kind: ThreadKind; threadId: string; body: string; actor: string }) {
    const body = x.body.replace(/\r\n/g, '\n').trim().slice(0, REPLY_MAX)
    if (!body || !UUID_RE.test(x.threadId)) return { ok: false as const, reason: 'empty' }
    const t = await thread(q, x.kind, x.threadId)
    if (!t) return { ok: false as const, reason: 'not found' }
    const to = t.email?.trim().toLowerCase()
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { ok: false as const, reason: 'no email' }
    const id = randomUUID()
    const subject = `Re: ${t.about[0].toUpperCase()}${t.about.slice(1)} (${t.ref})`
    await q.query(
      `insert into customer_replies (id, thread_kind, thread_id, to_email, subject, body, created_by) values ($1, $2, $3, $4, $5, $6, $7)`,
      [id, x.kind, x.threadId, to, subject, body, x.actor.slice(0, 80)],
    )
    await jobs.enqueue(q, { kind: 'email.reply', dedupeKey: `email.reply:${id}`, payload: { replyId: id } })
    return { ok: true as const, id }
  },

  async forThread(q: Queryable, kind: ThreadKind, id: string): Promise<Reply[]> {
    const { rows } = await q.query('select * from customer_replies where thread_kind = $1 and thread_id = $2 order by created_at', [kind, id])
    return rows.map(toReply)
  },

  /** Replies for many conversations at once (lists): thread id → replies. */
  async forThreads(q: Queryable, kind: ThreadKind, ids: string[]): Promise<Map<string, Reply[]>> {
    const map = new Map<string, Reply[]>()
    if (!ids.length) return map
    const { rows } = await q.query('select * from customer_replies where thread_kind = $1 and thread_id = any($2::uuid[]) order by created_at', [kind, ids])
    for (const r of rows) map.set(r.thread_id as string, [...(map.get(r.thread_id as string) ?? []), toReply(r)])
    return map
  },

  /** The email for a stored reply (with the customer's original words quoted below). */
  async render(q: Queryable, replyId: string) {
    const { rows } = await q.query('select * from customer_replies where id = $1', [replyId])
    const r = rows[0]
    if (!r) return null
    const t = await thread(q, r.thread_kind as ThreadKind, r.thread_id as string)
    const first = t?.name?.trim().split(/\s+/)[0]
    const hello = first ? `Bună, ${first}!` : 'Bună!'
    const body = r.body as string
    const paras = body.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#27343a">${esc(p).replace(/\n/g, '<br>')}</p>`)
    const quote = t?.original
      ? `<div style="margin:22px 0 0;padding:12px 16px;border-left:3px solid #d5dde0;background:#f6f8f9;border-radius:0 12px 12px 0">
<div style="font-size:12.5px;color:#5a6870;padding-bottom:4px">Mesajul tău (${esc(t.ref)}):</div>
<div style="font-size:14px;line-height:1.55;color:#5a6870">${esc(t.original.slice(0, 1500)).replace(/\n/g, '<br>')}</div></div>`
      : ''
    const subject = r.subject as string
    const html = emailShell({ subject, content: `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0b1316">${esc(hello)}</h1>\n${paras.join('\n')}\n${quote}` })
    const text = [hello, '', body, ...(t?.original ? ['', `Mesajul tău (${t.ref}):`, ...t.original.slice(0, 1500).split('\n').map((l) => `> ${l}`)] : []), '', 'Echipa Biohack Tech'].join('\n')
    return { to: r.to_email as string, subject, html, text }
  },

  async mark(q: Queryable, id: string, status: 'sent' | 'failed', error?: string) {
    await q.query(`update customer_replies set status = $2, error = $3, sent_at = case when $2 = 'sent' then now() else sent_at end where id = $1`, [id, status, error?.slice(0, 300) ?? null])
  },
}
