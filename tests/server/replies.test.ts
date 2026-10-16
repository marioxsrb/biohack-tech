/**
 * Replies from /admin to customers (Mesaje and Suport): stored with the conversation, emailed from our own mailbox
 * with the customer's words quoted, marked sent or failed. SMTP is a fake nodemailer transport.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.setConfig({ testTimeout: 30_000 })
type Sent = { to: string; subject: string; text: string; html: string }
let sent: Sent[]
let fail = false
vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: async (m: Sent & { messageId: string }) => {
        if (fail) throw Object.assign(new Error('550 mailbox unavailable'), { responseCode: 550 })
        sent.push(m)
        return { messageId: m.messageId, response: '250 OK', accepted: [m.to], rejected: [] }
      },
    }),
  },
}))

const { freshDb, TEST_ENV } = await import('./helpers')
const { recordEnquiry } = await import('@/server/enquiries')
const { replies } = await import('@/server/replies')
const { supportRequests } = await import('@/server/assistant/support')
const { runDueJobs } = await import('@/server/jobs/runner')

const ENV = { ...TEST_ENV, EMAIL_TRANSPORT: 'smtp', SMTP_HOST: 'mail.test', SMTP_USER: 'contact@biohack-tech.ro', SMTP_PASSWORD: 'not-a-real-password', EMAIL_FROM: 'contact@biohack-tech.ro' }
let db: Awaited<ReturnType<typeof freshDb>>
beforeEach(async () => {
  db = await freshDb(ENV)
  sent = []
  fail = false
})

const enquiry = async () =>
  (await recordEnquiry({ name: 'Ana Popescu', email: 'ana@exemplu.ro', phone: '', topic: 'comanda', message: 'Când primesc factura pentru comanda BT-1?' }, { attemptId: crypto.randomUUID(), sourcePage: '/contact-us', attribution: null })).enquiry

describe('replies from the admin', () => {
  it('a contact-form message: the reply is emailed to the customer, with greeting, reference and their words quoted; the thread shows it sent', async () => {
    const e = await enquiry()
    const r = await replies.create(db, { kind: 'enquiry', threadId: e.id, body: 'Factura vine pe email după confirmarea plății.\n\nO zi bună!', actor: 'admin:test' })
    expect(r.ok).toBe(true)
    await runDueJobs()
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ to: 'ana@exemplu.ro', subject: `Re: O comandă plasată (${e.reference})` })
    expect(sent[0].text).toMatch(/^Bună, Ana!\n\nFactura vine pe email/)
    expect(sent[0].text).toContain('> Când primesc factura pentru comanda BT-1?')
    expect(sent[0].html).toContain('Factura vine pe email după confirmarea plății.')
    expect(sent[0].text).not.toMatch(/dezabon/i) // a service message the customer asked for
    const thread = await replies.forThread(db, 'enquiry', e.id)
    expect(thread).toMatchObject([{ status: 'sent', toEmail: 'ana@exemplu.ro', createdBy: 'admin:test' }])
  })

  it('a chat support request with an email gets the reply; one without an email or an empty text is refused', async () => {
    const { request } = await supportRequests.create(db, { category: 'other', summary: 'Vreau să schimb adresa de livrare.', email: 'ion@exemplu.ro', name: 'Ion' }, false)
    expect((await replies.create(db, { kind: 'support', threadId: request.id, body: '   ', actor: 'admin' })).ok).toBe(false)
    expect((await replies.create(db, { kind: 'support', threadId: request.id, body: 'Am schimbat adresa.', actor: 'admin' })).ok).toBe(true)
    await runDueJobs()
    expect(sent.map((m) => m.subject)).toEqual([`Re: Cererea ta (${request.ref})`])
    const { request: anon } = await supportRequests.create(db, { category: 'other', summary: 'Sunați-mă.', phone: '0722123456' }, false)
    expect(await replies.create(db, { kind: 'support', threadId: anon.id, body: 'Text', actor: 'admin' })).toEqual({ ok: false, reason: 'no email' })
  })

  it('a refused delivery is shown as not sent, with the reason; the queue retries it', async () => {
    const e = await enquiry()
    fail = true
    await replies.create(db, { kind: 'enquiry', threadId: e.id, body: 'Răspuns', actor: 'admin' })
    await runDueJobs()
    const [r] = await replies.forThread(db, 'enquiry', e.id)
    expect(r.status).toBe('failed')
    expect(r.error).toMatch(/550/)
  })
})
