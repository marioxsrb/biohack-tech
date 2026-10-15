/**
 * Cost control for the website assistant: one row per Bucharest day with requests, tokens and errors. Every turn
 * counts before the model is called (so the daily cap holds even when many arrive at once) and adds its tokens when
 * it ends. The cap (ASSISTANT_DAILY_REQUESTS, default 1500) answers politely instead of calling the model.
 */
import 'server-only'
import type { Queryable } from '@/server/db'
import { errText, log } from '@/server/log'

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

export const dailyLimit = () => {
  const n = Number(process.env.ASSISTANT_DAILY_REQUESTS)
  return Number.isInteger(n) && n > 0 ? n : 1500
}

export type Usage = { day: string; requests: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; errors: number; quotaErrors: number }

export const assistantUsage = {
  /** Counts one request; false when today's cap is already reached (nothing is counted then). */
  async take(q: Queryable): Promise<boolean> {
    const { rows } = await q.query<{ requests: number }>(
      `insert into assistant_usage (day, requests) values ($1, 1)
       on conflict (day) do update set requests = assistant_usage.requests + 1, updated_at = now()
       where assistant_usage.requests < $2
       returning requests`,
      [today(), dailyLimit()],
    )
    return rows.length > 0
  },

  /** Adds a finished turn's tokens (never fails the turn). */
  async record(q: Queryable, u: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number }) {
    await q
      .query(
        `update assistant_usage set input_tokens = input_tokens + $2, output_tokens = output_tokens + $3,
           cache_read_tokens = cache_read_tokens + $4, cache_write_tokens = cache_write_tokens + $5, updated_at = now() where day = $1`,
        [today(), u.input ?? 0, u.output ?? 0, u.cacheRead ?? 0, u.cacheWrite ?? 0],
      )
      .catch((e) => log.warn('assistant.usage_failed', { error: errText(e) }))
  },

  async error(q: Queryable, quota: boolean) {
    await q
      .query(`update assistant_usage set errors = errors + 1, quota_errors = quota_errors + $2, updated_at = now() where day = $1`, [today(), quota ? 1 : 0])
      .catch((e) => log.warn('assistant.usage_failed', { error: errText(e) }))
  },

  async recent(q: Queryable, days = 7): Promise<Usage[]> {
    const { rows } = await q.query<Record<string, unknown>>(`select * from assistant_usage order by day desc limit $1`, [days])
    return rows.map((r) => ({
      day: (r.day instanceof Date ? r.day.toISOString() : String(r.day)).slice(0, 10),
      requests: Number(r.requests),
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
      cacheReadTokens: Number(r.cache_read_tokens),
      cacheWriteTokens: Number(r.cache_write_tokens),
      errors: Number(r.errors),
      quotaErrors: Number(r.quota_errors),
    }))
  },
}

/** A provider answer that means "no more credit or capacity" (billing, rate limit, overload), not a bug. */
export function isQuotaError(e: unknown): boolean {
  const x = e as { statusCode?: number; status?: number; message?: string; responseBody?: string } | null
  const status = x?.statusCode ?? x?.status
  if (status === 402 || status === 429 || status === 529) return true
  return /credit balance|billing|quota|rate.?limit|overloaded/i.test(`${x?.message ?? ''} ${x?.responseBody ?? ''}`)
}
