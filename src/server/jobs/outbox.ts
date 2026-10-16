/**
 * Outbox: every side effect (CRM sync, invoice, email) is a row, written in the same
 * transaction as the order change that caused it. A unique dedupe key means the same
 * effect can never be queued twice, whatever retries or replays happen upstream.
 */
import 'server-only'
import type { Queryable, Row } from '@/server/db'

export type JobKind =
  | 'ghl.sync'
  | 'marketing.sync'
  | 'fgo.invoice'
  | 'fgo.storno'
  | 'email.send'
  | 'notify.send'
  | 'order.abandon_check'
  | 'stripe.reconcile'
  | 'order.transfer_expiry'
  | 'upsell.release'
  | 'ghl.enquiry'
  | 'ghl.lead'
  | 'ghl.welcome'
  | 'email.reply'
  | 'lead.recovery'
  | 'call.attempt'
  | 'call.check'
  | 'call.link'
  | 'call.notify'
  | 'email.welcome'
  | 'agent.sync'
  | 'ghl.call'
  | 'support.notify'
  | 'fx.refresh'
  | 'meta.purchase'
export type JobStatus = 'pending' | 'running' | 'retry' | 'done' | 'failed' | 'skipped'

export type Job = {
  id: number
  orderId: string | null
  kind: JobKind
  dedupeKey: string
  payload: Record<string, unknown>
  status: JobStatus
  attempts: number
  runAt: Date
  lastError: string | null
  createdAt: Date
}

export type NewJob = { kind: JobKind; dedupeKey: string; orderId?: string; payload?: Record<string, unknown>; runAt?: Date }

export const MAX_ATTEMPTS = 8
/** 1, 2, 4, 8... minutes, capped at 6 hours. */
export const backoffMs = (attempt: number) => Math.min(6 * 3600_000, 60_000 * 2 ** Math.max(0, attempt - 1))

const toJob = (r: Row): Job => ({
  id: Number(r.id),
  orderId: (r.order_id as string) ?? null,
  kind: r.kind as JobKind,
  dedupeKey: r.dedupe_key as string,
  payload: (r.payload as Record<string, unknown>) ?? {},
  status: r.status as JobStatus,
  attempts: Number(r.attempts),
  runAt: new Date(r.run_at as string),
  lastError: (r.last_error as string) ?? null,
  createdAt: new Date(r.created_at as string),
})

export const jobs = {
  /** Returns true when the job was new. */
  async enqueue(q: Queryable, j: NewJob): Promise<boolean> {
    const { rows } = await q.query(
      `insert into jobs (order_id, kind, dedupe_key, payload, run_at) values ($1,$2,$3,$4,$5)
       on conflict (dedupe_key) do nothing returning id`,
      [j.orderId ?? null, j.kind, j.dedupeKey, JSON.stringify(j.payload ?? {}), j.runAt ?? new Date()],
    )
    return rows.length > 0
  },

  /** Claims due jobs; a claim expires after 5 minutes so a crashed worker's jobs come back. */
  async claim(q: Queryable, limit = 10): Promise<Job[]> {
    const { rows } = await q.query(
      `update jobs set status = 'running', attempts = attempts + 1, locked_until = now() + interval '5 minutes', updated_at = now()
       where id in (
         select id from jobs
         where (status in ('pending','retry') and run_at <= now()) or (status = 'running' and locked_until < now())
         order by run_at, id limit $1 for update skip locked)
       returning *`,
      [limit],
    )
    return rows.map(toJob).sort((a, b) => a.id - b.id)
  },

  done: (q: Queryable, id: number, status: 'done' | 'skipped' = 'done', note?: string) =>
    q.query("update jobs set status = $2, locked_until = null, last_error = $3, updated_at = now() where id = $1", [id, status, note ?? null]),

  async fail(q: Queryable, job: Job, error: string, permanent = false) {
    const dead = permanent || job.attempts >= MAX_ATTEMPTS
    await q.query(
      `update jobs set status = $2, locked_until = null, last_error = $3, run_at = $4, updated_at = now() where id = $1`,
      [job.id, dead ? 'failed' : 'retry', error.slice(0, 500), new Date(Date.now() + backoffMs(job.attempts))],
    )
    return dead
  },

  /** Puts failed jobs of an order (or one job) back in the queue. */
  retry: (q: Queryable, where: { orderId?: string; id?: number }) =>
    q.query(
      `update jobs set status = 'pending', attempts = 0, run_at = now(), last_error = null, updated_at = now()
       where status in ('failed','retry') and ($1::uuid is null or order_id = $1) and ($2::bigint is null or id = $2)`,
      [where.orderId ?? null, where.id ?? null],
    ),

  async byId(q: Queryable, id: number) {
    const { rows } = await q.query('select * from jobs where id = $1', [id])
    return rows[0] ? toJob(rows[0]) : null
  },

  async forOrder(q: Queryable, orderId: string) {
    return (await q.query('select * from jobs where order_id = $1 order by id', [orderId])).rows.map(toJob)
  },

  async problems(q: Queryable, limit = 50) {
    return (await q.query("select * from jobs where status in ('failed','retry') order by updated_at desc limit $1", [limit])).rows.map(toJob)
  },
}
