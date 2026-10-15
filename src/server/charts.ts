/** The custom charts on the admin dashboard (admin_charts): a title and a series query each. */
import 'server-only'
import { randomUUID } from 'node:crypto'
import type { Queryable } from '@/server/db'
import { METRICS, parseSeriesQuery, type SeriesQuery } from '@/server/series'

export type ChartConfig = SeriesQuery & { kind: 'line' | 'bar' }
export type SavedChart = { id: string; title: string; config: ChartConfig }

export const parseChartConfig = (raw: Record<string, unknown>): ChartConfig => ({ ...parseSeriesQuery(raw), kind: raw.kind === 'bar' ? 'bar' : 'line' })

export const charts = {
  async list(q: Queryable): Promise<SavedChart[]> {
    const { rows } = await q.query('select id, title, config from admin_charts order by created_at')
    return rows.map((r) => ({ id: r.id as string, title: r.title as string, config: parseChartConfig(r.config as Record<string, unknown>) }))
  },
  async add(q: Queryable, title: string, raw: Record<string, unknown>) {
    const config = parseChartConfig(raw)
    const id = randomUUID()
    await q.query('insert into admin_charts (id, title, config) values ($1, $2, $3)', [id, (title.trim() || METRICS[config.metric].label).slice(0, 80), JSON.stringify(config)])
    return { id, title, config }
  },
  async remove(q: Queryable, id: string) {
    if (!/^[0-9a-f-]{36}$/.test(id)) return false
    return (await q.query('delete from admin_charts where id = $1 returning id', [id])).rows.length > 0
  },
}
