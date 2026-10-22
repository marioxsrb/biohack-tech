/**
 * The business report for a period, from Supabase only: traffic, leads, orders and revenue, products, sources,
 * AI calls, emails and codes, plus what needs a person now. Shared by the admin dashboard and by the report API an
 * AI assistant reads every day (/api/admin/report), so both always say the same thing.
 *
 * Days are Bucharest calendar days. Orders count when they stand: cash on delivery and transfer once placed, card
 * once paid. Customer details are reduced to a first name and a city.
 */
import 'server-only'
import { formatLei } from '@/lib/money'
import type { Queryable } from '@/server/db'
import { orders as ordersRepo, QUEUES, type QueueKey } from '@/server/orders/repository'

const TZ = 'Europe/Bucharest'

/** The sites the report separates: the main store, each landing and the international store. */
export const SITES = [
  { site: 'main', label: 'biohack-tech.ro' },
  { site: 'calm', label: 'calm.biohack-tech.ro' },
  { site: 'focus', label: 'focus.biohack-tech.ro' },
  { site: 'amber', label: 'amber.biohack-tech.ro' },
  { site: 'net', label: 'biohack-tech.net' },
] as const
/** A lead's site, from the host it was captured on. */
const LEAD_SITE = `case when coalesce(landing_host,'') like '%biohack-tech.net' or coalesce(landing_host,'') like 'net.localhost%' then 'net' when split_part(coalesce(landing_host,''), '.', 1) in ('calm','focus','amber') then split_part(landing_host, '.', 1) else 'main' end`
/** An order's site: the landing it came through, the international store, or the main store. */
const ORDER_SITE = `case when o.site = 'net' then 'net' when o.attribution->>'landing' in ('calm','focus','amber') then o.attribution->>'landing' else 'main' end`
/**
 * A sale that stands: not cancelled or abandoned, card money in (or a transfer / cash-on-delivery order), not fully
 * refunded. A paid post-purchase offer (upsell) is part of its parent's sale: its money counts, never as an order of
 * its own (counts use ORDER below).
 */
const STANDS = `o.kind in ('checkout', 'upsell') and o.status not in ('cancelled', 'abandoned') and o.payment_status <> 'refunded' and (o.payment_method <> 'card' or o.payment_status in ('paid', 'partially_refunded'))`
/** Counted as an order (the upsell is not a second order). */
const ORDER = `o.kind = 'checkout'`

// ─── periods ─────────────────────────────────────────────────────────────────

/** Minutes east of UTC that `tz` has at `at`. */
function offsetMinutes(at: Date, tz = TZ) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(at).map((x) => [x.type, x.value]))
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - at.getTime()) / 60_000
}

/** The instant a Bucharest calendar day (YYYY-MM-DD) starts. */
export function dayStart(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d)
  return new Date(guess - offsetMinutes(new Date(guess)) * 60_000)
}

/** Today in Bucharest, as YYYY-MM-DD. */
export const today = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
const addDays = (day: string, n: number) => new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + n)).toISOString().slice(0, 10)

export type Period = { from: Date; to: Date; firstDay: string; lastDay: string; days: number; label: string }

/**
 * A named period: today, yesterday, the last 7 or 30 days (ending today), or one calendar day (YYYY-MM-DD).
 * Anything else is yesterday (the daily report's default).
 */
export function period(key: string | undefined, now = new Date()): Period {
  const t = today(now)
  const make = (first: string, last: string, label: string): Period => ({ from: dayStart(first), to: last === t ? now : dayStart(addDays(last, 1)), firstDay: first, lastDay: last, days: Math.round((dayStart(addDays(last, 1)).getTime() - dayStart(first).getTime()) / 86_400_000), label })
  if (key === 'azi' || key === 'today') return make(t, t, 'Azi')
  if (key === '7' || key === '7d') return make(addDays(t, -6), t, 'Ultimele 7 zile')
  if (key === '30' || key === '30d') return make(addDays(t, -29), t, 'Ultimele 30 de zile')
  if (key && /^\d{4}-\d{2}-\d{2}$/.test(key) && key <= t) return make(key, key, key)
  const y = addDays(t, -1)
  return make(y, y, `Ieri (${y})`)
}

/** The period of the same length just before (for the comparisons). */
export function previous(p: Period): Period {
  const len = p.to.getTime() - p.from.getTime()
  const from = new Date(p.from.getTime() - Math.max(len, (p.days || 1) * 86_400_000))
  return { from, to: p.from, firstDay: addDays(p.firstDay, -p.days), lastDay: addDays(p.firstDay, -1), days: p.days, label: 'perioada anterioară' }
}

// ─── the report ──────────────────────────────────────────────────────────────

export type ReportOrder = {
  number: string
  id: string
  at: string
  totalLei: number
  status: string
  payment: string
  paymentStatus: string
  items: string
  firstName: string
  city: string
  source: string
  code: string | null
}

export type Report = Awaited<ReturnType<typeof buildReport>>

const n = (v: unknown) => Number(v ?? 0)
const lei = (minor: unknown) => Math.round(n(minor)) / 100
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null)

async function totals(q: Queryable, p: Pick<Period, 'from' | 'to'>) {
  const [visits, leads, orders, money] = await Promise.all([
    q.query(
      `select coalesce(sum(sessions),0)::int as sessions, coalesce(sum(views),0)::int as views from visit_stats
       where day >= ($1::timestamptz at time zone '${TZ}')::date and day <= (($2::timestamptz - interval '1 second') at time zone '${TZ}')::date`,
      [p.from, p.to],
    ),
    q.query(`select count(*)::int as leads, count(distinct email)::int as people from leads where created_at >= $1 and created_at < $2`, [p.from, p.to]),
    q.query(`select count(*) filter (where ${ORDER})::int as orders, coalesce(sum((o.total_minor - o.refunded_minor) * o.fx_rate),0)::bigint as revenue from orders o where ${STANDS} and o.created_at >= $1 and o.created_at < $2`, [p.from, p.to]),
    // Of those, the money actually in (paid) and what is still to collect (transfer awaited, cash on delivery).
    q.query(
      `select count(*) filter (where ${ORDER} and o.payment_status in ('paid', 'partially_refunded'))::int as paid_orders,
              coalesce(sum((o.total_minor - o.refunded_minor) * o.fx_rate) filter (where o.payment_status in ('paid', 'partially_refunded')),0)::bigint as collected,
              count(*) filter (where ${ORDER} and o.payment_status in ('awaiting_transfer', 'awaiting_collection'))::int as pending_orders,
              coalesce(sum(o.total_minor * o.fx_rate) filter (where o.payment_status in ('awaiting_transfer', 'awaiting_collection')),0)::bigint as pending
       from orders o where ${STANDS} and o.created_at >= $1 and o.created_at < $2`,
      [p.from, p.to],
    ),
  ])
  const sessions = n(visits.rows[0]?.sessions)
  const orderCount = n(orders.rows[0]?.orders)
  return {
    sessions,
    views: n(visits.rows[0]?.views),
    leads: n(leads.rows[0]?.leads),
    people: n(leads.rows[0]?.people),
    orders: orderCount,
    revenueLei: lei(orders.rows[0]?.revenue),
    averageOrderLei: orderCount ? Math.round(lei(orders.rows[0]?.revenue) / orderCount) : 0,
    conversionPct: pct(orderCount, sessions),
    /** Money in (paid orders) vs. still to collect: an unpaid order is never collected revenue. */
    collectedLei: lei(money.rows[0]?.collected),
    paidOrders: n(money.rows[0]?.paid_orders),
    pendingLei: lei(money.rows[0]?.pending),
    pendingOrders: n(money.rows[0]?.pending_orders),
  }
}

/** Since the store opened: orders that stand, money in, and what is still to collect (the iOS app's "total"). */
export async function lifetimeTotals(q: Queryable) {
  const { rows } = await q.query(
    `select count(*) filter (where ${ORDER})::int as orders,
            coalesce(sum((o.total_minor - o.refunded_minor) * o.fx_rate) filter (where o.payment_status in ('paid', 'partially_refunded')),0)::bigint as collected,
            coalesce(sum(o.total_minor * o.fx_rate) filter (where o.payment_status in ('awaiting_transfer', 'awaiting_collection')),0)::bigint as pending
     from orders o where ${STANDS}`,
  )
  return { orders: n(rows[0]?.orders), collectedLei: lei(rows[0]?.collected), pendingLei: lei(rows[0]?.pending) }
}

export async function buildReport(q: Queryable, p: Period) {
  const range = [p.from, p.to]
  const [now, before, visits, pages, sources, leadRows, orderRows, payments, products, calls, outcomes, emails, codes, signups, queues, daily, siteVisits, siteLeads, siteOrders, counts] = await Promise.all([
    totals(q, p),
    totals(q, previous(p)),
    q.query(
      `select sum(sessions)::int as sessions, sum(views)::int as views from visit_stats
       where day >= ($1::timestamptz at time zone '${TZ}')::date and day <= (($2::timestamptz - interval '1 second') at time zone '${TZ}')::date`,
      range,
    ),
    q.query(
      `select case when site = 'acces' then 'main' else site end as site, page, sum(views)::int as views from visit_stats where day >= ($1::timestamptz at time zone '${TZ}')::date and day <= (($2::timestamptz - interval '1 second') at time zone '${TZ}')::date
       group by 1, page order by views desc limit 10`,
      range,
    ),
    q.query(
      `select coalesce(nullif(source,''),'(direct)') as source, coalesce(nullif(campaign,''),'') as campaign, sum(sessions)::int as sessions from visit_stats
       where day >= ($1::timestamptz at time zone '${TZ}')::date and day <= (($2::timestamptz - interval '1 second') at time zone '${TZ}')::date
       group by 1, 2 order by sessions desc limit 8`,
      range,
    ),
    q.query(
      `select count(*)::int as leads, count(checkout_started_at)::int as checkouts,
              count(*) filter (where abandonment is not null and order_id is null)::int as abandoned,
              count(*) filter (where marketing_consent)::int as marketing, count(*) filter (where call_consent)::int as calls
       from leads where created_at >= $1 and created_at < $2`,
      range,
    ),
    q.query(
      `select o.id, o.order_number, o.created_at, round(o.total_minor * o.fx_rate)::bigint as total_minor, o.currency, o.total_minor as total_in_currency, o.status, o.payment_method, o.payment_status, o.promo_code,
              o.customer->>'firstName' as first_name, coalesce(o.shipping_address->>'city', o.billing_address->>'city', '') as city,
              coalesce(o.attribution->'utm'->>'utm_source','') as source,
              (select string_agg(i.quantity || ' × ' || i.product_name || coalesce(' (' || i.variant_name || ')', ''), ', ' order by i.position) from order_items i where i.order_id = o.id) as items
       from orders o where o.kind = 'checkout' and o.created_at >= $1 and o.created_at < $2 order by o.created_at desc limit 100`,
      range,
    ),
    // Net of refunds, like the KPIs and the sites table.
    q.query(`select o.payment_method as method, count(*) filter (where ${ORDER})::int as orders, coalesce(sum((o.total_minor - o.refunded_minor) * o.fx_rate),0)::bigint as value from orders o where ${STANDS} and o.created_at >= $1 and o.created_at < $2 group by 1`, range),
    q.query(
      // What each product brought after its discounts (promotions, codes, vouchers; a gift counts at 0).
      `select i.product_name as product, sum(i.quantity)::int as units, coalesce(sum((i.line_total_minor - i.discount_minor) * o.fx_rate),0)::bigint as value
       from order_items i join orders o on o.id = i.order_id where ${STANDS} and o.created_at >= $1 and o.created_at < $2 group by 1 order by units desc`,
      range,
    ),
    q.query(
      `select count(*)::int as placed, count(*) filter (where status = 'completed')::int as answered, count(*) filter (where follow_up)::int as follow_ups,
              count(*) filter (where opted_out)::int as opted_out, coalesce(round(avg(duration_secs) filter (where status = 'completed')),0)::int as avg_secs,
              count(*) filter (where email_status in ('sent','sent_on_request'))::int as code_emails
       from calls where created_at >= $1 and created_at < $2 and status <> 'dry_run'`,
      range,
    ),
    q.query(`select coalesce(outcome, status) as outcome, count(*)::int as n from calls where created_at >= $1 and created_at < $2 and status <> 'dry_run' group by 1 order by n desc`, range),
    q.query(`select count(*) filter (where last_recovery_at >= $1 and last_recovery_at < $2)::int as recovery from leads`, range),
    q.query(
      `select r.code, count(*)::int as uses, coalesce(sum(r.discount_minor * o.fx_rate),0)::bigint as discount from promo_redemptions r join orders o on o.id = r.order_id
       where ${STANDS} and o.created_at >= $1 and o.created_at < $2 group by 1
       union all
       select case when v.kind = 'gift' then 'cadouri (recompense)' else 'vouchere personale' end, count(*)::int,
              coalesce(sum((select sum(i.code_discount_minor) from order_items i where i.order_id = o.id) * o.fx_rate),0)::bigint
       from orders o join vouchers v on v.id = o.voucher_id where ${STANDS} and o.created_at >= $1 and o.created_at < $2 group by 1
       order by 2 desc`,
      range,
    ),
    q.query(`select count(*)::int as n from welcome_signups where created_at >= $1 and created_at < $2`, range),
    ordersRepo.queueCounts(q),
    q.query(
      `with d as (select generate_series(($1::timestamptz at time zone '${TZ}')::date, (($2::timestamptz - interval '1 second') at time zone '${TZ}')::date, '1 day')::date as day)
       select to_char(d.day,'YYYY-MM-DD') as day,
              coalesce((select sum(sessions) from visit_stats v where v.day = d.day),0)::int as sessions,
              (select count(*) from leads l where (l.created_at at time zone '${TZ}')::date = d.day)::int as leads,
              (select count(*) from orders o where ${STANDS} and ${ORDER} and (o.created_at at time zone '${TZ}')::date = d.day)::int as orders,
              coalesce((select sum((o.total_minor - o.refunded_minor) * o.fx_rate) from orders o where ${STANDS} and (o.created_at at time zone '${TZ}')::date = d.day),0)::bigint as revenue
       from d order by d.day`,
      [p.days > 1 ? p.from : new Date(p.to.getTime() - 14 * 86_400_000), p.to],
    ),
    q.query(
      `select case when site = 'acces' then 'main' else site end as site, sum(sessions)::int as sessions, sum(views)::int as views from visit_stats
       where day >= ($1::timestamptz at time zone '${TZ}')::date and day <= (($2::timestamptz - interval '1 second') at time zone '${TZ}')::date group by 1`,
      range,
    ),
    q.query(`select ${LEAD_SITE} as site, count(*)::int as leads from leads where created_at >= $1 and created_at < $2 group by 1`, range),
    q.query(`select ${ORDER_SITE} as site, count(*) filter (where ${ORDER})::int as orders, coalesce(sum((o.total_minor - o.refunded_minor) * o.fx_rate),0)::bigint as revenue from orders o where ${STANDS} and o.created_at >= $1 and o.created_at < $2 group by 1`, range),
    // The funnel's and the list's counts over the whole period (the list itself shows the latest 100 only).
    q.query(
      `select count(*) filter (where ${ORDER})::int as placed, count(*) filter (where ${STANDS} and ${ORDER})::int as standing,
              coalesce(sum((o.total_minor - o.refunded_minor) * o.fx_rate) filter (where ${STANDS}),0)::bigint as revenue,
              count(*) filter (where ${ORDER} and o.status = 'cancelled')::int as cancelled,
              count(*) filter (where ${ORDER} and o.payment_method = 'card' and o.payment_status not in ('paid','partially_refunded','refunded'))::int as unpaid_card
       from orders o where o.kind in ('checkout', 'upsell') and o.created_at >= $1 and o.created_at < $2`,
      range,
    ),
  ])

  // The store's one funnel, all sites together: visits → leads (checkout contact step) → checkouts → orders.
  const c = counts.rows[0] ?? {}
  const funnels = [
    {
      funnel: 'biohack-tech.ro',
      sessions: n(visits.rows[0]?.sessions),
      leads: n(leadRows.rows[0]?.leads),
      checkouts: n(leadRows.rows[0]?.checkouts),
      abandoned: n(leadRows.rows[0]?.abandoned),
      orders: n(c.standing),
      revenueLei: lei(c.revenue),
    },
  ]

  const list: ReportOrder[] = orderRows.rows.map((r) => ({
    number: r.order_number as string,
    id: r.id as string,
    at: new Date(r.created_at as string).toISOString(),
    totalLei: lei(r.total_minor),
    status: r.status as string,
    payment: r.payment_method as string,
    paymentStatus: r.payment_status as string,
    items: (r.items as string) ?? '',
    firstName: (r.first_name as string) ?? '',
    city: (r.city as string) ?? '',
    source: (r.source as string) || '(direct)',
    code: (r.promo_code as string) ?? null,
  }))

  const change = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 1000) / 10 : a ? null : 0)
  return {
    period: { label: p.label, from: p.from.toISOString(), to: p.to.toISOString(), firstDay: p.firstDay, lastDay: p.lastDay, timezone: TZ },
    totals: now,
    previous: before,
    changePct: { sessions: change(now.sessions, before.sessions), leads: change(now.leads, before.leads), orders: change(now.orders, before.orders), revenue: change(now.revenueLei, before.revenueLei) },
    funnels,
    topPages: pages.rows.map((r) => ({ page: `${r.site === 'main' ? '' : `${r.site}: `}${(r.page as string) || '/'}`, views: n(r.views) })),
    sites: SITES.map(({ site, label }) => {
      const v = siteVisits.rows.find((r) => r.site === site)
      const orders = n(siteOrders.rows.find((r) => r.site === site)?.orders)
      return {
        site,
        label,
        sessions: n(v?.sessions),
        views: n(v?.views),
        leads: n(siteLeads.rows.find((r) => r.site === site)?.leads),
        orders,
        revenueLei: lei(siteOrders.rows.find((r) => r.site === site)?.revenue),
        conversionPct: pct(orders, n(v?.sessions)),
      }
    }),
    sources: sources.rows.map((r) => ({ source: r.source as string, campaign: r.campaign as string, sessions: n(r.sessions) })),
    orders: list,
    ordersPlacedAll: n(c.placed),
    cancelled: n(c.cancelled),
    unpaidCard: n(c.unpaid_card),
    payments: payments.rows.map((r) => ({ method: r.method as string, orders: n(r.orders), valueLei: lei(r.value) })),
    products: products.rows.map((r) => ({ product: r.product as string, units: n(r.units), valueLei: lei(r.value) })),
    calls: { ...Object.fromEntries(Object.entries(calls.rows[0] ?? {}).map(([k, v]) => [k, n(v)])), outcomes: outcomes.rows.map((r) => ({ outcome: r.outcome as string, n: n(r.n) })) } as {
      placed: number
      answered: number
      follow_ups: number
      opted_out: number
      avg_secs: number
      code_emails: number
      outcomes: { outcome: string; n: number }[]
    },
    emails: { recovery: n(emails.rows[0]?.recovery), welcomeSignups: n(signups.rows[0]?.n) },
    codes: codes.rows.map((r) => ({ code: r.code as string, uses: n(r.uses), discountLei: lei(r.discount) })),
    attention: (Object.keys(QUEUES) as QueueKey[]).filter((k) => queues[k] > 0).map((k) => ({ queue: QUEUES[k].label, n: queues[k] })),
    daily: daily.rows.map((r) => ({ day: r.day as string, sessions: n(r.sessions), leads: n(r.leads), orders: n(r.orders), revenueLei: lei(r.revenue) })),
  }
}

// ─── as text, for an AI assistant or a person ───────────────────────────────

const PAY: Record<string, string> = { cash_on_delivery: 'ramburs', card: 'card', bank_transfer: 'transfer' }
const signed = (v: number | null) => (v === null ? 'nou' : `${v > 0 ? '+' : ''}${v}%`)

export function reportMarkdown(r: Report) {
  const t = r.totals
  const L = (v: number) => formatLei(Math.round(v * 100))
  const out = [
    `# Raport Biohack Tech · ${r.period.label}`,
    `Perioada: ${r.period.firstDay} – ${r.period.lastDay} (ora României).`,
    '',
    '## Pe scurt',
    `- Vizite (sesiuni): ${t.sessions} (${signed(r.changePct.sessions)} față de perioada anterioară), afișări de pagini: ${t.views}`,
    `- Leaduri: ${t.leads} (${t.people} persoane distincte) (${signed(r.changePct.leads)})`,
    `- Comenzi valide: ${t.orders} (${signed(r.changePct.orders)}), valoare ${L(t.revenueLei)} (${signed(r.changePct.revenue)}), coș mediu ${L(t.averageOrderLei)}`,
    `- Rata de conversie (comenzi / sesiuni): ${t.conversionPct ?? 0}%`,
    `- Comenzi anulate: ${r.cancelled}, plăți cu cardul nefinalizate: ${r.unpaidCard}`,
    '',
    '## Pe site-uri',
    ...r.sites.map((s) => `- ${s.label}: ${s.sessions} sesiuni, ${s.leads} leaduri, ${s.orders} comenzi, ${L(s.revenueLei)}${s.conversionPct !== null ? `, conversie ${s.conversionPct}%` : ''}`),
    '',
    '## Funnel',
    ...r.funnels.map((f) => `- ${f.funnel}: ${f.sessions} sesiuni → ${f.leads} leaduri (${f.checkouts} au început checkout-ul, ${f.abandoned} abandonate) → ${f.orders} comenzi, ${L(f.revenueLei)}`),
    '',
    '## Surse de trafic',
    ...(r.sources.length ? r.sources.map((s) => `- ${s.source}${s.campaign ? ` / ${s.campaign}` : ''}: ${s.sessions} sesiuni`) : ['- fără date']),
    '',
    '## Pagini vizitate',
    ...(r.topPages.length ? r.topPages.map((p) => `- ${p.page}: ${p.views}`) : ['- fără date']),
    '',
    '## Comenzi',
    ...(r.orders.length
      ? r.orders.map((o) => `- ${o.number} · ${new Date(o.at).toLocaleString('ro-RO', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · ${L(o.totalLei)} · ${PAY[o.payment] ?? o.payment} (${o.paymentStatus}) · ${o.status} · ${o.items}${o.city ? ` · ${o.city}` : ''} · ${o.source}${o.code ? ` · cod ${o.code}` : ''}`)
      : ['- nicio comandă']),
    '',
    '## Produse vândute',
    ...(r.products.length ? r.products.map((p) => `- ${p.product}: ${p.units} buc., ${L(p.valueLei)}`) : ['- niciun produs']),
    '',
    '## Plăți',
    ...(r.payments.length ? r.payments.map((p) => `- ${PAY[p.method] ?? p.method}: ${p.orders} comenzi, ${L(p.valueLei)}`) : ['- fără plăți']),
    '',
    '## Apeluri AI',
    `- Apeluri: ${r.calls.placed}, cu răspuns: ${r.calls.answered}, durată medie ${r.calls.avg_secs}s, emailuri cu cod: ${r.calls.code_emails}, cer un coleg: ${r.calls.follow_ups}, au refuzat contactul: ${r.calls.opted_out}`,
    ...r.calls.outcomes.map((o) => `- ${o.outcome}: ${o.n}`),
    '',
    '## Emailuri și coduri',
    `- Emailuri de recuperare trimise: ${r.emails.recovery}; înscrieri în popup (LONGEVITY10): ${r.emails.welcomeSignups}`,
    ...(r.codes.length ? r.codes.map((c) => `- Cod ${c.code}: ${c.uses} folosiri, reducere ${L(c.discountLei)}`) : ['- niciun cod folosit']),
    '',
    '## De rezolvat acum',
    ...(r.attention.length ? r.attention.map((a) => `- ${a.queue}: ${a.n}`) : ['- nimic în așteptare']),
  ]
  return out.join('\n')
}
