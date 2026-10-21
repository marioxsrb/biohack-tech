/**
 * Checkout risk (21.10.2026): an internal score from several signals, decided on the server when an order is placed.
 * No single signal blocks anyone: a temporary email address or one failed card payment alone stays below the review
 * line. What the score does:
 *   ≥ REVIEW_AT   the order waits for a person ("Necesită verificare", /admin/verificare) before preparation, and
 *                 its recovery emails and AI calls wait too; a card payment is also asked for 3D Secure every time.
 *   card refused  only after FAILED_CARD_LIMIT failed card payments on the same contact, browser or network within
 *                 24 hours: the customer is offered the other methods (cash on delivery, transfer) or the phone.
 * The signals never leave the server (no page, email, CRM field or pixel shows them). The network is kept as a keyed
 * hash of the IP, never the IP itself; nothing about the card is stored.
 */
import 'server-only'
import { createHmac } from 'node:crypto'
import type { Queryable } from '@/server/db'

export const REVIEW_AT = 40
export const FAILED_CARD_LIMIT = 3

/** Disposable inboxes (the address works for minutes or hours, then nobody reads it). */
const DISPOSABLE = new Set([
  'mailnow.io', 'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamailblock.com', 'sharklasers.com', 'grr.la',
  '10minutemail.com', '10minutemail.net', 'temp-mail.org', 'temp-mail.io', 'tempmail.com', 'tempmail.net', 'tempmailo.com', 'tempail.com',
  'yopmail.com', 'yopmail.fr', 'yopmail.net', 'trashmail.com', 'trashmail.de', 'getnada.com', 'nada.email', 'maildrop.cc', 'dispostable.com',
  'throwawaymail.com', 'fakeinbox.com', 'mohmal.com', 'emailondeck.com', 'minuteinbox.com', 'mail.tm', 'mail.gw', 'tmail.ws', 'tmpmail.org',
  'tmpmail.net', 'mintemail.com', 'mytemp.email', 'spamgourmet.com', 'mailcatch.com', 'mailnesia.com', 'burnermail.io', 'inboxkitten.com',
  'emailfake.com', 'fakemail.net', 'luxusmail.org', 'dropmail.me', 'cmail.club', 'tempinbox.com', 'mailpoof.com', 'moakt.com', 'tempr.email',
  'discard.email', 'spambox.us', 'byom.de', 'trash-mail.com', 'wegwerfmail.de', 'einrot.com', 'mailforspam.com', 'tempmailaddress.com',
])
/** Addresses that are not anyone's (examples, tests). */
const PLACEHOLDER = new Set(['example.com', 'example.org', 'example.net', 'test.com', 'test.ro', 'email.com', 'domain.com'])

export type EmailKind = 'disposable' | 'placeholder' | null

export function emailKind(email: string): EmailKind {
  const domain = email.trim().toLowerCase().split('@')[1] ?? ''
  if (DISPOSABLE.has(domain)) return 'disposable'
  if (PLACEHOLDER.has(domain)) return 'placeholder'
  return null
}

/** The network, as a keyed hash: enough to see the same source twice, useless to anyone reading the database. */
export function ipKey(ip: string | null | undefined): string | null {
  if (!ip || ip === 'unknown') return null
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.CRON_SECRET || 'bt-risk'
  return createHmac('sha256', `risk:${secret}`).update(ip.trim()).digest('hex').slice(0, 32)
}

/** The last 9 digits of a phone number: 0722…, +40722…, 40722… are the same number. */
export const phoneKey = (phone: string | null | undefined) => {
  const d = (phone ?? '').replace(/\D/g, '')
  return d.length >= 9 ? d.slice(-9) : null
}

export type RiskSignals = {
  emailKind: EmailKind
  /** Failed card payments in the last 24 h on the same email, phone, browser or network (this order excluded). */
  failedCards: number
  /** Different names on orders with the same email or phone in the last 7 days, this one included. */
  names: number
  /** Different email addresses from the same browser or network in the last 24 h, this one included. */
  emails: number
  /** Other orders from the same browser or network in the last hour. */
  burst: number
  /** The email already has a paid order, or a person cleared one of its orders. */
  known: boolean
}

export type Risk = { score: number; reasons: string[]; review: boolean }

/** Pure: the score and the reasons a person reads in /admin/verificare. */
export function scoreRisk(s: RiskSignals): Risk {
  let score = 0
  const reasons: string[] = []
  const add = (points: number, reason: string) => {
    score += points
    reasons.push(reason)
  }
  if (s.emailKind === 'disposable') add(25, 'Email temporar')
  if (s.emailKind === 'placeholder') add(25, 'Email fictiv (exemplu/test)')
  if (s.failedCards > 0)
    add(s.failedCards >= 3 ? 45 : s.failedCards === 2 ? 30 : 15, s.failedCards === 1 ? 'O plată cu cardul eșuată în ultimele 24 h' : `${s.failedCards} plăți cu cardul eșuate în ultimele 24 h`)
  if (s.names >= 2) add(20, `${s.names} nume diferite pe același email sau telefon (7 zile)`)
  if (s.emails >= 2) add(20, `${s.emails} adrese de email din același browser sau rețea (24 h)`)
  if (s.burst >= 2) add(15, `${s.burst + 1} comenzi din același browser sau rețea într-o oră`)
  if (s.known && score > 0) {
    score = Math.max(0, score - 30)
    reasons.push('Client cunoscut (comandă plătită sau verificată)')
  }
  return { score, reasons, review: score >= REVIEW_AT }
}

export type RiskInput = { email: string; phone: string; firstName: string; lastName: string; ip: string | null; visitor: string | null; excludeOrderId?: string }

/** Same email or same phone, and same network or browser, on the orders table (optionally aliased), as placeholders. */
const contactSql = (a: string, email: string, phone: string) =>
  `(lower(${a}email) = ${email}::text or (${phone}::text <> '' and right(regexp_replace(coalesce(${a}phone, ''), '\\D', '', 'g'), 9) = ${phone}::text))`
const sourceSql = (a: string, ip: string, visitor: string) => `((${ip}::text <> '' and ${a}risk_ip = ${ip}::text) or (${visitor}::text <> '' and ${a}risk_visitor = ${visitor}::text))`

const STANDING_PAID = `payment_status in ('paid', 'partially_refunded') or risk_review = 'cleared'`
const NO_ORDER = '00000000-0000-0000-0000-000000000000'

/** Reads the signals for an order about to be placed (or just placed: pass its id to leave it out). */
export async function riskSignals(q: Queryable, i: RiskInput): Promise<RiskSignals> {
  const email = i.email.trim().toLowerCase()
  const phone = phoneKey(i.phone) ?? ''
  const ip = i.ip ?? ''
  const visitor = i.visitor ?? ''
  const not = i.excludeOrderId ?? NO_ORDER
  const [failed, names, emails, burst, known] = await Promise.all([
    q.query<{ n: number }>(
      `select count(*)::int as n from order_events e join orders o on o.id = e.order_id
        where e.type = 'payment.failed' and e.created_at >= now() - interval '24 hours' and o.id <> $5::uuid
          and (${contactSql('o.', '$1', '$2')} or ${sourceSql('o.', '$3', '$4')})`,
      [email, phone, ip, visitor, not],
    ),
    q.query<{ name: string }>(
      `select distinct lower(trim(coalesce(customer->>'firstName', '') || ' ' || coalesce(customer->>'lastName', ''))) as name from orders
        where created_at >= now() - interval '7 days' and id <> $3::uuid and ${contactSql('', '$1', '$2')}`,
      [email, phone, not],
    ),
    q.query<{ email: string }>(
      `select distinct lower(email) as email from orders where created_at >= now() - interval '24 hours' and id <> $3::uuid and ${sourceSql('', '$1', '$2')}
       union select distinct lower(l.email) from leads l where $2::text <> '' and l.visitor_id = $2::text and l.created_at >= now() - interval '24 hours'`,
      [ip, visitor, not],
    ),
    q.query<{ n: number }>(`select count(*)::int as n from orders where created_at >= now() - interval '1 hour' and id <> $3::uuid and ${sourceSql('', '$1', '$2')}`, [ip, visitor, not]),
    q.query(`select 1 from orders where lower(email) = $1::text and id <> $2::uuid and (${STANDING_PAID}) limit 1`, [email, not]),
  ])
  const name = `${i.firstName} ${i.lastName}`.trim().toLowerCase().replace(/\s+/g, ' ')
  const allNames = new Set([...names.rows.map((r) => r.name.replace(/\s+/g, ' ')).filter(Boolean), name])
  const allEmails = new Set([...emails.rows.map((r) => r.email).filter(Boolean), email])
  return {
    emailKind: emailKind(email),
    failedCards: failed.rows[0]?.n ?? 0,
    names: allNames.size,
    emails: allEmails.size,
    burst: burst.rows[0]?.n ?? 0,
    known: known.rows.length > 0,
  }
}

/**
 * Whether automations (recovery emails, AI calls) must wait for this person: one of their orders, by email or by
 * phone, is waiting for a person's check. They resume by themselves once it is cleared.
 */
export async function riskHold(q: Queryable, who: { email: string; phone?: string | null; orderId?: string | null }): Promise<boolean> {
  const phone = phoneKey(who.phone) ?? ''
  const { rows } = await q.query(
    `select 1 from orders where risk_review = 'pending' and status <> 'cancelled' and (id::text = $3::text or ${contactSql('', '$1', '$2')}) limit 1`,
    [who.email.trim().toLowerCase(), phone, who.orderId ?? ''],
  )
  return rows.length > 0
}

/** How long automations wait between checks while a review is open, and for how long at most. */
export const HOLD_RECHECK_MS = 6 * 3_600_000
export const HOLD_MAX_MS = 7 * 86_400_000
