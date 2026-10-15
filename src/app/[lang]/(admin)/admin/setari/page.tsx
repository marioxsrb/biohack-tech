import type { Metadata } from 'next'
import { connection } from 'next/server'
import { PROMOTIONS } from '@/config/promotions'
import { site } from '@/config/site'
import { getDb } from '@/server/db'
import { adminKeys } from '@/server/admin-keys'
import { ensureStoreSettings, priceTable, readStoreSettings } from '@/server/store-settings'
import { revokeKeyAction } from '../actions'
import { KeyForm } from './KeyForm'
import { SettingsForm } from './SettingsForm'

export const metadata: Metadata = { title: 'Setări' }

const dt = (d: Date | null) => (d ? d.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–')

/** What the team changes without a deploy: prices, stock, the popup, the AI calls pause; and the API keys. */
export default async function SettingsPage() {
  await connection()
  const db = await getDb()
  await ensureStoreSettings(0)
  const [settings, keys, log] = await Promise.all([readStoreSettings(db), adminKeys.list(db), db.query('select at, actor, action, details from admin_audit order by at desc limit 15')])
  const rows = priceTable().map((p) => {
    const override = settings.prices[p.id]
    const code = p.codePrice
    return {
      id: p.id,
      name: p.name,
      codePriceLei: typeof code === 'number' ? code / 100 : null,
      overrideLei: typeof override === 'number' ? override / 100 : null,
      soldOut: p.soldOut,
      variants: p.variants.length,
    }
  })
  return (
    <div className="mx-auto max-w-[1000px]">
      <h1 className="text-[30px] tracking-[-0.03em]">Setări</h1>
      <p className="mt-1 text-[15px] text-text">Ce poți schimba fără o nouă versiune a site-ului. Fiecare modificare rămâne în jurnal.</p>

      <div className="mt-5">
        <SettingsForm rows={rows} welcomePopup={settings.welcomePopup} callsPaused={settings.callsPaused} assistant={settings.assistant} />
      </div>

      <section className="mt-4 rounded-[18px] bg-paper p-5">
        <h2 className="text-[17px] font-semibold text-ink">Promoții automate</h2>
        <p className="mt-1 text-[14px] text-muted">
          Apar scrise în textele site-ului, ale landingurilor, în Termeni și la agentul AI, așa că se schimbă împreună cu acele texte (la cerere, nu de aici), ca să nu afișăm o ofertă care nu mai e valabilă. Codurile promoționale le gestionezi în „Coduri promoționale”.
        </p>
        <ul className="mt-3 grid gap-2 text-[14.5px]">
          {PROMOTIONS.map((p) => (
            <li key={p.id} className="rounded-[12px] bg-mist px-3.5 py-2.5">
              <b className="text-ink">{p.label}</b>
              <span className="block text-[13.5px] text-muted">{p.line}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-[18px] bg-paper p-5">
        <h2 className="text-[17px] font-semibold text-ink">Chei API</h2>
        <p className="mt-1 text-[14px] text-muted">
          O cheie dă acces la tot adminul prin API (comenzi, leaduri și apeluri, coduri, prețuri și setări, mesaje, raport), pentru un asistent AI sau o automatizare. Cu „doar citire” se poate doar consulta. Lista completă: <code className="text-ink">GET {site.url}/api/admin/v1</code>, cu headerul <code className="text-ink">Authorization: Bearer &lt;cheie&gt;</code>.
        </p>
        <div className="mt-4">
          <KeyForm />
        </div>
        {keys.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[620px] text-[14px]">
              <thead>
                <tr className="text-left text-[12.5px] text-muted">
                  <th className="py-1.5 font-medium">Nume</th>
                  <th className="py-1.5 font-medium">Acces</th>
                  <th className="py-1.5 font-medium">Începe cu</th>
                  <th className="py-1.5 font-medium">Creată</th>
                  <th className="py-1.5 font-medium">Folosită ultima dată</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className={`border-t border-mist-2 ${k.revokedAt ? 'text-muted line-through' : ''}`}>
                    <td className="py-2 font-medium">{k.name}</td>
                    <td className="py-2">{k.scope === 'full' ? 'complet' : 'citire'}</td>
                    <td className="py-2 font-mono text-[13px]">bt_live_{k.prefix}_…</td>
                    <td className="py-2">{dt(k.createdAt)}</td>
                    <td className="py-2">{dt(k.lastUsedAt)}</td>
                    <td className="py-2 text-right">
                      {!k.revokedAt && (
                        <form action={revokeKeyAction}>
                          <input type="hidden" name="id" value={k.id} />
                          <button className="text-[13.5px] text-red-deep underline underline-offset-4">Revocă</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-[18px] bg-paper p-5">
        <h2 className="text-[17px] font-semibold text-ink">Jurnal</h2>
        {log.rows.length ? (
          <ul className="mt-2 divide-y divide-mist-2 text-[14px]">
            {log.rows.map((r, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="text-ink">
                  {String(r.action)} <span className="text-muted">· {String(r.actor)}</span>
                </span>
                <span className="text-muted tabular-nums">{dt(new Date(r.at as string))}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[14px] text-muted">Nicio modificare încă.</p>
        )}
      </section>
    </div>
  )
}
