import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { formatLei } from '@/lib/money'
import { getDb } from '@/server/db'
import { buildReport, period, type Report } from '@/server/report'
import { ORDER_LABEL, PAYMENT_LABEL, tone } from './labels'
import { CustomCharts } from './CustomCharts'
import { charts } from '@/server/charts'

export const metadata: Metadata = { title: 'Dashboard' }

const PERIODS = [
  { key: 'azi', label: 'Azi' },
  { key: 'ieri', label: 'Ieri' },
  { key: '7', label: '7 zile' },
  { key: '30', label: '30 de zile' },
]
const PAY: Record<string, string> = { cash_on_delivery: 'Ramburs', card: 'Card', bank_transfer: 'Transfer' }
const L = (v: number) => formatLei(Math.round(v * 100))
const time = (iso: string) => new Date(iso).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function Delta({ v }: { v: number | null }) {
  if (v === null) return <span className="text-[12.5px] font-medium text-cyan-700">nou</span>
  if (v === 0) return <span className="text-[12.5px] text-muted">0%</span>
  return <span className={`text-[12.5px] font-semibold tabular-nums ${v > 0 ? 'text-[#167a4a]' : 'text-red-deep'}`}>{`${v > 0 ? '▲' : '▼'} ${Math.abs(v)}%`}</span>
}

function Kpi({ label, value, delta, hint }: { label: string; value: string; delta?: number | null; hint?: string }) {
  return (
    <div className="rounded-[18px] bg-paper p-5">
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <p className="mt-1.5 text-[28px] leading-none font-semibold tracking-[-0.02em] text-ink tabular-nums">{value}</p>
      <p className="mt-2 flex items-center gap-2 text-[12.5px] text-muted">
        {delta !== undefined && <Delta v={delta} />}
        {hint}
      </p>
    </div>
  )
}

function Card({ title, children, className = '', action }: { title: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={`rounded-[18px] bg-paper p-5 ${className}`}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Revenue per day as bars, with orders and sessions under each (CSS only; zero days stay visible). */
function DailyChart({ daily }: { daily: Report['daily'] }) {
  const max = Math.max(1, ...daily.map((d) => d.revenueLei))
  return (
    <div>
      <div className="flex h-[150px] items-end gap-1.5" role="img" aria-label="Valoarea comenzilor pe zile">
        {daily.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
            <div className="w-full rounded-t-[5px] bg-cyan-700/85 transition-colors group-hover:bg-cyan-700" style={{ height: `${Math.max(d.revenueLei ? 4 : 1, (d.revenueLei / max) * 100)}%` }} />
            <span className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 rounded-[8px] bg-ink px-2 py-1 text-[11.5px] whitespace-nowrap text-white group-hover:block">
              {d.day.slice(5)}: {L(d.revenueLei)} · {d.orders} com. · {d.sessions} ses.
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5 text-[10.5px] text-muted tabular-nums">
        {daily.map((d, i) => (
          <span key={d.day} className="flex-1 text-center">
            {daily.length <= 16 || i % Math.ceil(daily.length / 10) === 0 ? d.day.slice(8) : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

function Bar({ label, value, max, right }: { label: string; value: number; max: number; right: string }) {
  return (
    <li className="py-1.5">
      <div className="flex justify-between gap-3 text-[14px]">
        <span className="truncate text-ink">{label}</span>
        <span className="flex-none text-muted tabular-nums">{right}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-mist">
        <div className="h-1.5 rounded-full bg-ink/80" style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} />
      </div>
    </li>
  )
}

/** The business at a glance: sales, traffic, the two funnels, sources, products, AI calls and what needs a person. */
export default async function Dashboard({ searchParams }: PageProps<'/[lang]/admin'>) {
  await connection()
  const sp = await searchParams
  const key = typeof sp.p === 'string' ? sp.p : 'azi'
  const p = period(key)
  const db = await getDb()
  const [r, saved] = await Promise.all([buildReport(db, p), charts.list(db)])
  const t = r.totals
  const maxSource = Math.max(0, ...r.sources.map((s) => s.sessions))
  const maxProduct = Math.max(0, ...r.products.map((s) => s.units))
  const maxPage = Math.max(0, ...r.topPages.map((s) => s.views))

  return (
    <div className="mx-auto max-w-[1240px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] tracking-[-0.03em]">Dashboard</h1>
          <p className="text-[14px] text-muted">
            {r.period.firstDay === r.period.lastDay ? r.period.firstDay : `${r.period.firstDay} – ${r.period.lastDay}`} · comparat cu perioada anterioară de aceeași lungime
          </p>
        </div>
        <nav aria-label="Perioada" className="flex gap-1 rounded-[12px] bg-paper p-1 text-[14px]">
          {PERIODS.map((x) => (
            <Link key={x.key} href={`/admin?p=${x.key}`} aria-current={key === x.key ? 'page' : undefined} className={`rounded-[9px] px-3.5 py-1.5 ${key === x.key ? 'bg-ink text-white' : 'text-ink hover:bg-mist'}`}>
              {x.label}
            </Link>
          ))}
        </nav>
      </div>

      {r.attention.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-[16px] bg-[#fff4e5] px-4 py-3 text-[14px] text-[#7a4a00]">
          <span className="font-semibold">De rezolvat:</span>
          {r.attention.map((a) => (
            <span key={a.queue} className="rounded-full bg-white/70 px-2.5 py-0.5">
              {a.queue} · {a.n}
            </span>
          ))}
          <Link href="/admin/comenzi" className="ml-auto font-medium underline underline-offset-4">
            Deschide comenzile
          </Link>
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Valoare comenzi" value={L(t.revenueLei)} delta={r.changePct.revenue} hint={`coș mediu ${L(t.averageOrderLei)}`} />
        <Kpi label="Comenzi valide" value={String(t.orders)} delta={r.changePct.orders} hint={`${r.cancelled} anulate · ${r.unpaidCard} card neplătit`} />
        <Kpi label="Vizite (sesiuni)" value={String(t.sessions)} delta={r.changePct.sessions} hint={`${t.views} afișări · conversie ${t.conversionPct ?? 0}%`} />
        <Kpi label="Leaduri" value={String(t.leads)} delta={r.changePct.leads} hint={`${t.people} persoane · ${r.emails.welcomeSignups} din popup`} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card title={p.days > 1 ? 'Vânzări pe zile' : 'Ultimele 14 zile'} className="lg:col-span-2">
          <DailyChart daily={r.daily} />
        </Card>
        <Card title="Plăți">
          {r.payments.length ? (
            <ul>
              {r.payments.map((x) => (
                <Bar key={x.method} label={`${PAY[x.method] ?? x.method} · ${x.orders} comenzi`} value={x.valueLei} max={Math.max(...r.payments.map((y) => y.valueLei))} right={L(x.valueLei)} />
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-muted">Nicio comandă în perioadă.</p>
          )}
        </Card>
      </div>

      <CustomCharts initial={saved} />

      <Card title="Pe site-uri" className="mt-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[14px]">
            <thead>
              <tr className="text-left text-[12.5px] text-muted">
                <th className="py-1.5 font-medium">Site</th>
                <th className="py-1.5 text-right font-medium">Sesiuni</th>
                <th className="py-1.5 text-right font-medium">Afișări</th>
                <th className="py-1.5 text-right font-medium">Leaduri</th>
                <th className="py-1.5 text-right font-medium">Comenzi</th>
                <th className="py-1.5 text-right font-medium">Conversie</th>
                <th className="py-1.5 text-right font-medium">Valoare</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {r.sites.map((s) => (
                <tr key={s.site} className="border-t border-mist-2">
                  <td className="py-2 font-medium text-ink">{s.label}</td>
                  <td className="py-2 text-right">{s.sessions}</td>
                  <td className="py-2 text-right">{s.views}</td>
                  <td className="py-2 text-right">{s.leads}</td>
                  <td className="py-2 text-right font-semibold text-ink">{s.orders}</td>
                  <td className="py-2 text-right">{s.conversionPct === null ? '–' : `${s.conversionPct}%`}</td>
                  <td className="py-2 text-right">{L(s.revenueLei)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Funnel" className="mt-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[14px]">
            <thead>
              <tr className="text-left text-[12.5px] text-muted">
                <th className="py-1.5 font-medium">Site</th>
                <th className="py-1.5 text-right font-medium">Sesiuni</th>
                <th className="py-1.5 text-right font-medium">Leaduri</th>
                <th className="py-1.5 text-right font-medium">Preț văzut</th>
                <th className="py-1.5 text-right font-medium">Checkout</th>
                <th className="py-1.5 text-right font-medium">Abandonate</th>
                <th className="py-1.5 text-right font-medium">Comenzi</th>
                <th className="py-1.5 text-right font-medium">Valoare</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {r.funnels.map((f) => (
                <tr key={f.funnel} className="border-t border-mist-2">
                  <td className="py-2 font-medium text-ink">{f.funnel}</td>
                  <td className="py-2 text-right">{f.sessions}</td>
                  <td className="py-2 text-right">{f.leads}</td>
                  <td className="py-2 text-right">{f.priceReveals}</td>
                  <td className="py-2 text-right">{f.checkouts}</td>
                  <td className="py-2 text-right">{f.abandoned}</td>
                  <td className="py-2 text-right font-semibold text-ink">{f.orders}</td>
                  <td className="py-2 text-right">{L(f.revenueLei)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card title="Surse de trafic">
          {r.sources.length ? (
            <ul>
              {r.sources.map((s) => (
                <Bar key={`${s.source}/${s.campaign}`} label={`${s.source}${s.campaign ? ` / ${s.campaign}` : ''}`} value={s.sessions} max={maxSource} right={String(s.sessions)} />
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-muted">Fără vizite înregistrate.</p>
          )}
        </Card>
        <Card title="Produse vândute">
          {r.products.length ? (
            <ul>
              {r.products.map((x) => (
                <Bar key={x.product} label={`${x.product} · ${x.units} buc.`} value={x.units} max={maxProduct} right={L(x.valueLei)} />
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-muted">Niciun produs vândut.</p>
          )}
        </Card>
        <Card title="Pagini vizitate">
          {r.topPages.length ? (
            <ul>
              {r.topPages.map((x) => (
                <Bar key={x.page} label={x.page} value={x.views} max={maxPage} right={String(x.views)} />
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-muted">Fără vizite înregistrate.</p>
          )}
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card title="Apeluri AI" action={<Link href="/admin/leaduri" className="text-[13px] text-muted underline underline-offset-4">Leaduri</Link>}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[14px]">
            <dt className="text-muted">Apeluri</dt>
            <dd className="text-right font-semibold tabular-nums">{r.calls.placed}</dd>
            <dt className="text-muted">Cu răspuns</dt>
            <dd className="text-right tabular-nums">{r.calls.answered}</dd>
            <dt className="text-muted">Durată medie</dt>
            <dd className="text-right tabular-nums">{r.calls.avg_secs}s</dd>
            <dt className="text-muted">Emailuri cu cod</dt>
            <dd className="text-right tabular-nums">{r.calls.code_emails}</dd>
            <dt className="text-muted">Cer un coleg</dt>
            <dd className="text-right tabular-nums">{r.calls.follow_ups}</dd>
            <dt className="text-muted">Au refuzat contactul</dt>
            <dd className="text-right tabular-nums">{r.calls.opted_out}</dd>
          </dl>
          {r.calls.outcomes.length > 0 && <p className="mt-3 text-[13px] text-muted">{r.calls.outcomes.map((o) => `${o.outcome} ${o.n}`).join(' · ')}</p>}
        </Card>
        <Card title="Emailuri și coduri" action={<Link href="/admin/coduri" className="text-[13px] text-muted underline underline-offset-4">Coduri</Link>}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[14px]">
            <dt className="text-muted">Emailuri de recuperare</dt>
            <dd className="text-right tabular-nums">{r.emails.recovery}</dd>
            <dt className="text-muted">Înscrieri popup (LONGEVITY10)</dt>
            <dd className="text-right tabular-nums">{r.emails.welcomeSignups}</dd>
            {r.codes.map((c) => (
              <div key={c.code} className="contents">
                <dt className="text-muted">Cod {c.code}</dt>
                <dd className="text-right tabular-nums">
                  {c.uses} × · −{L(c.discountLei)}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card title={`Comenzi (${r.ordersPlacedAll})`} className="mt-3" action={<Link href="/admin/comenzi" className="text-[13px] text-muted underline underline-offset-4">Toate comenzile</Link>}>
        {r.orders.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[14px]">
              <thead>
                <tr className="text-left text-[12.5px] text-muted">
                  <th className="py-1.5 font-medium">Comanda</th>
                  <th className="py-1.5 font-medium">Când</th>
                  <th className="py-1.5 font-medium">Client</th>
                  <th className="py-1.5 font-medium">Produse</th>
                  <th className="py-1.5 font-medium">Plată</th>
                  <th className="py-1.5 font-medium">Stare</th>
                  <th className="py-1.5 font-medium">Sursa</th>
                  <th className="py-1.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {r.orders.slice(0, 25).map((o) => (
                  <tr key={o.id} className="border-t border-mist-2 align-top">
                    <td className="py-2">
                      <Link href={`/admin/orders/${o.id}`} className="font-medium text-ink underline underline-offset-4">
                        {o.number}
                      </Link>
                    </td>
                    <td className="py-2 text-muted tabular-nums">{time(o.at)}</td>
                    <td className="py-2">
                      {o.firstName}
                      {o.city && <span className="block text-[12.5px] text-muted">{o.city}</span>}
                    </td>
                    <td className="py-2">{o.items}</td>
                    <td className="py-2">
                      {PAY[o.payment] ?? o.payment}
                      <span className="block text-[12.5px] text-muted">{PAYMENT_LABEL[o.paymentStatus as keyof typeof PAYMENT_LABEL] ?? o.paymentStatus}</span>
                    </td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[12.5px] ${tone(o.status)}`}>{ORDER_LABEL[o.status as keyof typeof ORDER_LABEL] ?? o.status}</span>
                    </td>
                    <td className="py-2 text-muted">
                      {o.funnel} · {o.source}
                      {o.code && <span className="block text-[12.5px]">cod {o.code}</span>}
                    </td>
                    <td className="py-2 text-right font-semibold text-ink tabular-nums">{L(o.totalLei)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[14px] text-muted">Nicio comandă în perioadă.</p>
        )}
      </Card>
    </div>
  )
}
