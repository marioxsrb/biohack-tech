/**
 * The admin's business numbers, from Supabase only (never from Meta or browser events): the store's funnel
 * (biohack-tech.ro and its landings together), from the anonymous visit counts through leads, checkouts and
 * orders to confirmed revenue and recovery.
 *
 * Every query is an aggregate over an indexed date range; nothing personal leaves the database.
 */
import 'server-only'
import { getProduct, products, type ProductId } from '@/content/catalog'
import type { Queryable } from '@/server/db'

export type StatsFilter = { from: Date; to: Date; product?: ProductId; source?: string; campaign?: string }

export type FunnelStats = {
  sessions: number
  views: number
  productViews: number
  leads: number
  /** Distinct people (email) behind the leads: the duplicate filter. */
  people: number
  checkouts: number
  abandoned: number
  recoveryEmails: number
  recoveryLeads: number
  orders: number
  paidOrders: number
  revenueMinor: number
  recoveredOrders: number
}

const TZ = 'Europe/Bucharest'
const PAID = "('paid','partially_refunded')"

/** Builds the shared WHERE pieces for one table: date range, campaign, product. */
function where(f: StatsFilter, t: { date: string; source: string; campaign: string; product: string | null; day?: boolean }, start = 1) {
  const params: unknown[] = [f.from, f.to]
  // visit_stats keeps Bucharest calendar days: the range's instants become Bucharest dates.
  const bound = (n: number) => (t.day ? `($${n}::timestamptz at time zone '${TZ}')::date` : `$${n}`)
  const parts = [`${t.date} >= ${bound(start)} and ${t.date} < ${bound(start + 1)}`]
  const add = (sql: string, v: unknown) => {
    params.push(v)
    parts.push(sql.replaceAll('?', `$${start + params.length - 1}`))
  }
  if (f.source) add(`${t.source} = ?`, f.source)
  if (f.campaign) add(`${t.campaign} = ?`, f.campaign)
  if (f.product && t.product) add(t.product, f.product)
  return { sql: parts.join(' and '), params }
}

export async function funnelStats(q: Queryable, f: StatsFilter): Promise<FunnelStats> {
  const slug = f.product ? getProduct(f.product)?.slug : undefined
  const v = where(f, { date: 'day', source: 'source', campaign: 'campaign', product: null, day: true })
  const productPages = products.map((p) => p.slug)
  const visits = await q.query<{ sessions: number; views: number; product_views: number }>(
    `select sum(sessions)::int as sessions, sum(views)::int as views,
            sum(views) filter (where page = any($${v.params.length + 1}::text[]))::int as product_views
     from visit_stats where ${v.sql} ${slug ? `and page = $${v.params.length + 2}` : ''}`,
    [...v.params, productPages, ...(slug ? [slug] : [])],
  )
  const l = where(f, {
    date: 'created_at',
    source: "coalesce(attribution->'utm'->>'utm_source', '')",
    campaign: "coalesce(attribution->'utm'->>'utm_campaign', '')",
    // The product filter on leads: its own interest or a line of its checkout's cart.
    product: "(product_id = ? or cart @> jsonb_build_array(jsonb_build_object('productId', ?::text)))",
  })
  const leads = await q.query<{ leads: number; people: number; checkouts: number; abandoned: number; recovery_emails: number; recovery_leads: number }>(
    `select count(*)::int as leads, count(distinct email)::int as people, count(checkout_started_at)::int as checkouts,
            count(*) filter (where abandonment = 'checkout_abandoned')::int as abandoned,
            coalesce(sum(recovery_sent), 0)::int as recovery_emails, count(*) filter (where recovery_sent > 0)::int as recovery_leads
     from leads where ${l.sql}`,
    l.params,
  )
  const o = where(f, {
    date: 'o.created_at',
    source: "coalesce(o.attribution->'utm'->>'utm_source', '')",
    campaign: "coalesce(o.attribution->'utm'->>'utm_campaign', '')",
    product: 'exists (select 1 from order_items i where i.order_id = o.id and i.product_id = ?)',
  })
  // Orders: placed checkouts (card orders count once paid; cash on delivery and transfer when placed) that still stand:
  // an expired transfer, a refused parcel, or money that arrived after a cancellation (to refund) are not sales.
  const orders = await q.query<{ orders: number; paid_orders: number; revenue: number; recovered: number }>(
    `select count(*) filter (where o.payment_method <> 'card' or o.payment_status in ${PAID} or o.payment_status = 'refunded')::int as orders,
            count(*) filter (where o.payment_status in ${PAID})::int as paid_orders,
            coalesce(sum((o.total_minor - o.refunded_minor) * o.fx_rate) filter (where o.payment_status in ${PAID}), 0)::int as revenue,
            count(*) filter (where (o.payment_method <> 'card' or o.payment_status in ${PAID})
              and (o.attribution->>'entry' = 'recovery' or exists (select 1 from leads r where r.id = o.lead_id and r.recovery_sent > 0 and o.created_at > r.last_recovery_at)))::int as recovered
     from orders o where o.kind = 'checkout' and o.status not in ('cancelled', 'abandoned') and ${o.sql}`,
    o.params,
  )
  const vi = visits.rows[0]
  const le = leads.rows[0]
  const or = orders.rows[0]
  return {
    sessions: vi?.sessions ?? 0,
    views: vi?.views ?? 0,
    productViews: vi?.product_views ?? 0,
    leads: le?.leads ?? 0,
    people: le?.people ?? 0,
    checkouts: le?.checkouts ?? 0,
    abandoned: le?.abandoned ?? 0,
    recoveryEmails: le?.recovery_emails ?? 0,
    recoveryLeads: le?.recovery_leads ?? 0,
    orders: or?.orders ?? 0,
    paidOrders: or?.paid_orders ?? 0,
    revenueMinor: or?.revenue ?? 0,
    recoveredOrders: or?.recovered ?? 0,
  }
}

/** Daily sessions, leads and orders, for the trend bars. */
export async function dailyTrend(q: Queryable, f: StatsFilter) {
  const { rows } = await q.query<{ day: string; sessions: number; leads: number; orders: number }>(
    `with days as (select generate_series(($1::timestamptz at time zone '${TZ}')::date, (($2::timestamptz - interval '1 second') at time zone '${TZ}')::date, '1 day')::date as day),
          v as (select day, sum(sessions)::int as sessions from visit_stats where day >= ($1::timestamptz at time zone '${TZ}')::date and day < ($2::timestamptz at time zone '${TZ}')::date group by 1),
          l as (select (created_at at time zone 'Europe/Bucharest')::date as day, count(*)::int as leads from leads where created_at >= $1 and created_at < $2 group by 1),
          o as (select (created_at at time zone 'Europe/Bucharest')::date as day, count(*)::int as orders
                from orders where kind = 'checkout' and status not in ('cancelled', 'abandoned') and created_at >= $1 and created_at < $2 and (payment_method <> 'card' or payment_status in ${PAID}) group by 1)
     select to_char(d.day, 'YYYY-MM-DD') as day, coalesce(v.sessions,0) as sessions, coalesce(l.leads,0) as leads, coalesce(o.orders,0) as orders
     from days d left join v on v.day = d.day left join l on l.day = d.day left join o on o.day = d.day
     order by d.day`,
    [f.from, f.to],
  )
  return rows
}

/** The campaigns seen in the range, for the filter (from visits, leads and orders). */
export async function campaignOptions(q: Queryable, from: Date, to: Date) {
  const { rows } = await q.query<{ source: string; campaign: string }>(
    `select distinct source, campaign from visit_stats where day >= ($1::timestamptz at time zone '${TZ}')::date and day < ($2::timestamptz at time zone '${TZ}')::date and (source <> '' or campaign <> '')
     union select distinct coalesce(attribution->'utm'->>'utm_source',''), coalesce(attribution->'utm'->>'utm_campaign','') from orders where created_at >= $1 and created_at < $2 and attribution ? 'utm'
     order by 1, 2 limit 100`,
    [from, to],
  )
  return { sources: [...new Set(rows.map((r) => r.source).filter(Boolean))], campaigns: [...new Set(rows.map((r) => r.campaign).filter(Boolean))] }
}
