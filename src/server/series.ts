/**
 * Time series for the admin's custom charts: one metric, per day or week, optionally split by one dimension
 * (site, source, payment, product, call outcome), over a range of Bucharest days. Aggregates only;
 * nothing personal. The same orders count as in the report (server/report.ts): standing orders only.
 */
import 'server-only'
import type { Queryable } from '@/server/db'
import { SITES } from '@/server/report'

const TZ = 'Europe/Bucharest'
const STANDS = `o.kind = 'checkout' and o.status not in ('cancelled', 'abandoned') and (o.payment_method <> 'card' or o.payment_status in ('paid', 'partially_refunded', 'refunded'))`

export const METRICS = {
  sessions: { label: 'Vizite (sesiuni)', unit: 'count', by: ['site', 'source'] },
  views: { label: 'Afișări de pagini', unit: 'count', by: ['site', 'source'] },
  leads: { label: 'Leaduri', unit: 'count', by: ['site', 'source', 'product'] },
  orders: { label: 'Comenzi valide', unit: 'count', by: ['site', 'payment', 'source'] },
  revenue: { label: 'Valoare comenzi (lei)', unit: 'lei', by: ['site', 'payment', 'source', 'product'] },
  units: { label: 'Bucăți vândute', unit: 'count', by: ['product', 'site'] },
  aov: { label: 'Coș mediu (lei)', unit: 'lei', by: ['site', 'payment'] },
  conversion: { label: 'Conversie (comenzi / sesiuni, %)', unit: 'percent', by: ['site'] },
  calls: { label: 'Apeluri AI', unit: 'count', by: ['outcome'] },
  welcome: { label: 'Înscrieri popup 10%', unit: 'count', by: [] },
  codes: { label: 'Comenzi cu cod promoțional', unit: 'count', by: ['code'] },
} as const

export type Metric = keyof typeof METRICS
export type Breakdown = 'none' | 'site' | 'source' | 'payment' | 'product' | 'outcome' | 'code'
export const BREAKDOWNS: Record<Breakdown, string> = {
  none: 'Fără împărțire',
  site: 'Pe site',
  source: 'Pe sursă (utm_source)',
  payment: 'Pe metoda de plată',
  product: 'Pe produs',
  outcome: 'Pe rezultatul apelului',
  code: 'Pe cod',
}

export type SeriesQuery = { metric: Metric; by: Breakdown; days: number; grain: 'day' | 'week' }
export type SeriesResult = { metric: Metric; label: string; unit: string; buckets: string[]; series: { key: string; label: string; values: number[] }[] }

const SITE_LABEL = Object.fromEntries(SITES.map((s) => [s.site, s.label]))
const LABELS: Record<string, Record<string, string>> = {
  site: SITE_LABEL,
  payment: { cash_on_delivery: 'ramburs', card: 'card', bank_transfer: 'transfer' },
}

/** Visits counted on the former acces.<domain> (closed 20.10.2026) belong to the main store now. */
const VISIT_SITE = `case when site = 'acces' then 'main' else site end`
const LEAD_SITE = `case when coalesce(landing_host,'') like '%biohack-tech.net' or coalesce(landing_host,'') like 'net.localhost%' then 'net' when split_part(coalesce(landing_host,''), '.', 1) in ('calm','focus','amber') then split_part(landing_host, '.', 1) else 'main' end`
const ORDER_SITE = `case when o.site = 'net' then 'net' when o.attribution->>'landing' in ('calm','focus','amber') then o.attribution->>'landing' else 'main' end`

/** The validated query (unknown values fall back to safe defaults) . */
export function parseSeriesQuery(raw: Record<string, unknown>): SeriesQuery {
  const metric = (Object.keys(METRICS) as Metric[]).includes(raw.metric as Metric) ? (raw.metric as Metric) : 'revenue'
  const allowed = METRICS[metric].by as readonly string[]
  const by = allowed.includes(String(raw.by)) ? (raw.by as Breakdown) : 'none'
  const days = [7, 14, 30, 60, 90, 180, 365].includes(Number(raw.days)) ? Number(raw.days) : 30
  const grain = raw.grain === 'week' ? 'week' : 'day'
  return { metric, by, days, grain }
}

/** One row per (bucket, key) with a value; the SQL for each metric and breakdown. */
function sqlFor(q: SeriesQuery): string {
  const b = (col: string) => (q.grain === 'week' ? `date_trunc('week', ${col})::date` : `${col}::date`)
  const localTs = (col: string) => `(${col} at time zone '${TZ}')`
  const k = (expr: string) => (q.by === 'none' ? `'total'` : expr)
  switch (q.metric) {
    case 'sessions':
    case 'views': {
      const key = q.by === 'site' ? VISIT_SITE : `coalesce(nullif(source,''),'(direct)')`
      return `select ${b('day')} as bucket, ${k(key)} as key, sum(${q.metric})::float as value from visit_stats where day >= $1::date and day <= $2::date group by 1, 2`
    }
    case 'leads': {
      const key = q.by === 'site' ? LEAD_SITE : q.by === 'product' ? `case when product_id = 'cart' then 'coș' else product_id end` : `coalesce(nullif(attribution->'utm'->>'utm_source',''),'(direct)')`
      return `select ${b(localTs('created_at'))} as bucket, ${k(key)} as key, count(*)::float as value from leads where ${localTs('created_at')}::date between $1::date and $2::date group by 1, 2`
    }
    case 'orders':
    case 'revenue':
    case 'aov':
    case 'codes': {
      const key =
        q.by === 'site' ? ORDER_SITE : q.by === 'payment' ? 'o.payment_method' : q.by === 'code' ? `coalesce(o.promo_code,'')` : `coalesce(nullif(o.attribution->'utm'->>'utm_source',''),'(direct)')`
      if (q.metric === 'revenue' && q.by === 'product')
        return `select ${b(localTs('o.created_at'))} as bucket, i.product_name as key, sum(i.line_total_minor * o.fx_rate)::float / 100 as value from order_items i join orders o on o.id = i.order_id
                where ${STANDS} and ${localTs('o.created_at')}::date between $1::date and $2::date group by 1, 2`
      const value = q.metric === 'orders' || q.metric === 'codes' ? 'count(*)::float' : q.metric === 'revenue' ? 'sum((o.total_minor - o.refunded_minor) * o.fx_rate)::float / 100' : 'avg((o.total_minor - o.refunded_minor) * o.fx_rate)::float / 100'
      const extra = q.metric === 'codes' ? `and o.promo_code is not null` : ''
      return `select ${b(localTs('o.created_at'))} as bucket, ${k(key)} as key, ${value} as value from orders o where ${STANDS} ${extra} and ${localTs('o.created_at')}::date between $1::date and $2::date group by 1, 2`
    }
    case 'units': {
      const key = q.by === 'site' ? ORDER_SITE : 'i.product_name'
      return `select ${b(localTs('o.created_at'))} as bucket, ${k(key)} as key, sum(i.quantity)::float as value from order_items i join orders o on o.id = i.order_id
              where ${STANDS} and ${localTs('o.created_at')}::date between $1::date and $2::date group by 1, 2`
    }
    case 'conversion':
      // Orders and sessions per bucket (and site), divided below.
      return `select bucket, key, sum(o)::float as orders, sum(s)::float as sessions, 0::float as value from (
                select ${b(localTs('o.created_at'))} as bucket, ${k(ORDER_SITE)} as key, count(*) as o, 0 as s from orders o where ${STANDS} and ${localTs('o.created_at')}::date between $1::date and $2::date group by 1, 2
                union all
                select ${b('day')}, ${k('site')}, 0, sum(sessions) from visit_stats where day >= $1::date and day <= $2::date group by 1, 2
              ) x group by 1, 2`
    case 'calls':
      return `select ${b(localTs('created_at'))} as bucket, ${k(`coalesce(outcome, status)`)} as key, count(*)::float as value from calls where status <> 'dry_run' and ${localTs('created_at')}::date between $1::date and $2::date group by 1, 2`
    case 'welcome':
      return `select ${b(localTs('created_at'))} as bucket, 'total' as key, count(*)::float as value from welcome_signups where ${localTs('created_at')}::date between $1::date and $2::date group by 1, 2`
  }
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
const todayBucharest = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

/** Every bucket in the range, so empty days show as 0 (a gap in the data is never a missing point). */
function bucketsFor(first: string, last: string, grain: 'day' | 'week') {
  const out: string[] = []
  const d = new Date(`${first}T00:00:00Z`)
  if (grain === 'week') d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  const end = new Date(`${last}T00:00:00Z`)
  while (d <= end) {
    out.push(iso(d))
    d.setUTCDate(d.getUTCDate() + (grain === 'week' ? 7 : 1))
  }
  return out
}

/** At most this many series; the rest add up to "Altele" (the palette has 8 hues). */
const MAX_SERIES = 7

export async function buildSeries(db: Queryable, q: SeriesQuery): Promise<SeriesResult> {
  const last = todayBucharest()
  const first = iso(new Date(Date.parse(`${last}T00:00:00Z`) - (q.days - 1) * 86_400_000))
  const { rows } = await db.query<{ bucket: string | Date; key: string; value: number; orders?: number; sessions?: number }>(sqlFor(q), [first, last])
  const buckets = bucketsFor(first, last, q.grain)
  const at = new Map(buckets.map((b, i) => [b, i]))
  const byKey = new Map<string, number[]>()
  const extra = new Map<string, { o: number[]; s: number[] }>()
  for (const r of rows) {
    const bucket = typeof r.bucket === 'string' ? r.bucket.slice(0, 10) : iso(r.bucket)
    const i = at.get(bucket)
    if (i === undefined) continue
    const key = String(r.key ?? '')
    if (q.metric === 'conversion') {
      const e = extra.get(key) ?? { o: buckets.map(() => 0), s: buckets.map(() => 0) }
      e.o[i] += Number(r.orders ?? 0)
      e.s[i] += Number(r.sessions ?? 0)
      extra.set(key, e)
      continue
    }
    const arr = byKey.get(key) ?? buckets.map(() => 0)
    arr[i] += Number(r.value ?? 0)
    byKey.set(key, arr)
  }
  if (q.metric === 'conversion') for (const [key, e] of extra) byKey.set(key, e.o.map((o, i) => (e.s[i] ? Math.round((o / e.s[i]) * 1000) / 10 : 0)))
  // Largest first; the tail folds into "Altele" (never for averages and rates, which do not add up).
  let entries = [...byKey.entries()].sort((a, b) => b[1].reduce((s, x) => s + x, 0) - a[1].reduce((s, x) => s + x, 0))
  const additive = q.metric !== 'aov' && q.metric !== 'conversion'
  if (entries.length > MAX_SERIES + 1) {
    const head = entries.slice(0, MAX_SERIES)
    const tail = entries.slice(MAX_SERIES)
    entries = additive ? [...head, ['__other', buckets.map((_, i) => tail.reduce((s, [, v]) => s + v[i], 0))]] : head
  }
  const labels = LABELS[q.by] ?? {}
  const round = (v: number) => (METRICS[q.metric].unit === 'lei' ? Math.round(v) : Math.round(v * 10) / 10)
  return {
    metric: q.metric,
    label: METRICS[q.metric].label,
    unit: METRICS[q.metric].unit,
    buckets,
    series: (entries.length ? entries : [['total', buckets.map(() => 0)] as [string, number[]]]).map(([key, values]) => ({
      key,
      label: key === '__other' ? 'Altele' : key === 'total' ? METRICS[q.metric].label : (labels[key] ?? (key || '(fără)')),
      values: values.map(round),
    })),
  }
}
