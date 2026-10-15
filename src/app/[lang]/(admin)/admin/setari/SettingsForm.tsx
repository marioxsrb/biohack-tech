'use client'

import { startTransition, useActionState, useState } from 'react'
import { saveSettingsAction, type SettingsFormState } from '../actions'

type Row = { id: string; name: string; codePriceLei: number | null; overrideLei: number | null; soldOut: boolean; variants: number }

const fmt = (lei: number | null) => (lei === null ? '' : String(lei).replace('.', ','))

/** Prices, stock and the two switches, saved together (a price change needs the confirmation box). */
export function SettingsForm({ rows, welcomePopup, callsPaused, assistant }: { rows: Row[]; welcomePopup: boolean; callsPaused: boolean; assistant: boolean }) {
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(saveSettingsAction, {})
  const [touched, setTouched] = useState(false)
  return (
    // Submitted by hand, not through `action`: React would reset the fields after a refused save (the typed prices).
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        setTouched(false)
        startTransition(() => action(data))
      }}
      onChange={() => setTouched(true)}
      className="grid gap-4"
    >
      <section className="rounded-[18px] bg-paper p-5">
        <h2 className="text-[17px] font-semibold text-ink">Prețuri și stoc</h2>
        <p className="mt-1 text-[14px] text-muted">În lei, cu TVA. Gol = prețul inițial din cod. Noul preț apare peste tot (site, landinguri, coș, comenzi, facturi, agentul AI) în câteva secunde. Comenzile deja plasate nu se schimbă.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-[14.5px]">
            <thead>
              <tr className="text-left text-[12.5px] text-muted">
                <th className="py-1.5 font-medium">Produs</th>
                <th className="py-1.5 font-medium">Preț inițial</th>
                <th className="py-1.5 font-medium">Preț nou (lei)</th>
                <th className="py-1.5 font-medium">Stoc epuizat</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-mist-2">
                  <td className="py-2.5 font-medium text-ink">
                    {r.name}
                    {r.variants > 1 && <span className="block text-[12.5px] font-normal text-muted">același preț pentru toate cele {r.variants} variante</span>}
                  </td>
                  <td className="py-2.5 text-muted tabular-nums">{r.codePriceLei === null ? '–' : `${r.codePriceLei.toLocaleString('ro-RO')} lei`}</td>
                  <td className="py-2.5">
                    <input name={`price:${r.id}`} defaultValue={fmt(r.overrideLei)} inputMode="decimal" placeholder={fmt(r.codePriceLei)} className="field !min-h-10 w-[140px] !py-1.5" aria-label={`Preț nou ${r.name}`} />
                  </td>
                  <td className="py-2.5">
                    <input type="checkbox" name={`soldOut:${r.id}`} value="da" defaultChecked={r.soldOut} className="h-5 w-5 accent-[var(--color-ink)]" aria-label={`Stoc epuizat ${r.name}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <label className="mt-4 flex items-start gap-2.5 text-[14px] text-text">
          <input type="checkbox" name="confirmPrices" value="da" className="mt-0.5 h-4 w-4 accent-[var(--color-ink)]" />
          Confirm prețurile noi (obligatoriu când schimbi un preț).
        </label>
      </section>

      <section className="rounded-[18px] bg-paper p-5">
        <h2 className="text-[17px] font-semibold text-ink">Comutatoare</h2>
        <label className="mt-3 flex items-start gap-2.5 text-[14.5px] text-text">
          <input type="checkbox" name="welcomePopup" value="da" defaultChecked={welcomePopup} className="mt-0.5 h-5 w-5 accent-[var(--color-ink)]" />
          <span>
            <b className="text-ink">Popup 10% (LONGEVITY10)</b> pe site și landinguri după 40 de secunde, iar pe acces la 40 de secunde după ce prețul e deblocat.
          </span>
        </label>
        <label className="mt-3 flex items-start gap-2.5 text-[14.5px] text-text">
          <input type="checkbox" name="callsPaused" value="da" defaultChecked={callsPaused} className="mt-0.5 h-5 w-5 accent-[var(--color-ink)]" />
          <span>
            <b className="text-ink">Pauză la apelurile AI.</b> Apelurile programate așteaptă și se reiau când scoți pauza (verificat la 30 de minute).
          </span>
        </label>
        <label className="mt-3 flex items-start gap-2.5 text-[14.5px] text-text">
          <input type="checkbox" name="assistant" value="da" defaultChecked={assistant} className="mt-0.5 h-5 w-5 accent-[var(--color-ink)]" />
          <span>
            <b className="text-ink">Asistentul de chat</b> (bulina din dreapta jos) pe toate site-urile: produse, coș, comenzi verificate cu cod, cereri către echipă.
          </span>
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button className="cta" disabled={pending}>
          {pending ? 'Se salvează…' : 'Salvează setările'}
        </button>
        {state.saved && !touched && <span className="text-[14.5px] font-medium text-[#167a4a]">Salvat. Site-ul folosește noile setări.</span>}
        {state.error && <span className="text-[14.5px] text-red-deep">{state.error}</span>}
        {state.problems?.map((p) => (
          <span key={p} className="text-[14.5px] text-red-deep">
            {p}
          </span>
        ))}
      </div>
    </form>
  )
}
