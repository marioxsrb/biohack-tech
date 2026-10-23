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
import { BLOCKED, HOLD, isDisposable } from '@/config/risk-blocklist'

export const REVIEW_AT = 40
/** Failed payments from the same network, browser, email or phone after which the site takes no more orders from them. */
export const FAILED_CARD_LIMIT = 3
export const FAILED_WINDOW_DAYS = 30

/** Addresses that are not anyone's (examples, tests). */
const PLACEHOLDER = new Set(['example.com', 'example.org', 'example.net', 'test.com', 'test.ro', 'email.com', 'domain.com'])

export type EmailKind = 'disposable' | 'placeholder' | null

export function emailKind(email: string): EmailKind {
  const domain = email.trim().toLowerCase().split('@')[1] ?? ''
  if (isDisposable(email)) return 'disposable'
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
  /** The same, over FAILED_WINDOW_DAYS: at FAILED_CARD_LIMIT the person has to call (no order on any method). */
  failedRecent: number
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

/** A paid order, or one a person cleared (alias o). */
const STANDING_PAID = `o.payment_status in ('paid', 'partially_refunded') or o.risk_review = 'cleared'`
const NO_ORDER = '00000000-0000-0000-0000-000000000000'

/** Reads the signals for an order about to be placed (or just placed: pass its id to leave it out). */
export async function riskSignals(q: Queryable, i: RiskInput): Promise<RiskSignals> {
  const email = i.email.trim().toLowerCase()
  const phone = phoneKey(i.phone) ?? ''
  const ip = i.ip ?? ''
  const visitor = i.visitor ?? ''
  const not = i.excludeOrderId ?? NO_ORDER
  // One round trip: every signal is a subquery of the same statement.
  const { rows } = await q.query<{ failed: number; failed_recent: number; names: string[] | null; emails: string[] | null; burst: number; known: boolean }>(
    `select
       (select count(*)::int from order_events e join orders o on o.id = e.order_id
         where e.type = 'payment.failed' and e.created_at >= now() - interval '24 hours' and o.id <> $5::uuid
           and (${contactSql('o.', '$1', '$2')} or ${sourceSql('o.', '$3', '$4')})) as failed,
       (select count(*)::int from order_events e join orders o on o.id = e.order_id
         where e.type = 'payment.failed' and e.created_at >= now() - make_interval(days => ${FAILED_WINDOW_DAYS}) and o.id <> $5::uuid
           and (${contactSql('o.', '$1', '$2')} or ${sourceSql('o.', '$3', '$4')})) as failed_recent,
       (select array_agg(distinct lower(trim(coalesce(o.customer->>'firstName', '') || ' ' || coalesce(o.customer->>'lastName', '')))) from orders o
         where o.created_at >= now() - interval '7 days' and o.id <> $5::uuid and ${contactSql('o.', '$1', '$2')}) as names,
       (select array_agg(distinct x.email) from (
          select lower(o.email) as email from orders o where o.created_at >= now() - interval '24 hours' and o.id <> $5::uuid and ${sourceSql('o.', '$3', '$4')}
          union select lower(l.email) from leads l where $4::text <> '' and l.visitor_id = $4::text and l.created_at >= now() - interval '24 hours') x) as emails,
       (select count(*)::int from orders o where o.created_at >= now() - interval '1 hour' and o.id <> $5::uuid and ${sourceSql('o.', '$3', '$4')}) as burst,
       exists (select 1 from orders o where lower(o.email) = $1::text and o.id <> $5::uuid and (${STANDING_PAID})) as known`,
    [email, phone, ip, visitor, not],
  )
  const r = rows[0]
  const name = `${i.firstName} ${i.lastName}`.trim().toLowerCase().replace(/\s+/g, ' ')
  const allNames = new Set([...(r?.names ?? []).map((n) => n.replace(/\s+/g, ' ')).filter(Boolean), name])
  const allEmails = new Set([...(r?.emails ?? []).filter(Boolean), email])
  return {
    emailKind: emailKind(email),
    failedCards: Number(r?.failed ?? 0),
    failedRecent: Number(r?.failed_recent ?? 0),
    names: allNames.size,
    emails: allEmails.size,
    burst: Number(r?.burst ?? 0),
    known: !!r?.known,
  }
}

/**
 * Whether automations (recovery emails, AI calls) must wait for this person: one of their orders, by email or by
 * phone, is waiting for a person's check, and no later check cleared them. They resume by themselves once cleared.
 */
export async function riskHold(q: Queryable, who: { email: string; phone?: string | null; orderId?: string | null }): Promise<boolean> {
  const phone = phoneKey(who.phone) ?? ''
  const { rows } = await q.query(
    // A person clearing one of this person's orders vouches for them: earlier flagged attempts no longer hold anything.
    `select 1 from orders p where p.risk_review = 'pending' and p.status <> 'cancelled' and (p.id::text = $3::text or ${contactSql('p.', '$1', '$2')})
       and not exists (select 1 from orders c where c.risk_review = 'cleared' and c.risk_reviewed_at >= p.created_at and ${contactSql('c.', '$1', '$2')})
     limit 1`,
    [who.email.trim().toLowerCase(), phone, who.orderId ?? ''],
  )
  return rows.length > 0
}

const plain = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(str|strada|nr|numarul)\b/g, '').replace(/[^a-z0-9]/g, '')
const domainOf = (email: string) => email.trim().toLowerCase().split('@')[1] ?? ''

export type ListInput = { email: string; phone: string; ip: string | null; city?: string; address?: string }

/** A temporary inbox, or the attack's email, phone or network (config/risk-blocklist.ts): no order is written. */
export function blocked(i: ListInput): boolean {
  const phone = phoneKey(i.phone)
  const email = i.email.trim().toLowerCase()
  return (
    isDisposable(email) ||
    BLOCKED.emailDomains.includes(domainOf(email)) ||
    BLOCKED.emails.includes(email) ||
    (!!phone && BLOCKED.phones.includes(phone)) ||
    (!!i.ip && BLOCKED.ipKeys.includes(i.ip))
  )
}

/** The attack's email domain, a phone or a delivery address it used: the order waits for a person. */
export function held(i: ListInput): boolean {
  const phone = phoneKey(i.phone)
  if (HOLD.emailDomains.includes(domainOf(i.email)) || (!!phone && HOLD.phones.includes(phone))) return true
  const city = plain(i.city ?? '')
  const street = plain(i.address ?? '')
  // The street and its number, and nothing more digits after it (Piața Unirii 2, never Piața Unirii 25).
  return HOLD.addresses.some((a) => a.city === city && street.startsWith(a.street) && !/^\d/.test(street.slice(a.street.length)))
}

/** The pseudonymised identifiers are kept this long after the order (privacy policy, „Prevenirea fraudei”). */
export const RISK_SIGNAL_RETENTION_DAYS = 90

/** Clears the network fingerprint and the browser id of older orders; the score and reasons stay in the history. */
export async function purgeRiskSignals(q: Queryable, now = new Date()) {
  const { rows } = await q.query(
    `update orders set risk_ip = null, risk_visitor = null where created_at < $1 and (risk_ip is not null or risk_visitor is not null) returning id`,
    [new Date(now.getTime() - RISK_SIGNAL_RETENTION_DAYS * 86_400_000)],
  )
  return rows.length
}

/** How long automations wait between checks while a review is open, and for how long at most. */
export const HOLD_RECHECK_MS = 6 * 3_600_000
export const HOLD_MAX_MS = 7 * 86_400_000
