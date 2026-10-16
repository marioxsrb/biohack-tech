/**
 * Delivers rendered emails. `smtp`: our own mailbox on mail.biohack-tech.ro, so the customer sees
 * Biohack Tech <contact@biohack-tech.ro> (GoHighLevel rewrites every sender to the NEUROS domain).
 * `ghl`: through the contact's GoHighLevel conversation. `file`: writes .html/.txt under EMAIL_FILE_DIR
 * for local QA. `none`: off.
 *
 * Exactly-once is not possible over SMTP: if the server accepts a message and the connection drops before
 * we read its answer, the job is retried and the message can arrive twice. Every attempt of a job carries
 * the same Message-ID, so mail clients that thread or dedupe by Message-ID show it once.
 */
import 'server-only'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import nodemailer from 'nodemailer'
import type { Config, SmtpConfig } from '@/server/config'
import { ghl } from '@/server/integrations/ghl'

export type OutgoingEmail = {
  subject: string
  html: string
  text: string
  /** File name for the file transport, and the seed of the stable Message-ID. */
  name: string
  /** Defaults to the order's customer through GoHighLevel; required for smtp and file. */
  to?: string
  ghlContactId?: string | null
  /** A person's reply in an email conversation: threading headers, and not marked as automatic. */
  thread?: { inReplyTo?: string; references?: string[] }
}

/** A rejection that retrying cannot fix (the recipient does not exist). Everything else is retried. */
export class EmailError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message)
  }
}

const domainOf = (from: string) => from.match(/@([^>\s]+)/)?.[1] ?? 'biohack-tech.ro'
export const messageIdFor = (name: string, from: string) => `<${createHash('sha256').update(name).digest('hex').slice(0, 32)}@${domainOf(from)}>`

type Sender = { sendMail: (m: Record<string, unknown>) => Promise<{ messageId?: string; response?: string; accepted?: unknown[]; rejected?: unknown[] }> }
let smtpSender: { key: string; sender: Sender } | null = null

function sender(s: SmtpConfig): Sender {
  const key = `${s.host}:${s.port}:${s.user}`
  if (smtpSender?.key !== key) {
    smtpSender = {
      key,
      sender: nodemailer.createTransport({
        host: s.host,
        port: s.port,
        secure: s.secure,
        requireTLS: !s.secure,
        auth: { user: s.user, pass: s.password },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 30_000,
      }) as unknown as Sender,
    }
  }
  return smtpSender.sender
}

/** Test helper. */
export function resetTransport() {
  smtpSender = null
}

async function sendSmtp(c: Config, e: OutgoingEmail & { to: string }) {
  if (!c.email.smtp) throw new EmailError('SMTP is not configured', true)
  const messageId = messageIdFor(e.name, c.email.from)
  try {
    const r = await sender(c.email.smtp).sendMail({
      from: c.email.from,
      to: e.to,
      ...(c.email.replyTo && { replyTo: c.email.replyTo }),
      subject: e.subject,
      text: e.text,
      html: e.html,
      messageId,
      ...(e.thread?.inReplyTo && { inReplyTo: e.thread.inReplyTo }),
      ...(e.thread?.references?.length && { references: e.thread.references }),
      // Written by a person (a reply from the admin): no Auto-Submitted, so the customer's answer is a normal email.
      headers: e.thread ? {} : { 'Auto-Submitted': 'auto-generated' },
    })
    if (r.rejected?.length) throw new EmailError(`rejected: ${r.response ?? 'recipient refused'}`, false)
    return `smtp:${messageId}`
  } catch (err) {
    if (err instanceof EmailError) throw err
    const x = err as { responseCode?: number; code?: string; message?: string }
    // 550-553 for the recipient: the address does not exist or is refused. Retrying sends nothing new.
    const permanent = typeof x.responseCode === 'number' && x.responseCode >= 550 && x.responseCode <= 553 && x.code === 'EENVELOPE'
    throw new EmailError(`smtp ${x.responseCode ?? x.code ?? ''}: ${(x.message ?? String(err)).slice(0, 300)}`, !permanent)
  }
}

export async function deliver(c: Config, e: OutgoingEmail) {
  if (c.email.transport === 'smtp') {
    if (!e.to) throw new EmailError('no recipient', false)
    return sendSmtp(c, { ...e, to: e.to })
  }
  if (c.email.transport === 'file') {
    await mkdir(c.email.fileDir, { recursive: true })
    const base = path.join(c.email.fileDir, e.name)
    await writeFile(`${base}.html`, e.html)
    await writeFile(`${base}.txt`, `From: ${c.email.from}\nTo: ${e.to ?? ''}\nMessage-ID: ${messageIdFor(e.name, c.email.from)}\nSubject: ${e.subject}\n\n${e.text}`)
    return `file:${base}`
  }
  if (c.email.transport === 'ghl') {
    if (!c.ghl) throw new Error('GHL is not configured')
    if (!e.ghlContactId) throw new Error('contact not synced to GHL yet')
    return `ghl:${await ghl.sendEmail(c.ghl, e.ghlContactId, e)}`
  }
  return 'none'
}
