'use client'

import { startTransition, useActionState } from 'react'
import { testCallAction, type TestCallState } from '../actions'

type P = { id: string; name: string; price: number | null; variants: { id: string; label: string }[] }

/** An imaginary cart and a number: the agent calls with exactly that context (nothing real is changed). */
export function TestCallForm({ products }: { products: P[] }) {
  const [state, action, pending] = useActionState<TestCallState, FormData>(testCallAction, {})
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        startTransition(() => action(data))
      }}
      className="grid gap-4 text-[14.5px]"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="font-medium text-ink">Număr de telefon</span>
          <input name="phone" required inputMode="tel" placeholder="07xx xxx xxx" className="field" />
        </label>
        <label className="grid gap-1.5">
          <span className="font-medium text-ink">Prenume (cum îl salută agentul)</span>
          <input name="firstName" placeholder="Mario" className="field" />
        </label>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 font-medium text-ink">Coșul imaginar (coș nefinalizat)</legend>
        {products.map((p, i) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-[12px] bg-mist px-3 py-2">
            <input name={`qty:${p.id}`} type="number" min={0} max={10} defaultValue={i === 0 ? 1 : 0} className="field !min-h-10 !w-[76px] !py-1.5" aria-label={`Cantitate ${p.name}`} />
            <span className="min-w-[140px] text-ink">
              {p.name}
              {p.price !== null && <span className="text-muted"> · {(p.price / 100).toLocaleString('ro-RO')} lei</span>}
            </span>
            {p.variants.length > 1 && (
              <select name={`variant:${p.id}`} className="field !min-h-10 !w-auto !py-1.5" aria-label={`Varianta ${p.name}`}>
                {p.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </fieldset>
      <label className="flex items-start gap-2.5">
        <input type="checkbox" name="emailSent" value="da" defaultChecked className="mt-0.5 h-4 w-4 accent-[var(--color-ink)]" />
        <span>Agentul crede că emailul cu codul BIOHACK10 a fost trimis (spune „găsiți codul pe email”).</span>
      </label>
      <label className="flex items-start gap-2.5">
        <input type="checkbox" name="consent" value="da" className="mt-0.5 h-4 w-4 accent-[var(--color-ink)]" />
        <span>Confirm că persoana de la acest număr a acceptat apelul de test.</span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button className="cta" disabled={pending}>
          {pending ? 'Se apelează…' : 'Sună acum'}
        </button>
        {state.placed && <span className="font-medium text-[#167a4a]">Apelul pornește către {state.placed}. Rezultatul apare mai jos după convorbire.</span>}
        {state.error && <span className="text-red-deep">{state.error}</span>}
      </div>
    </form>
  )
}
