/**
 * The admin inbox's incoming side: customers' email answers to the team's replies, read from the contact@ mailbox
 * over IMAP (TLS) by the cron, and attached to their conversation (a contact-form message or a chat support
 * request). Nothing else is imported: an email is attached only when
 *   1. its In-Reply-To / References name a message of the conversation (a reply we sent, or an answer already
 *      imported), or
 *   2. its subject carries the conversation's reference (MSG-…, S-…) AND it comes from the conversation's own
 *      address.
 * Anything else (new emails, newsletters, spam, auto-replies, a reference from another address) is left alone in
 * the mailbox: never a new conversation, never attached to the wrong customer. Messages are read with PEEK (the
 * mailbox's own read flags are untouched); the position (UID) moves only past messages that were processed, so
 * an IMAP outage loses nothing, and the Message-ID makes a second import impossible.
 */
import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import type { EmailConfig } from '@/server/config'
import type { Queryable } from '@/server/db'
import { errText, log } from '@/server/log'
import type { ThreadKind } from '@/server/replies'

export type IncomingEmail = {
  messageId: string | null
  inReplyTo: string | null
  references: string[]
  fromEmail: string
  fromName: string | null
  subject: string
  text: string
  date: Date
  attachments: number
  /** Auto-Submitted / Precedence / X-Spam-Flag, lower-cased. */
  headers: Record<string, string>
}

export type Inbound = { id: string; fromEmail: string; fromName: string | null; subject: string; body: string; attachments: number; receivedAt: Date; readAt: Date | null; matchedBy: string }

const MAILBOX = 'INBOX'
const BODY_MAX = 20_000
const PER_RUN = 40
const MSG_REF = /\b(MSG-[0-9A-F]{8})\b/
const SUPPORT_REF = /\b(S-[2-9A-HJ-NP-Z]{6})\b/
const ID_RE = /<[^<>\s]{3,250}>/g

const norm = (e: string) => e.trim().toLowerCase()
export const messageIds = (v: string | string[] | null | undefined) => (Array.isArray(v) ? v.join(' ') : (v ?? '')).match(ID_RE) ?? []

/** An automatic message (out of office, delivery report, list mail) or one the server marked as spam. */
export function isAutomatic(m: Pick<IncomingEmail, 'headers' | 'fromEmail'>) {
  const h = m.headers
  if (h['auto-submitted'] && h['auto-submitted'] !== 'no') return true
  if (/^(bulk|junk|list|auto_reply)$/.test(h['precedence'] ?? '')) return true
  if (h['x-autoreply'] || h['x-autorespond'] || h['list-id'] || h['list-unsubscribe']) return true
  if (/^yes/i.test(h['x-spam-flag'] ?? '') || /^yes/i.test(h['x-spam-status'] ?? '')) return true
  return /^(mailer-daemon|postmaster|no-?reply)@/i.test(m.fromEmail)
}

/** The answer itself, without the quoted conversation below it (the thread already shows that). */
export function visibleText(text: string) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  for (const line of lines) {
    if (/^\s*>/.test(line)) break
    if (/^(On|Pe|În|In) .{6,200}(wrote|a scris|scria):\s*$/i.test(line.trim())) break
    if (/^-{2,}\s*(Original Message|Mesaj original|Forwarded)/i.test(line.trim())) break
    if (/^(From|De la|Von):\s.+/i.test(line.trim()) && out.some((l) => l.trim())) break
    out.push(line)
  }
  const body = out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return (body || text.trim()).slice(0, BODY_MAX)
}

type Thread = { kind: ThreadKind; id: string; email: string | null }

/** The conversation an email answers, or null (with the reason, for the log). Never a guess. */
export async function matchThread(q: Queryable, m: IncomingEmail): Promise<{ thread: Thread; by: string } | { thread: null; reason: string }> {
  const ids = [...new Set([...messageIds(m.inReplyTo), ...m.references.flatMap((r) => messageIds(r))])]
  if (ids.length) {
    const { rows } = await q.query<{ kind: ThreadKind; id: string }>(
      `select thread_kind as kind, thread_id::text as id from customer_replies where message_id = any($1::text[])
       union select thread_kind, thread_id::text from inbound_emails where message_id = any($1::text[])`,
      [ids],
    )
    const distinct = [...new Map(rows.map((r) => [`${r.kind}:${r.id}`, r])).values()]
    if (distinct.length === 1) return { thread: { ...distinct[0], email: null }, by: 'headers' }
    if (distinct.length > 1) return { thread: null, reason: 'headers name several conversations' }
  }
  const msg = MSG_REF.exec(m.subject)?.[1]
  const sup = SUPPORT_REF.exec(m.subject)?.[1]
  if (msg && sup) return { thread: null, reason: 'two references' }
  const found = msg
    ? (await q.query<{ id: string; email: string }>('select id::text, email from enquiries where reference = $1', [msg])).rows[0]
    : sup
      ? (await q.query<{ id: string; email: string | null }>('select id::text, email from support_requests where ref = $1', [sup])).rows[0]
      : undefined
  if (!found) return { thread: null, reason: msg || sup ? 'unknown reference' : 'not a reply to a conversation' }
  if (!found.email || norm(found.email) !== norm(m.fromEmail)) return { thread: null, reason: 'reference from another address' }
  return { thread: { kind: msg ? 'enquiry' : 'support', id: found.id, email: found.email }, by: 'reference' }
}

/** Stores one email if it belongs to a conversation; reopens a resolved conversation. 'imported' | 'duplicate' | 'ignored'. */
export async function ingest(q: Queryable, m: IncomingEmail): Promise<{ result: 'imported' | 'duplicate' | 'ignored'; reason?: string }> {
  if (!m.fromEmail || isAutomatic(m)) return { result: 'ignored', reason: 'automatic or spam' }
  const own = /@biohack-tech\.(ro|net)$/i.test(m.fromEmail)
  if (own) return { result: 'ignored', reason: 'our own address' }
  const match = await matchThread(q, m)
  if (!match.thread) return { result: 'ignored', reason: match.reason }
  // A message without a Message-ID gets a stable one from its content, so a second read is still a duplicate.
  const messageId = m.messageId ?? `<sha-${createHash('sha256').update(`${m.fromEmail}|${m.date.toISOString()}|${m.subject}|${m.text.slice(0, 2000)}`).digest('hex').slice(0, 40)}@inbound>`
  const { rows } = await q.query(
    `insert into inbound_emails (id, message_id, thread_kind, thread_id, from_email, from_name, subject, body, attachments, matched_by, received_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) on conflict (message_id) do nothing returning id`,
    [randomUUID(), messageId, match.thread.kind, match.thread.id, norm(m.fromEmail), m.fromName?.slice(0, 120) ?? null, m.subject.slice(0, 300), visibleText(m.text), m.attachments, match.by, m.date],
  )
  if (!rows.length) return { result: 'duplicate' }
  if (match.thread.kind === 'enquiry') await q.query(`update enquiries set status = case when status = 'resolved' then 'in_progress' else status end, updated_at = now() where id = $1`, [match.thread.id])
  else await q.query(`update support_requests set status = case when status = 'resolved' then 'in_progress' else status end, resolved_at = null, updated_at = now() where id = $1`, [match.thread.id])
  return { result: 'imported' }
}

export const inbox = {
  async forThread(q: Queryable, kind: ThreadKind, id: string): Promise<Inbound[]> {
    const { rows } = await q.query('select * from inbound_emails where thread_kind = $1 and thread_id = $2 order by received_at', [kind, id])
    return rows.map(toInbound)
  },
  async forThreads(q: Queryable, kind: ThreadKind, ids: string[]): Promise<Map<string, Inbound[]>> {
    const map = new Map<string, Inbound[]>()
    if (!ids.length) return map
    const { rows } = await q.query('select * from inbound_emails where thread_kind = $1 and thread_id = any($2::uuid[]) order by received_at', [kind, ids])
    for (const r of rows) map.set(r.thread_id as string, [...(map.get(r.thread_id as string) ?? []), toInbound(r)])
    return map
  },
  async markRead(q: Queryable, kind: ThreadKind, id: string) {
    await q.query('update inbound_emails set read_at = now() where thread_kind = $1 and thread_id = $2 and read_at is null', [kind, id])
  },
  async unreadCounts(q: Queryable): Promise<Record<ThreadKind, number>> {
    const { rows } = await q.query<{ kind: ThreadKind; n: number }>('select thread_kind as kind, count(distinct thread_id)::int as n from inbound_emails where read_at is null group by 1')
    return { enquiry: rows.find((r) => r.kind === 'enquiry')?.n ?? 0, support: rows.find((r) => r.kind === 'support')?.n ?? 0 }
  },
  async unreadThreads(q: Queryable, kind: ThreadKind): Promise<Set<string>> {
    const { rows } = await q.query<{ id: string }>('select distinct thread_id::text as id from inbound_emails where thread_kind = $1 and read_at is null', [kind])
    return new Set(rows.map((r) => r.id))
  },
  async state(q: Queryable) {
    const { rows } = await q.query<{ last_run_at: string | null; last_ok_at: string | null; last_error: string | null; imported: number }>('select * from imap_state where mailbox = $1', [MAILBOX])
    const r = rows[0]
    return r ? { lastRunAt: r.last_run_at ? new Date(r.last_run_at) : null, lastOkAt: r.last_ok_at ? new Date(r.last_ok_at) : null, lastError: r.last_error, imported: Number(r.imported) } : null
  },
}

const toInbound = (r: Record<string, unknown>): Inbound => ({
  id: r.id as string,
  fromEmail: r.from_email as string,
  fromName: (r.from_name as string) ?? null,
  subject: r.subject as string,
  body: r.body as string,
  attachments: Number(r.attachments ?? 0),
  receivedAt: new Date(r.received_at as string),
  readAt: r.read_at ? new Date(r.read_at as string) : null,
  matchedBy: r.matched_by as string,
})

/** What the IMAP client gives us, reduced to what the matching needs (injected in tests). */
export type MailSource = {
  open(): Promise<{ uidValidity: bigint; uids: (fromUid: number) => Promise<number[]>; read: (uid: number) => Promise<IncomingEmail | null>; close: () => Promise<void> }>
}

/** Rejects when `ms` passes first: a mailbox that stops answering never holds the cron. */
function within<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([p, new Promise<T>((_, reject) => (timer = setTimeout(() => reject(new Error(`IMAP timeout (${what})`)), Math.max(1, ms))))]).finally(() => clearTimeout(timer))
}

/**
 * One sync run: new messages since the stored UID, at most PER_RUN, each imported or ignored; the UID moves only
 * past processed messages. A changed UIDVALIDITY starts again from the beginning (duplicates are refused by
 * Message-ID). Errors are recorded (shown in the admin) and never thrown: the cron's other work goes on.
 */
export async function syncInbox(q: Queryable, source: MailSource, opts: { deadline?: number } = {}) {
  const deadline = opts.deadline ?? Date.now() + 25_000
  const stats = { imported: 0, duplicates: 0, ignored: 0, error: null as string | null }
  await q.query(`insert into imap_state (mailbox) values ($1) on conflict (mailbox) do nothing`, [MAILBOX])
  await q.query('update imap_state set last_run_at = now() where mailbox = $1', [MAILBOX])
  let conn: Awaited<ReturnType<MailSource['open']>> | null = null
  try {
    conn = await within(source.open(), deadline - Date.now(), 'connect')
    const { rows } = await q.query<{ uid_validity: string | null; last_uid: string }>('select uid_validity, last_uid from imap_state where mailbox = $1', [MAILBOX])
    let lastUid = rows[0]?.uid_validity && BigInt(rows[0].uid_validity) === conn.uidValidity ? Number(rows[0].last_uid) : 0
    if (!rows[0]?.uid_validity || BigInt(rows[0].uid_validity) !== conn.uidValidity) await q.query('update imap_state set uid_validity = $2, last_uid = 0 where mailbox = $1', [MAILBOX, conn.uidValidity.toString()])
    const uids = (await within(conn.uids(lastUid + 1), deadline - Date.now(), 'search')).filter((u) => u > lastUid).sort((a, b) => a - b).slice(0, PER_RUN)
    for (const uid of uids) {
      if (Date.now() > deadline) break
      const m = await within(conn.read(uid), Math.min(15_000, deadline - Date.now()), 'fetch')
      if (m) {
        const r = await ingest(q, m)
        if (r.result === 'imported') stats.imported++
        else if (r.result === 'duplicate') stats.duplicates++
        else stats.ignored++
        if (r.result === 'imported') log.info('inbox.imported', { uid })
      }
      lastUid = uid
      await q.query('update imap_state set last_uid = $2 where mailbox = $1', [MAILBOX, lastUid])
    }
    await q.query('update imap_state set last_ok_at = now(), last_error = null, imported = imported + $2, ignored = ignored + $3 where mailbox = $1', [MAILBOX, stats.imported, stats.ignored])
  } catch (e) {
    stats.error = errText(e).slice(0, 300)
    log.warn('inbox.sync_failed', { error: stats.error })
    await q.query('update imap_state set last_error = $2 where mailbox = $1', [MAILBOX, stats.error]).catch(() => {})
  } finally {
    await within(conn?.close() ?? Promise.resolve(), 5_000, 'close').catch(() => {})
  }
  return stats
}

/** The real mailbox: imapflow with TLS and short timeouts, messages parsed by mailparser, read with PEEK. */
export function imapSource(c: NonNullable<EmailConfig['imap']>): MailSource {
  return {
    async open() {
      const { ImapFlow } = await import('imapflow')
      const { simpleParser } = await import('mailparser')
      const client = new ImapFlow({ host: c.host, port: c.port, secure: true, auth: { user: c.user, pass: c.password }, logger: false, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 30_000 })
      await client.connect()
      const lock = await client.getMailboxLock(MAILBOX, { readOnly: true })
      const box = client.mailbox
      const uidValidity = BigInt(box && typeof box === 'object' ? (box.uidValidity ?? 0) : 0)
      return {
        uidValidity,
        uids: async (from) => (await client.search({ uid: `${from}:*` }, { uid: true })) || [],
        read: async (uid) => {
          const msg = await client.fetchOne(String(uid), { source: true, uid: true }, { uid: true })
          if (!msg || !msg.source) return null
          const p = await simpleParser(msg.source)
          const from = p.from?.value?.[0]
          const header = (k: string) => {
            const v = p.headers.get(k)
            return typeof v === 'string' ? v.toLowerCase() : v ? String(v).toLowerCase() : ''
          }
          return {
            messageId: p.messageId ? (p.messageId.startsWith('<') ? p.messageId : `<${p.messageId}>`) : null,
            inReplyTo: p.inReplyTo ?? null,
            references: Array.isArray(p.references) ? p.references : p.references ? [p.references] : [],
            fromEmail: from?.address ?? '',
            fromName: from?.name || null,
            subject: p.subject ?? '',
            text: (p.text ?? '').slice(0, BODY_MAX * 2),
            date: p.date ?? new Date(),
            attachments: p.attachments?.length ?? 0,
            headers: Object.fromEntries(['auto-submitted', 'precedence', 'x-autoreply', 'x-autorespond', 'list-id', 'list-unsubscribe', 'x-spam-flag', 'x-spam-status'].map((k) => [k, header(k)]).filter(([, v]) => v)),
          }
        },
        close: async () => {
          lock.release()
          await client.logout()
        },
      }
    },
  }
}
