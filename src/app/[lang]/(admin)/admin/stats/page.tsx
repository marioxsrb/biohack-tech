import Link from 'next/link'
import { connection } from 'next/server'
import { getProduct, products, type ProductId } from '@/content/catalog'
import { formatLei } from '@/lib/money'
import { getDb } from '@/server/db'
import { campaignOptions, dailyTrend, funnelStats, type FunnelStats, type StatsFilter } from '@/server/stats'

const BAR = 'bg-cyan-700'

const day = (d: Date) => d.toISOString().slice(0, 10)
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '–')
const parseDay = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00+03:00`) : null)
const daysBefore = (n: number) => new Date(Date.now() - n * 86_400_000)
/** Midnight of today's date (dates are read as Bucharest days). */
const today = () => new Date(`${day(new Date())}T00:00:00+03:00`)

/**
 * Stats: the store's funnel (biohack-tech.ro and its landings), from Supabase (orders, leads, anonymous visit
 * counts). Card orders count once paid; cash on delivery and transfer when placed.
 */
export default async function StatsPage({ searchParams }: PageProps<'/[lang]/admin/stats'>) {
  await connection()
  const sp = await searchParams
  const to0 = parseDay(sp.to)
  const from = parseDay(sp.from) ?? new Date(day(daysBefore(29)) + 'T00:00:00+03:00')
  const to = new Date((to0 ?? today()).getTime() + 86_400_000)
  const product = typeof sp.product === 'string' && getProduct(sp.product) ? (sp.product as ProductId) : undefined
  const source = typeof sp.source === 'string' && /^[\w.-]{1,40}$/.test(sp.source) ? sp.source : undefined
  const campaign = typeof sp.campaign === 'string' && /^[\w.-]{1,40}$/.test(sp.campaign) ? sp.campaign : undefined
  const f: StatsFilter = { from, to, product, source, campaign }
  const db = await getDb()
  const [s, trend, options] = await Promise.all([funnelStats(db, f), dailyTrend(db, f), campaignOptions(db, from, to)])

  const rows: { label: string; value: (s: FunnelStats) => string; note?: string }[] = [
    { label: 'Sesiuni', value: (s) => String(s.sessions), note: 'prima pagină dintr-o sesiune de browser' },
    { label: 'Afișări de pagini', value: (s) => String(s.views) },
    { label: 'Afișări pagini de produs', value: (s) => String(s.productViews) },
    { label: 'Leaduri', value: (s) => String(s.leads), note: 'pasul de contact din checkout' },
    { label: 'Persoane unice', value: (s) => String(s.people), note: 'leaduri fără duplicate: aceeași adresă de email o singură dată' },
    { label: 'Checkout început', value: (s) => String(s.checkouts), note: 'contact completat în checkout' },
    { label: 'Comenzi plasate', value: (s) => String(s.orders) },
    { label: 'Comenzi plătite', value: (s) => String(s.paidOrders) },
    { label: 'Conversie (comenzi / sesiuni)', value: (s) => pct(s.orders, s.sessions) },
    { label: 'Conversie plătită (plătite / sesiuni)', value: (s) => pct(s.paidOrders, s.sessions) },
    { label: 'Lead → comandă', value: (s) => pct(s.orders, s.leads) },
    { label: 'Venit din comenzile inițiale', value: (s) => formatLei(s.initialRevenueMinor), note: 'încasat, minus rambursări' },
    { label: 'Venit din upsell', value: (s) => formatLei(s.upsellRevenueMinor), note: 'oferta de după plată, legată de comanda inițială (nu e o comandă separată)' },
    { label: 'Venit total net', value: (s) => formatLei(s.revenueMinor), note: 'inițiale + upsell, fiecare o singură dată, minus rambursări' },
    { label: 'Valoare medie comandă', value: (s) => (s.paidOrders ? formatLei(Math.round(s.revenueMinor / s.paidOrders)) : '–'), note: 'venit total net / comenzi plătite (upsell inclus)' },
    { label: 'Checkout abandonat', value: (s) => String(s.abandoned) },
    { label: 'Emailuri de recuperare trimise', value: (s) => String(s.recoveryEmails) },
    { label: 'Comenzi recuperate', value: (s) => String(s.recoveredOrders), note: 'comandă după un email de recuperare' },
    { label: 'Rată recuperare', value: (s) => pct(s.recoveredOrders, s.recoveryLeads) },
  ]
  const steps: [string, (s: FunnelStats) => number][] = [
    ['Sesiuni', (s) => s.sessions],
    ['Leaduri', (s) => s.leads],
    ['Checkout', (s) => s.checkouts],
    ['Comenzi', (s) => s.orders],
    ['Plătite', (s) => s.paidOrders],
  ]
  const days = [...new Set(trend.map((t) => t.day))]
  const maxDay = Math.max(1, ...trend.map((t) => t.sessions))
  const select = 'rounded-[10px] border border-line bg-paper px-3 py-2 text-[14px]'

  return (
    <>
      <h1 className="mt-2 text-[34px] tracking-[-0.03em]">Stats</h1>
      <p className="mt-1 text-[14.5px] text-muted">
        biohack-tech.ro și landingurile (calm., focus., amber.), {day(from)} – {day(new Date(to.getTime() - 1))}.
      </p>

      <form className="mt-5 flex flex-wrap items-end gap-3 rounded-[16px] bg-paper p-4 text-[13px]">
        <label className="grid gap-1">
          De la
          <input type="date" name="from" defaultValue={day(from)} className={select} />
        </label>
        <label className="grid gap-1">
          Până la
          <input type="date" name="to" defaultValue={day(new Date(to.getTime() - 1))} className={select} />
        </label>
        <label className="grid gap-1">
          Produs
          <select name="product" defaultValue={product ?? ''} className={select}>
            <option value="">Toate</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          Sursă (utm_source)
          <select name="source" defaultValue={source ?? ''} className={select}>
            <option value="">Toate</option>
            {options.sources.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          Campanie (utm_campaign)
          <select name="campaign" defaultValue={campaign ?? ''} className={select}>
            <option value="">Toate</option>
            {options.campaigns.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button className="cta sm">Aplică</button>
        <Link href="/admin/stats" className="btn-secondary sm">
          Resetează
        </Link>
      </form>

      <h2 className="mt-8 text-[22px] tracking-[-0.02em]">Indicatori</h2>
      <div className="mt-3 overflow-x-auto rounded-[16px] bg-paper">
        <table className="w-full min-w-[480px] text-left text-[14px] tabular-nums">
          <thead className="text-[12.5px] text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Indicator</th>
              <th className="px-4 py-3 font-semibold">Valoare</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-line">
                <td className="px-4 py-2.5 text-ink">
                  {r.label}
                  {r.note && <span className="block text-[12px] text-muted">{r.note}</span>}
                </td>
                <td className="px-4 py-2.5 font-medium text-ink">{r.value(s)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-8 rounded-[16px] bg-paper p-5">
        <h2 className="text-[18px] tracking-[-0.02em]">Funnel</h2>
        <ul className="mt-3 space-y-1.5">
          {steps.map(([label, v]) => (
            <li key={label} className="grid grid-cols-[80px_1fr_56px] items-center gap-2 text-[13px]">
              <span className="text-muted">{label}</span>
              <span className="h-3 rounded-full bg-mist">
                <span className={`block h-3 rounded-full ${BAR}`} style={{ width: `${(v(s) / Math.max(1, ...steps.map(([, x]) => x(s)))) * 100}%` }} />
              </span>
              <span className="text-right tabular-nums text-ink">{v(s)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex justify-between text-[13px] text-ink">
          <span>Venit total net</span>
          <span className="font-medium tabular-nums">{formatLei(s.revenueMinor)}</span>
        </p>
        <p className="mt-1 flex justify-between text-[12px] text-muted">
          <span>inițiale {formatLei(s.initialRevenueMinor)} · upsell {formatLei(s.upsellRevenueMinor)}</span>
        </p>
      </section>

      <section className="mt-6 rounded-[16px] bg-paper p-5">
        <h2 className="text-[18px] tracking-[-0.02em]">Trend zilnic (sesiuni · leaduri · comenzi)</h2>
        <div className="mt-4 overflow-x-auto">
          <div className="flex min-w-max items-end gap-1.5" style={{ height: 140 }}>
            {days.map((d) => (
              <div key={d} className="flex h-full flex-col items-center justify-end gap-1" title={trend.filter((t) => t.day === d).map((t) => `${t.sessions} sesiuni, ${t.leads} leaduri, ${t.orders} comenzi`).join('\n')}>
                <div className="flex h-full items-end gap-0.5">
                  {trend
                    .filter((t) => t.day === d)
                    .map((t) => (
                      <span key={t.day} className={`w-2.5 rounded-t ${BAR}`} style={{ height: `${Math.max(2, (t.sessions / maxDay) * 100)}%`, opacity: t.sessions ? 1 : 0.25 }} />
                    ))}
                </div>
                <span className="text-[10px] text-muted">{d.slice(8)}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[12.5px] text-muted">Înălțimea = sesiuni pe zi; treci cu mouse-ul peste o zi pentru leaduri și comenzi.</p>
      </section>

      <section className="mt-6 max-w-[70em] text-[13px] leading-relaxed text-muted">
        <h2 className="text-[15px] font-semibold text-ink">Ce nu se poate măsura exact</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Vizitatori unici: indisponibil. Numărăm sesiuni de browser (prima pagină dintr-o sesiune, ținută minte doar în fila vizitatorului), fără cookie sau identificator. Un vizitator care
            revine altă zi apare ca o sesiune nouă.
          </li>
          <li>Sesiunile se numără de la 14.10.2026 (înainte existau doar afișări de pagini). Paginile de landing (calm., focus., amber.) sunt incluse.</li>
          <li>Leadurile vin din pasul de contact al checkout-ului. Până la 20.10.2026 existau și leaduri din formularul de preț de pe acces.biohack-tech.ro (închis), incluse în perioadele de atunci.</li>
          <li>Evenimentele Meta Pixel nu sunt folosite aici (sunt blocate momentan de Traffic permissions și depind de acordul pentru cookie-uri).</li>
        </ul>
      </section>
    </>
  )
}
