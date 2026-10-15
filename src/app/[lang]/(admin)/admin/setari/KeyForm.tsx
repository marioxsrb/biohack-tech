'use client'

import { useActionState, useState } from 'react'
import { createKeyAction, type KeyFormState } from '../actions'

/** A new API key: name and access; the key itself is shown once, right here. */
export function KeyForm() {
  const [state, action, pending] = useActionState<KeyFormState, FormData>(createKeyAction, {})
  const [copied, setCopied] = useState(false)
  return (
    <div>
      <form action={action} className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1.5 text-[14px]">
          <span className="font-medium text-ink">Nume</span>
          <input name="name" placeholder="Grok" required className="field !min-h-10 w-[200px] !py-1.5" />
        </label>
        <label className="grid gap-1.5 text-[14px]">
          <span className="font-medium text-ink">Acces</span>
          <select name="scope" defaultValue="full" className="field !min-h-10 !py-1.5">
            <option value="full">Complet (citire și modificări)</option>
            <option value="read">Doar citire</option>
          </select>
        </label>
        <button className="cta sm" disabled={pending}>
          {pending ? 'Se generează…' : 'Generează cheie API'}
        </button>
      </form>
      {state.error && <p className="mt-2 text-[14px] text-red-deep">{state.error}</p>}
      {state.token && (
        <div className="mt-4 rounded-[14px] bg-[#fff4e5] p-4 text-[14px] text-[#7a4a00]">
          <p className="font-semibold">Cheia „{state.name}”: copiaz-o acum, nu o mai arătăm a doua oară.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded-[8px] bg-white px-2.5 py-1.5 font-mono text-[13px] break-all text-ink">{state.token}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(state.token!).then(() => setCopied(true))}
              className="btn-secondary sm"
            >
              {copied ? 'Copiată' : 'Copiază'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
