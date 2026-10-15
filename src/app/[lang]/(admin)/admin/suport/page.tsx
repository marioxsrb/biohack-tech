import Link from 'next/link'
import { connection } from 'next/server'
import { getDb } from '@/server/db'
import { supportRequests } from '@/server/assistant/support'
import { assistantUsage, dailyLimit } from '@/server/assistant/usage'
import { SupportCard } from './SupportCard'

const FILTERS = { open: 'Deschise', urgent: 'Urgente', orders: 'Legate de comenzi', resolved: 'Istoric (rezolvate)', all: 'Toate' } as const
type Filter = keyof typeof FILTERS

/** Support requests from the website assistant: open first (urgent on top), then history. */
export default async function SupportPage({ searchParams }: PageProps<'/[lang]/admin/suport'>) {
  await connection()
  const raw = String((await searchParams).f ?? 'open')
  const filter: Filter = raw in FILTERS ? (raw as Filter) : 'open'
  const db = await getDb()
  const [list, counts, usage] = await Promise.all([supportRequests.list(db, { filter }), supportRequests.counts(db), assistantUsage.recent(db, 7)])
  const badge: Partial<Record<Filter, number>> = { open: counts.open, urgent: counts.urgent, orders: counts.orders }

  return (
    <>
      <h1 className="mt-2 text-[34px] tracking-[-0.03em]">Suport</h1>
      <p className="mt-1 text-[15px] text-muted">Cererile trimise de asistentul de chat: anulări, retururi, livrare, plăți, întrebări, „vreau să vorbesc cu cineva”. Fiecare cerere nouă vine și pe email la echipă.</p>
      <nav aria-label="Filtru" className="mt-4 flex flex-wrap gap-2 text-[14px]">
        {(Object.keys(FILTERS) as Filter[]).map((k) => (
          <Link key={k} href={k === 'open' ? '/admin/suport' : `/admin/suport?f=${k}`} aria-current={filter === k ? 'page' : undefined} className={`rounded-full px-3.5 py-1.5 ${filter === k ? 'bg-ink text-white' : 'bg-paper text-ink'}`}>
            {FILTERS[k]}
            {badge[k] !== undefined && ` (${badge[k]})`}
          </Link>
        ))}
      </nav>
      <ul className="mt-6 space-y-4">
        {list.map((r) => (
          <SupportCard key={r.id} r={r} />
        ))}
        {!list.length && <li className="rounded-[16px] bg-paper px-5 py-10 text-center text-muted">Nicio cerere aici.</li>}
      </ul>

      <section className="mt-8 rounded-[16px] bg-paper p-5">
        <h2 className="text-[17px] font-semibold text-ink">Consumul asistentului (Claude)</h2>
        <p className="mt-1 text-[13.5px] text-muted">Pe zile (ora României). Limita zilnică: {dailyLimit().toLocaleString('ro-RO')} mesaje; peste ea, asistentul răspunde că nu e disponibil, fără să cheme modelul.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-[14px] tabular-nums">
            <thead className="text-left text-[12.5px] text-muted">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Zi</th>
                <th className="py-1.5 pr-3 font-medium">Mesaje</th>
                <th className="py-1.5 pr-3 font-medium">Tokeni intrare</th>
                <th className="py-1.5 pr-3 font-medium">din cache</th>
                <th className="py-1.5 pr-3 font-medium">Tokeni ieșire</th>
                <th className="py-1.5 pr-3 font-medium">Erori (cotă)</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((u) => (
                <tr key={u.day} className="border-t border-line">
                  <td className="py-1.5 pr-3">{u.day}</td>
                  <td className="py-1.5 pr-3">{u.requests.toLocaleString('ro-RO')}</td>
                  <td className="py-1.5 pr-3">{u.inputTokens.toLocaleString('ro-RO')}</td>
                  <td className="py-1.5 pr-3">{u.cacheReadTokens.toLocaleString('ro-RO')}</td>
                  <td className="py-1.5 pr-3">{u.outputTokens.toLocaleString('ro-RO')}</td>
                  <td className={`py-1.5 pr-3 ${u.quotaErrors ? 'font-semibold text-red-deep' : ''}`}>
                    {u.errors} ({u.quotaErrors})
                  </td>
                </tr>
              ))}
              {!usage.length && (
                <tr>
                  <td colSpan={6} className="py-3 text-muted">
                    Încă nicio conversație.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
