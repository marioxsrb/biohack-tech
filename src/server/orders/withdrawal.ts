/**
 * The online withdrawal function (OUG 34/2014 art. 11^1, as amended by OUG 18/2026): a consumer states
 * on the site that they withdraw from a contract. The statement is stored with its exact content and
 * time. When it matches an order (number + the order's email), the customer receives an
 * acknowledgement on a durable medium (email) with that content, date and time, and the order shows it
 * in /admin. An unmatched statement is still stored and shown to the team: a withdrawal is never refused
 * because a field was mistyped.
 */
import 'server-only'
import { randomBytes, randomUUID } from 'node:crypto'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { jobs } from '@/server/jobs/outbox'
import { log } from '@/server/log'
import { orders } from './repository'

export type WithdrawalInput = { name: string; email: string; orderNumber: string; items: string; message: string }
export type WithdrawalField = keyof WithdrawalInput
export type Withdrawal = WithdrawalInput & { id: string; reference: string; orderId: string | null; createdAt: Date; status: string }

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

export function normalizeWithdrawal(raw: Record<string, unknown>): WithdrawalInput {
  return {
    name: clean(raw.name, 120),
    email: clean(raw.email, 160).toLowerCase(),
    orderNumber: clean(raw.orderNumber, 40).toUpperCase().replace(/^#/, ''),
    items: clean(raw.items, 500) || 'Toate produsele din comandă',
    message: clean(raw.message, 1000),
  }
}

export function validateWithdrawal(w: WithdrawalInput): Partial<Record<WithdrawalField, string>> {
  const e: Partial<Record<WithdrawalField, string>> = {}
  if (w.name.length < 3) e.name = 'Completează numele și prenumele.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(w.email)) e.email = 'Completează adresa de email folosită la comandă.'
  if (w.orderNumber.length < 4) e.orderNumber = 'Completează numărul comenzii. Îl găsești în emailul de confirmare.'
  return e
}

const toWithdrawal = (r: Record<string, unknown>): Withdrawal => ({
  id: r.id as string,
  reference: r.reference as string,
  orderId: (r.order_id as string) ?? null,
  orderNumber: r.order_number as string,
  name: r.name as string,
  email: r.email as string,
  items: r.items as string,
  message: (r.message as string) ?? '',
  status: r.status as string,
  createdAt: new Date(r.created_at as string),
})

export async function recordWithdrawal(w: WithdrawalInput): Promise<{ withdrawal: Withdrawal; matched: boolean }> {
  const db = await getDb()
  const result = await db.tx(async (t) => {
    const order = await orders.byNumber(t, w.orderNumber)
    const matched = !!order && order.email === w.email
    const id = randomUUID()
    const reference = `RET-${randomBytes(6).toString('hex').toUpperCase()}`
    const { rows } = await t.query(
      `insert into withdrawal_requests (id, reference, order_id, order_number, name, email, items, message)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [id, reference, matched ? order.id : null, w.orderNumber, w.name, w.email, w.items, w.message],
    )
    if (matched) {
      await orders.event(t, order.id, 'withdrawal.requested', 'checkout', { reference })
      if (getConfig().email.transport !== 'none') {
        await jobs.enqueue(t, { kind: 'email.send', orderId: order.id, dedupeKey: `email:withdrawal_received:${id}`, payload: { template: 'withdrawal_received', withdrawalId: id } })
      }
    }
    return { withdrawal: toWithdrawal(rows[0]), matched }
  })
  log.info('withdrawal.recorded', { reference: result.withdrawal.reference, matched: result.matched, orderId: result.withdrawal.orderId })
  return result
}

export const withdrawals = {
  async byId(id: string) {
    const db = await getDb()
    const { rows } = await db.query('select * from withdrawal_requests where id = $1', [id])
    return rows[0] ? toWithdrawal(rows[0]) : null
  },
  async byReference(reference: string) {
    const db = await getDb()
    const { rows } = await db.query('select * from withdrawal_requests where reference = $1', [reference])
    return rows[0] ? toWithdrawal(rows[0]) : null
  },
  async recent(limit = 50) {
    const db = await getDb()
    return (await db.query('select * from withdrawal_requests order by created_at desc limit $1', [limit])).rows.map(toWithdrawal)
  },
  async forOrder(orderId: string) {
    const db = await getDb()
    return (await db.query('select * from withdrawal_requests where order_id = $1 order by created_at', [orderId])).rows.map(toWithdrawal)
  },
}
