'use client'

import { useActionState, useState } from 'react'
import { createPromoAction, type PromoFormState } from '../actions'

/** Creating a promo code: the type and value, then the optional limits. */
export function PromoForm({ products }: { products: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<PromoFormState, FormData>(createPromoAction, {})
  const [kind, setKind] = useState<'percent' | 'fixed'>('percent')
  return (
    <form action={action} className="mt-4 grid gap-4 rounded-[16px] bg-paper p-5 text-[14.5px] sm:grid-cols-2 lg:grid-cols-3">
      <label className="grid gap-1.5">
        <span className="font-medium text-ink">Cod</span>
        <input name="code" required placeholder="VARA10" autoComplete="off" className="field uppercase" />
      </label>
      <label className="grid gap-1.5">
        <span className="font-medium text-ink">Tip</span>
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as 'percent' | 'fixed')} className="field">
          <option value="percent">Procent din comandă</option>
          <option value="fixed">Sumă fixă (lei)</option>
        </select>
      </label>
      <label className="grid gap-1.5">
        <span className="font-medium text-ink">{kind === 'percent' ? 'Procent (1–90)' : 'Suma (lei)'}</span>
        <input name="value" required inputMode="decimal" placeholder={kind === 'percent' ? '10' : '100'} className="field" />
      </label>
      <fieldset className="grid gap-1.5 sm:col-span-2 lg:col-span-3">
        <legend className="mb-1.5 font-medium text-ink">Produse (niciunul bifat = toate)</legend>
        <div className="flex flex-wrap gap-4">
          {products.map((p) => (
            <label key={p.id} className="flex items-center gap-2">
              <input type="checkbox" name="products" value={p.id} className="h-4 w-4 accent-[var(--color-ink)]" /> {p.name}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-1.5">
        <span className="font-medium text-ink">Comandă minimă (lei, opțional)</span>
        <input name="min" inputMode="decimal" placeholder="0" className="field" />
      </label>
      <label className="grid gap-1.5">
        <span className="font-medium text-ink">Valabil de la (opțional)</span>
        <input name="starts" type="datetime-local" className="field" />
      </label>
      <label className="grid gap-1.5">
        <span className="font-medium text-ink">Valabil până la (opțional)</span>
        <input name="ends" type="datetime-local" className="field" />
      </label>
      <label className="grid gap-1.5">
        <span className="font-medium text-ink">Număr maxim de utilizări (opțional)</span>
        <input name="max" inputMode="numeric" placeholder="nelimitat" className="field" />
      </label>
      <label className="flex items-center gap-2 self-end pb-3">
        <input type="checkbox" name="once" value="da" className="h-4 w-4 accent-[var(--color-ink)]" /> O singură dată pe client (email)
      </label>
      <label className="grid gap-1.5">
        <span className="font-medium text-ink">Notă internă (opțional)</span>
        <input name="note" placeholder="ex. campanie Instagram noiembrie" className="field" />
      </label>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-3">
        <button type="submit" disabled={pending} className="cta">
          {pending ? 'Se salvează…' : 'Creează codul'}
        </button>
        {state.error && <p className="text-red-deep">{state.error}</p>}
        {state.created && <p className="text-ink">Codul {state.created} a fost creat și este activ.</p>}
      </div>
    </form>
  )
}
