'use client'

import { useActionState, useEffect, useState } from 'react'
import { digitalLinkAction, type DigitalLinkState } from '../../actions'

/** A fresh signed link (7 days), created on click, copied to the clipboard and shown once; never put in a URL. */
export function CopyDigitalLink({ orderId }: { orderId: string }) {
  const [state, action, busy] = useActionState<DigitalLinkState, FormData>(digitalLinkAction, null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!state?.url) return
    navigator.clipboard?.writeText(state.url).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }, [state])
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="id" value={orderId} />
      <button className="btn-secondary sm" disabled={busy}>
        {busy ? 'Se generează…' : 'Copiază un link securizat de descărcare'}
      </button>
      {state && (
        <p className={`max-w-[520px] text-[13px] ${state.ok ? 'text-cyan-700' : 'text-red-deep'}`}>
          {state.message} {state.ok && (copied ? 'Copiat în clipboard.' : 'Copiază-l de aici:')}
          {state.url && !copied && <input readOnly value={state.url} className="mt-1 block w-full rounded-[8px] border border-line bg-white px-2 py-1 font-mono text-[12px]" onFocus={(e) => e.currentTarget.select()} />}
        </p>
      )}
    </form>
  )
}
