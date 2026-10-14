import Link from 'next/link'
import { connection } from 'next/server'
import { attributionSummary } from '@/lib/attribution'
import type { Funnel } from '@/lib/lead'
import { formatLei } from '@/lib/money'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { funnelStats, interestOf, leads, type Lead } from '@/server/leads'
import { marketing } from '@/server/marketing/consent'

const dt = (d: Date) => d.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000)
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : '–')

const FUNNEL: Record<Funnel, string> = { visible_price: 'Preț vizibil (site, landinguri)', gated_price: 'Preț după formular (acces)' }
const STAGE: Record<Lead['stage'], string> = { lead: 'Formular trimis', checkout_started: 'Checkout început', ordered: 'Comandă plasată', purchased: 'Plătită' }
const ABANDON: Record<NonNullable<Lead['abandonment']>, string> = { lead_abandoned: 'Abandon după preț', checkout_abandoned: 'Checkout abandonat' }
const RECOVERY: Record<string, string> = {
  none: 'neprogramată',
  scheduled: 'programată',
  sent: 'trimisă',
  ineligible: 'fără acord de marketing (nu se trimite)',
  disabled: 'oprită din configurare',
  stopped: 'oprită',
  converted: 'a cumpărat',
}
const VIEWS = { '': 'Toate', abandoned: 'Abandonate', converted: 'Convertite' } as const

/**
 * Leads of both funnels: who gave contact details (price form or checkout contact step), what they looked at,
 * how far they got, whether a recovery email may go out and why not, and the order they placed. Plus the
 * two funnels side by side. Auth: the /admin Basic Auth in the proxy.
 */
export default async function LeadsPage({ searchParams }: PageProps<'/[lang]/admin/leaduri'>) {
  await connection()
  const sp = await searchParams
  const funnel = sp.funnel === 'visible_price' || sp.funnel === 'gated_price' ? (sp.funnel as Funnel) : undefined
  const view = sp.view === 'abandoned' || sp.view === 'converted' ? sp.view : undefined
  const days = [7, 30, 90].includes(Number(sp.zile)) ? Number(sp.zile) : 30
  const db = await getDb()
  const c = getConfig()
  const [list, stats] = await Promise.all([leads.list(db, { funnel, view }), funnelStats(db, daysAgo(days))])
  // Consent belongs to the person (the latest decision for the address), not to one form: that is what recovery checks.
  const consent = await marketing.states(db, list.map((l) => l.email))
  const consentText = (l: Lead) => {
    const now = consent.get(l.email.toLowerCase())
    return now === undefined ? 'nu' : now ? (l.marketingConsent ? 'da (bifat aici)' : 'da (dat în alt formular)') : 'retras / dezabonat'
  }
  const q = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams(Object.entries({ funnel, view, zile: String(days), ...p }).filter((e): e is [string, string] => !!e[1]))
    return `/admin/leaduri${u.size ? `?${u}` : ''}`
  }

  return (
    <>
      <h1 className="mt-2 text-[34px] tracking-[-0.03em]">Leaduri</h1>
      <p className="mt-2 max-w-[60em] text-[14.5px] text-muted">
        Funnel cu preț după formular: {c.features.priceGate ? 'activ' : 'oprit'} · captare în checkout: {c.features.abandonedCheckout ? 'activă' : 'oprită'} · emailuri de recuperare:{' '}
        {c.features.recoveryEmail ? `active (${c.recovery.firstMinutes} min, ${c.recovery.secondHours} h)` : 'oprite'}. Recuperarea pleacă doar cu acord de marketing și se oprește la comandă,
        dezabonare sau retragerea acordului.
      </p>

      <h2 className="mt-8 text-[22px] tracking-[-0.02em]">Comparația funnel-urilor</h2>
      <nav aria-label="Perioadă" className="mt-3 flex gap-2 text-[14px]">
        {[7, 30, 90].map((d) => (
          <Link key={d} href={q({ zile: String(d) })} aria-current={d === days ? 'page' : undefined} className={`rounded-full px-3.5 py-1.5 ${d === days ? 'bg-ink text-white' : 'bg-paper text-ink'}`}>
            {d} zile
          </Link>
        ))}
      </nav>
      <div className="mt-4 overflow-x-auto rounded-[16px] bg-paper">
        <table className="w-full min-w-[860px] text-left text-[14px] tabular-nums">
          <thead className="text-[12.5px] text-muted uppercase">
            <tr>
              {['Funnel', 'Afișări pagini', 'Leaduri', 'Prețuri deblocate', 'Checkout început', 'Abandonate', 'Recuperări trimise', 'Comenzi', 'Plătite', 'Venit încasat', 'Comenzi / afișări', 'Comenzi / leaduri'].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.funnel} className="border-t border-line">
                <td className="px-4 py-3 font-medium text-ink">{FUNNEL[s.funnel as Funnel]}</td>
                <td className="px-4 py-3">{s.visits}</td>
                <td className="px-4 py-3">{s.leads}</td>
                <td className="px-4 py-3">{s.funnel === 'gated_price' ? s.reveals : '–'}</td>
                <td className="px-4 py-3">{s.checkouts}</td>
                <td className="px-4 py-3">{s.abandoned}</td>
                <td className="px-4 py-3">{s.recovered_sent}</td>
                <td className="px-4 py-3">{s.orders}</td>
                <td className="px-4 py-3">{s.purchases}</td>
                <td className="px-4 py-3">{formatLei(s.revenue)}</td>
                <td className="px-4 py-3">{pct(s.orders, s.visits)}</td>
                <td className="px-4 py-3">{pct(s.orders, s.leads)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 max-w-[60em] text-[13px] text-muted">
        Afișări = încărcări de pagină numărate anonim (fără cookie), nu vizitatori unici. Comenzile cu card se numără doar plătite; rambursul și transferul la plasare. Traficul nu se împarte
        automat: comparația e corectă doar dacă cele două funnel-uri primesc trafic similar (de ex. două seturi de reclame Meta cu același buget și public).
      </p>

      <h2 className="mt-10 text-[22px] tracking-[-0.02em]">Lista</h2>
      <nav aria-label="Filtre" className="mt-3 flex flex-wrap gap-2 text-[14px]">
        {(Object.keys(VIEWS) as (keyof typeof VIEWS)[]).map((v) => (
          <Link key={v} href={q({ view: v || undefined })} aria-current={(view ?? '') === v ? 'page' : undefined} className={`rounded-full px-3.5 py-1.5 ${(view ?? '') === v ? 'bg-ink text-white' : 'bg-paper text-ink'}`}>
            {VIEWS[v]}
          </Link>
        ))}
        <span className="mx-1 self-center text-line">|</span>
        {([undefined, 'visible_price', 'gated_price'] as const).map((f) => (
          <Link key={f ?? 'all'} href={q({ funnel: f })} aria-current={funnel === f ? 'page' : undefined} className={`rounded-full px-3.5 py-1.5 ${funnel === f ? 'bg-ink text-white' : 'bg-paper text-ink'}`}>
            {f ? (f === 'gated_price' ? 'Acces (formular)' : 'Preț vizibil') : 'Ambele funnel-uri'}
          </Link>
        ))}
      </nav>

      <ul className="mt-5 space-y-3">
        {list.map((l) => (
          <li key={l.id} className="rounded-[16px] bg-paper p-5 text-[14.5px]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[16px] font-semibold text-ink">
                {l.name || '(fără nume)'} <span className="font-normal text-muted">· {interestOf(l).join(', ') || '–'}</span>
              </p>
              <p className="text-muted">{dt(l.createdAt)}</p>
            </div>
            <p className="mt-1">
              <a href={`mailto:${l.email}`} className="underline underline-offset-4">
                {l.email}
              </a>
              {l.phone && (
                <>
                  {' · '}
                  <a href={`tel:${l.phone.replace(/\s/g, '')}`} className="underline underline-offset-4">
                    {l.phone}
                  </a>
                </>
              )}
            </p>
            <dl className="mt-3 grid gap-x-6 gap-y-1 text-[13.5px] sm:grid-cols-2 lg:grid-cols-3">
              <Item k="Funnel" v={l.funnel === 'gated_price' ? 'Acces (preț după formular)' : 'Preț vizibil'} />
              <Item k="Etapă" v={STAGE[l.stage]} />
              <Item k="Abandon" v={l.abandonment ? ABANDON[l.abandonment] : '–'} />
              <Item k="Acord marketing" v={consentText(l)} />
              <Item k="Recuperare" v={`${RECOVERY[l.recoveryStatus] ?? l.recoveryStatus}${l.recoverySent ? ` · ${l.recoverySent} trimise` : ''}${l.lastRecoveryAt ? ` · ultima ${dt(l.lastRecoveryAt)}` : ''}`} />
              <Item k="Apel (AI sau om)" v={l.callConsent ? 'acord dat' : 'neeligibil: fără acord pentru apel'} />
              <Item k="Sursa" v={attributionSummary(l.attribution) || (l.landingHost ? l.landingHost : 'direct')} />
              <Item k="GHL" v={l.ghlContactId ? 'sincronizat' : 'în așteptare'} />
              <Item
                k="Comanda"
                v={
                  l.orderId ? (
                    <Link href={`/admin/orders/${l.orderId}`} className="underline underline-offset-4">
                      deschide
                    </Link>
                  ) : (
                    '–'
                  )
                }
              />
            </dl>
          </li>
        ))}
        {!list.length && <li className="rounded-[16px] bg-paper px-5 py-10 text-center text-muted">Niciun lead.</li>}
      </ul>
    </>
  )
}

function Item({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted">{k}:</dt>
      <dd className="text-ink">{v}</dd>
    </div>
  )
}
