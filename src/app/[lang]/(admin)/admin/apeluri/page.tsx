import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { products, variantLabel } from '@/content/catalog'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { callBlocklist } from '@/server/calling/blocklist'
import { recentConversations, type ConversationRow } from '@/server/calling/conversations'
import { testCalls } from '@/server/calling/test-call'
import { ensureStoreSettings } from '@/server/store-settings'
import { addBlockAction, removeBlockAction } from '../actions'
import { TestCallForm } from './TestCallForm'

export const metadata: Metadata = { title: 'Apeluri AI' }

const dt = (d: Date) => d.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const STATUS: Record<string, string> = { dialing: 'în curs', completed: 'încheiat', failed: 'nu s-a vorbit' }
/** What the line reported, in words: Twilio says "busy" for a declined call too. */
const LINE: Record<string, string> = {
  busy: 'respins sau ocupat (persoana a închis, a respins apelul sau vorbea)',
  'no-answer': 'nu a răspuns',
  no_answer: 'nu a răspuns',
  failed: 'apelul nu a putut fi inițiat',
  answered: 'a răspuns',
  success: 'reușit (după analiza ElevenLabs)',
  failure: 'fără succes (după analiza ElevenLabs)',
}
const CONV_STATUS: Record<string, string> = { initiated: 'inițiat', 'in-progress': 'în curs', processing: 'se procesează', done: 'încheiat', failed: 'eșuat' }
const explain = (v: string | null) => (v ? (LINE[v] ?? LINE[v.replace('initiation failed: ', '')] ?? v) : null)

/** The AI agent: numbers never to call, and test calls with an imaginary order. */
export default async function CallsPage() {
  await connection()
  await ensureStoreSettings(0)
  const db = await getDb()
  const c = getConfig()
  const [blocked, tests] = await Promise.all([callBlocklist.list(db), testCalls.recent(db, 20)])
  // Every conversation of the agent, inbound and outbound, straight from ElevenLabs (a failure only hides this list).
  let convs: ConversationRow[] | null = null
  let convError: string | null = null
  if (c.elevenlabs) {
    try {
      convs = await recentConversations(db, c.elevenlabs, 25)
    } catch (e) {
      convError = (e as Error).message.slice(0, 160)
    }
  }
  const options = products
    .filter((p) => p.price !== null)
    .map((p) => ({ id: p.id, name: p.name, price: p.variablePrice ? null : p.price, variants: (p.variants ?? []).map((v) => ({ id: v.id, label: variantLabel(p, v) })) }))
  return (
    <div className="mx-auto max-w-[1000px]">
      <h1 className="text-[30px] tracking-[-0.03em]">Apeluri AI</h1>
      <p className="mt-1 text-[15px] text-text">
        Apeluri automate: {c.calling.enabled ? (c.calling.dryRun ? 'active în dry run' : c.calling.testMode ? 'mod test (doar numerele din lista de test)' : 'ACTIVE') : 'oprite'} · ore {c.calling.hours.start}–{c.calling.hours.end}. Rezultatele pe leaduri sunt în{' '}
        <Link href="/admin/leaduri" className="underline underline-offset-4">
          Leaduri
        </Link>
        .
      </p>

      <section className="mt-5 rounded-[18px] bg-paper p-5">
        <h2 className="text-[17px] font-semibold text-ink">Conversații (ElevenLabs)</h2>
        <p className="mt-1 text-[14px] text-muted">
          Ultimele 25 de apeluri ale agentului, primite și date. „Deschide” arată conversația în ElevenLabs (transcript, analiză și, dacă înregistrarea e pornită, audio); merge doar dacă ești logat în contul ElevenLabs.
        </p>
        {!c.elevenlabs ? (
          <p className="mt-3 text-[14px] text-muted">ElevenLabs nu e configurat.</p>
        ) : convError ? (
          <p className="mt-3 text-[14px] text-muted">Lista nu poate fi citită acum: {convError}</p>
        ) : convs && convs.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-[14px]">
              <thead>
                <tr className="text-left text-[12.5px] text-muted">
                  <th className="py-1.5 font-medium">Când</th>
                  <th className="py-1.5 font-medium">Număr</th>
                  <th className="py-1.5 font-medium">Direcție</th>
                  <th className="py-1.5 text-right font-medium">Durată</th>
                  <th className="py-1.5 pl-4 font-medium">Rezultat</th>
                  <th className="py-1.5 font-medium">Stare</th>
                  <th className="py-1.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {convs.map((v) => (
                  <tr key={v.id} className="border-t border-mist-2 align-top">
                    <td className="py-2 text-muted tabular-nums">{dt(v.at)}</td>
                    <td className="py-2 tabular-nums">{v.phone ?? '–'}</td>
                    <td className="py-2">{v.direction === 'inbound' ? 'primit' : v.direction === 'outbound' ? 'dat' : '–'}</td>
                    <td className="py-2 text-right tabular-nums">{v.durationSecs ? `${v.durationSecs}s` : '–'}</td>
                    <td className="py-2 pl-4">
                      {explain(v.result) ?? '–'}
                      {v.title && <span className="block text-[12.5px] text-muted">{v.title}</span>}
                    </td>
                    <td className="py-2">{CONV_STATUS[v.status] ?? v.status}</td>
                    <td className="py-2 text-right">
                      <a href={v.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                        Deschide
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-[14px] text-muted">Nicio conversație încă.</p>
        )}
      </section>

      <section className="mt-4 rounded-[18px] bg-paper p-5">
        <h2 className="text-[17px] font-semibold text-ink">Test: sună cu o comandă imaginară</h2>
        <p className="mt-1 mb-4 text-[14px] text-muted">Agentul sună cu exact datele unui apel real (prenume, produse, cantități, total cu promoțiile de azi, codul BIOHACK10). Nu se creează lead, comandă, acord sau email și nu se schimbă nimic în GHL.</p>
        <TestCallForm products={options} />
        {tests.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[720px] text-[14px]">
              <thead>
                <tr className="text-left text-[12.5px] text-muted">
                  <th className="py-1.5 font-medium">Când</th>
                  <th className="py-1.5 font-medium">Număr</th>
                  <th className="py-1.5 font-medium">Comanda</th>
                  <th className="py-1.5 font-medium">Stare</th>
                  <th className="py-1.5 font-medium">Rezultat</th>
                  <th className="py-1.5 text-right font-medium">Durată</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t) => (
                  <tr key={t.id} className="border-t border-mist-2 align-top">
                    <td className="py-2 text-muted tabular-nums">{dt(t.createdAt)}</td>
                    <td className="py-2 tabular-nums">{t.phone}</td>
                    <td className="py-2">
                      {String(t.vars.product_quantities || t.vars.product_names)}
                      <span className="block text-[12.5px] text-muted">{t.scenario === 'cart' ? `coș · ${t.vars.cart_total}` : 'a cerut prețul'}</span>
                    </td>
                    <td className="py-2">{STATUS[t.status] ?? t.status}</td>
                    <td className="py-2">
                      {explain(t.outcome) ?? explain(t.error) ?? '–'}
                      {t.agentOutcome && <span className="block text-[12.5px] text-muted">notat de agent: {t.agentOutcome}</span>}
                    </td>
                    <td className="py-2 text-right tabular-nums">{t.durationSecs != null ? `${t.durationSecs}s` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Link href="/admin/apeluri" className="mt-2 inline-block text-[13.5px] text-muted underline underline-offset-4">
              Reîncarcă rezultatele
            </Link>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-[18px] bg-paper p-5">
        <h2 className="text-[17px] font-semibold text-ink">Lista „nu suna”</h2>
        <p className="mt-1 text-[14px] text-muted">Numerele de aici nu sunt sunate niciodată de agent, indiferent de acord, mod test sau reîncercări (nici la test). Apelurile deja programate pentru ele se anulează.</p>
        <form action={addBlockAction} className="mt-4 flex flex-wrap items-end gap-3 text-[14px]">
          <label className="grid gap-1.5">
            <span className="font-medium text-ink">Număr</span>
            <input name="phone" required inputMode="tel" placeholder="07xx xxx xxx" className="field !min-h-10 !w-[200px] !py-1.5" />
          </label>
          <label className="grid gap-1.5">
            <span className="font-medium text-ink">Notă (opțional)</span>
            <input name="note" placeholder="ex. a cerut să nu fie sunat" className="field !min-h-10 !w-[260px] !py-1.5" />
          </label>
          <button className="btn-secondary sm">Adaugă</button>
        </form>
        {blocked.length > 0 ? (
          <ul className="mt-4 divide-y divide-mist-2 text-[14px]">
            {blocked.map((b) => (
              <li key={b.phone} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span>
                  <b className="text-ink tabular-nums">{b.phone}</b>
                  {b.note && <span className="text-muted"> · {b.note}</span>}
                  <span className="block text-[12.5px] text-muted">
                    adăugat {dt(b.createdAt)}
                    {b.createdBy ? ` · ${b.createdBy}` : ''}
                  </span>
                </span>
                <form action={removeBlockAction}>
                  <input type="hidden" name="phone" value={b.phone} />
                  <button className="text-[13.5px] text-muted underline underline-offset-4 hover:text-ink">Scoate din listă</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[14px] text-muted">Niciun număr în listă.</p>
        )}
      </section>
    </div>
  )
}
