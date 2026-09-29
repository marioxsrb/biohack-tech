'use client'

import { useActionState } from 'react'
import { withdrawAction, type WithdrawalFormState } from './actions'

const FIELDS = [
  { name: 'name', label: 'Nume și prenume', autoComplete: 'name', type: 'text' },
  { name: 'email', label: 'Emailul folosit la comandă', autoComplete: 'email', type: 'email', hint: 'Aici îți trimitem confirmarea.' },
  { name: 'orderNumber', label: 'Numărul comenzii', autoComplete: 'off', type: 'text', hint: 'De forma BHT-20260929-0001. Îl găsești în emailul de confirmare.' },
] as const

export function WithdrawalForm() {
  const [state, action, pending] = useActionState<WithdrawalFormState, FormData>(withdrawAction, {})
  const v = state.values ?? {}
  const err = state.errors ?? {}
  return (
    <form action={action} noValidate className="space-y-4 rounded-[20px] bg-paper p-6 max-sm:px-5">
      {FIELDS.map((f) => (
        <div key={f.name}>
          <label htmlFor={`w-${f.name}`} className="mb-1.5 block text-[14.5px] font-medium text-ink">
            {f.label}
          </label>
          <input
            id={`w-${f.name}`}
            name={f.name}
            type={f.type}
            autoComplete={f.autoComplete}
            defaultValue={v[f.name] ?? ''}
            aria-invalid={!!err[f.name]}
            aria-describedby={err[f.name] ? `we-${f.name}` : 'hint' in f ? `wh-${f.name}` : undefined}
            className={`field ${err[f.name] ? 'field-error' : ''}`}
            required
          />
          {err[f.name] ? (
            <p id={`we-${f.name}`} className="mt-1.5 text-[14px] text-red-deep">
              {err[f.name]}
            </p>
          ) : (
            'hint' in f && (
              <p id={`wh-${f.name}`} className="mt-1.5 text-[13.5px] text-muted">
                {f.hint}
              </p>
            )
          )}
        </div>
      ))}
      <div>
        <label htmlFor="w-items" className="mb-1.5 block text-[14.5px] font-medium text-ink">
          Produsele la care renunți <span className="font-normal text-muted">(opțional)</span>
        </label>
        <textarea id="w-items" name="items" rows={2} defaultValue={v.items ?? ''} placeholder="Toate produsele din comandă" className="field" aria-describedby="wh-items" />
        <p id="wh-items" className="mt-1.5 text-[13.5px] text-muted">
          Lasă gol dacă renunți la toată comanda.
        </p>
      </div>
      <div>
        <label htmlFor="w-message" className="mb-1.5 block text-[14.5px] font-medium text-ink">
          Mesaj <span className="font-normal text-muted">(opțional)</span>
        </label>
        <textarea id="w-message" name="message" rows={3} defaultValue={v.message ?? ''} className="field" />
      </div>
      {state.message && (
        <p role="alert" className="rounded-[12px] bg-paper px-4 py-3 text-[14.5px] text-ink shadow-[inset_0_0_0_1px_var(--color-red)]">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="cta w-full disabled:cursor-wait disabled:opacity-80">
        {pending ? 'Se trimite…' : 'Confirmați retragerea'}
      </button>
      <p className="text-center text-[14px] text-muted">Primești pe email confirmarea, cu conținutul cererii, data și ora.</p>
    </form>
  )
}
