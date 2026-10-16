/**
 * The admin inbox's incoming side: customers' answers read over IMAP (a fake mailbox here) and attached to the right
 * conversation by Message-ID / In-Reply-To / References, or by reference plus the same sender; nothing else is
 * imported; duplicates, outages and a changed UIDVALIDITY lose and double nothing. SMTP is a fake transport.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.setConfig({ testTimeout: 30_000 })
type Sent = { to: string; subject: string; text: string; html: string; messageId: string; inReplyTo?: string; references?: string[]; headers?: Record<string, string> }
let sent: Sent[]
vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail: async (m: Sent) => (sent.push(m), { messageId: m.messageId, response: '250 OK', accepted: [m.to], rejected: [] }) }) },
}))

const { freshDb, TEST_ENV } = await import('./helpers')
const { recordEnquiry } = await import('@/server/enquiries')
const { replies } = await import('@/server/replies')
const { supportRequests } = await import('@/server/assistant/support')
const { runDueJobs } = await import('@/server/jobs/runner')
const { syncInbox, inbox, visibleText } = await import('@/server/inbox')
type IncomingEmail = import('@/server/inbox').IncomingEmail
type MailSource = import('@/server/inbox').MailSource

const ENV = { ...TEST_ENV, EMAIL_TRANSPORT: 'smtp', SMTP_HOST: 'mail.test', SMTP_USER: 'contact@biohack-tech.ro', SMTP_PASSWORD: 'not-a-real-password', EMAIL_FROM: 'Biohack Tech <contact@biohack-tech.ro>' }
let db: Awaited<ReturnType<typeof freshDb>>
beforeEach(async () => {
  db = await freshDb(ENV)
  sent = []
})

/** A fake mailbox: messages by UID, an optional outage, a UIDVALIDITY. */
function mailbox(messages: IncomingEmail[], opts: { down?: boolean; uidValidity?: bigint } = {}): MailSource & { messages: IncomingEmail[] } {
  const box = {
    messages,
    async open() {
      if (opts.down) throw new Error('connect ECONNREFUSED mail.biohack-tech.ro:993')
      return {
        uidValidity: opts.uidValidity ?? 1n,
        uids: async (from: number) => box.messages.map((_, i) => i + 1).filter((u) => u >= from),
        read: async (uid: number) => box.messages[uid - 1] ?? null,
        close: async () => {},
      }
    },
  }
  return box
}
const email = (x: Partial<IncomingEmail>): IncomingEmail => ({
  messageId: `<${crypto.randomUUID()}@gmail.com>`,
  inReplyTo: null,
  references: [],
  fromEmail: 'ana@exemplu.ro',
  fromName: 'Ana Popescu',
  subject: 'Re: ceva',
  text: 'Mulțumesc!',
  date: new Date(),
  attachments: 0,
  headers: {},
  ...x,
})

const conversation = async () => {
  const { enquiry } = await recordEnquiry({ name: 'Ana Popescu', email: 'ana@exemplu.ro', phone: '', topic: 'comanda', message: 'Când primesc factura?' }, { attemptId: crypto.randomUUID(), sourcePage: null, attribution: null })
  await replies.create(db, { kind: 'enquiry', threadId: enquiry.id, body: 'Factura vine după plată.', actor: 'admin' })
  await runDueJobs()
  const ours = (await db.query<{ message_id: string }>('select message_id from customer_replies where thread_id = $1', [enquiry.id])).rows[0].message_id
  return { enquiry, ours }
}
const count = async (sql: string) => (await db.query<{ n: number }>(sql)).rows[0].n

describe('IMAP inbound', () => {
  it('an answer to our reply (In-Reply-To) joins its conversation, unread, reopening it; a second run imports nothing new', async () => {
    const { enquiry, ours } = await conversation()
    expect(sent[0].messageId).toBe(ours) // the Message-ID we stored is the one the customer answers
    await db.query("update enquiries set status = 'resolved' where id = $1", [enquiry.id])
    const box = mailbox([email({ inReplyTo: ours, references: [ours], subject: `Re: O comandă plasată (${enquiry.reference})`, text: 'Am primit, mulțumesc!\n\nPe 16 oct. 2026, la 17:00, Biohack Tech a scris:\n> Factura vine după plată.' })])
    expect(await syncInbox(db, box)).toMatchObject({ imported: 1, ignored: 0, error: null })
    const thread = await inbox.forThread(db, 'enquiry', enquiry.id)
    expect(thread).toMatchObject([{ body: 'Am primit, mulțumesc!', matchedBy: 'headers', readAt: null }])
    expect((await db.query('select status from enquiries where id = $1', [enquiry.id])).rows[0].status).toBe('in_progress')
    expect(await inbox.unreadCounts(db)).toEqual({ enquiry: 1, support: 0 })
    expect(await syncInbox(db, box)).toMatchObject({ imported: 0 })
    expect(await count('select count(*)::int as n from inbound_emails')).toBe(1)
    await inbox.markRead(db, 'enquiry', enquiry.id)
    expect(await inbox.unreadCounts(db)).toEqual({ enquiry: 0, support: 0 })
  })

  it('the next reply from the admin threads under the customer’s answer (In-Reply-To, References), as a person’s email', async () => {
    const { enquiry, ours } = await conversation()
    const theirs = '<answer-1@gmail.com>'
    await syncInbox(db, mailbox([email({ messageId: theirs, inReplyTo: ours, references: [ours] })]))
    await replies.create(db, { kind: 'enquiry', threadId: enquiry.id, body: 'Cu plăcere!', actor: 'admin' })
    await runDueJobs()
    expect(sent[1]).toMatchObject({ inReplyTo: theirs, references: [ours, theirs] })
    expect(sent[1].headers?.['Auto-Submitted']).toBeUndefined()
  })

  it('by reference only when the sender is the conversation’s own address; never from another address', async () => {
    const { enquiry } = await conversation()
    const { request } = await supportRequests.create(db, { category: 'other', summary: 'Schimb adresa.', email: 'ion@exemplu.ro', name: 'Ion' }, false)
    const box = mailbox([
      email({ subject: `Re: cererea ${request.ref}`, fromEmail: 'ion@exemplu.ro', text: 'Strada nouă 5' }),
      email({ subject: `Re: O comandă plasată (${enquiry.reference})`, fromEmail: 'altcineva@exemplu.ro', text: 'Eu nu sunt Ana' }),
    ])
    expect(await syncInbox(db, box)).toMatchObject({ imported: 1, ignored: 1 })
    expect(await inbox.forThread(db, 'support', request.id)).toMatchObject([{ body: 'Strada nouă 5', matchedBy: 'reference' }])
    expect(await inbox.forThread(db, 'enquiry', enquiry.id)).toEqual([])
  })

  it('unrelated mail, spam, auto-replies, our own messages and ambiguous headers are left alone; no conversation is created', async () => {
    const { enquiry, ours } = await conversation()
    const { request } = await supportRequests.create(db, { category: 'other', summary: 'x', email: 'ion@exemplu.ro' }, false)
    await replies.create(db, { kind: 'support', threadId: request.id, body: 'Răspuns', actor: 'admin' })
    await runDueJobs()
    const theirsToo = (await db.query<{ message_id: string }>('select message_id from customer_replies where thread_id = $1', [request.id])).rows[0].message_id
    const before = await count('select count(*)::int as n from enquiries') + (await count('select count(*)::int as n from support_requests'))
    const box = mailbox([
      email({ subject: 'Ofertă specială pentru voi', fromEmail: 'newsletter@shop.com', headers: { 'list-unsubscribe': '<mailto:x>' } }),
      email({ subject: 'Bună, vreau să comand', fromEmail: 'nou@exemplu.ro' }),
      email({ inReplyTo: ours, headers: { 'auto-submitted': 'auto-replied' }, text: 'Sunt în concediu' }),
      email({ inReplyTo: ours, headers: { 'x-spam-flag': 'yes' } }),
      email({ inReplyTo: ours, fromEmail: 'contact@biohack-tech.ro' }),
      email({ inReplyTo: ours, references: [ours, theirsToo] }),
      email({ subject: `Re: (${enquiry.reference}) și (MSG-00000000)`, fromEmail: 'ana@exemplu.ro', text: 'referință necunoscută + cunoscută' }),
    ])
    const r = await syncInbox(db, box)
    expect(r.imported).toBe(1) // only the last one: Ana, her own reference (the unknown one matches nothing)
    expect(await count('select count(*)::int as n from enquiries') + (await count('select count(*)::int as n from support_requests'))).toBe(before)
    expect(await count('select count(*)::int as n from inbound_emails')).toBe(1)
  })

  it('IMAP down: recorded, nothing lost; the next run imports what arrived meanwhile; a new UIDVALIDITY doubles nothing', async () => {
    const { enquiry, ours } = await conversation()
    const msgs = [email({ inReplyTo: ours, text: 'Prima' }), email({ inReplyTo: ours, text: 'A doua' })]
    expect((await syncInbox(db, mailbox(msgs, { down: true }))).error).toMatch(/ECONNREFUSED/)
    expect(await inbox.state(db)).toMatchObject({ lastError: expect.stringMatching(/ECONNREFUSED/) })
    expect(await syncInbox(db, mailbox(msgs))).toMatchObject({ imported: 2, error: null })
    expect(await inbox.state(db)).toMatchObject({ lastError: null })
    expect(await syncInbox(db, mailbox(msgs, { uidValidity: 2n }))).toMatchObject({ imported: 0, duplicates: 2 })
    expect((await inbox.forThread(db, 'enquiry', enquiry.id)).map((m) => m.body)).toEqual(['Prima', 'A doua'])
  })

  it('a mailbox that stops answering never holds the run past its deadline', async () => {
    const hang: MailSource = { open: () => new Promise(() => {}) }
    const t = Date.now()
    const r = await syncInbox(db, hang, { deadline: Date.now() + 300 })
    expect(r.error).toMatch(/timeout/)
    expect(Date.now() - t).toBeLessThan(3_000)
  })

  it('the answer is shown without the quoted conversation', () => {
    expect(visibleText('Da, mulțumesc.\n\nOn Fri, Oct 16, 2026 at 5:00 PM Biohack Tech <contact@biohack-tech.ro> wrote:\n> text')).toBe('Da, mulțumesc.')
    expect(visibleText('Bine\n\n-----Original Message-----\nFrom: x')).toBe('Bine')
    expect(visibleText('> doar citat')).toBe('> doar citat')
  })
})
