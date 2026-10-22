'use client'

import { useState } from 'react'

const TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const MAX = 300 * 1024 * 1024

type State = { step: 'idle' | 'sending' | 'done' | 'error'; message?: string; progress?: number }

/**
 * Sends the video straight to the private storage (a one-path signed URL from /api/cont/review), then tells the
 * server it arrived. The rating is optional; the advertising consent is separate and off unless ticked.
 */
export function ReviewUpload({ token, orderId }: { token: string; orderId: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [rating, setRating] = useState('')
  const [ads, setAds] = useState(false)
  const [state, setState] = useState<State>({ step: 'idle' })

  const api = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/cont/review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ t: token, orderId, ...body }) })
    return (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; uploadUrl?: string; key?: string; error?: string }
  }

  const send = async () => {
    if (!file) return setState({ step: 'error', message: 'Alege fișierul video.' })
    if (!TYPES.includes(file.type)) return setState({ step: 'error', message: 'Video-ul trebuie să fie MP4, MOV sau WebM.' })
    if (file.size > MAX) return setState({ step: 'error', message: 'Video-ul poate avea cel mult 300 MB.' })
    setState({ step: 'sending', progress: 0 })
    const start = await api({ step: 'start', contentType: file.type, sizeBytes: file.size })
    if (!start.ok || !start.uploadUrl || !start.key) return setState({ step: 'error', message: start.error === 'already_sent' ? 'Pentru această comandă am primit deja un video.' : 'Nu putem primi video-ul acum. Încearcă mai târziu sau scrie-ne.' })
    const ok = await new Promise<boolean>((resolve) => {
      const x = new XMLHttpRequest()
      x.open('PUT', start.uploadUrl!)
      x.setRequestHeader('content-type', file.type)
      x.upload.onprogress = (e) => e.lengthComputable && setState({ step: 'sending', progress: Math.round((e.loaded / e.total) * 100) })
      x.onload = () => resolve(x.status >= 200 && x.status < 300)
      x.onerror = () => resolve(false)
      x.send(file)
    })
    if (!ok) return setState({ step: 'error', message: 'Încărcarea s-a întrerupt. Încearcă din nou.' })
    const done = await api({ step: 'done', key: start.key, contentType: file.type, sizeBytes: file.size, rating: rating ? Number(rating) : null, adConsent: ads })
    setState(done.ok ? { step: 'done' } : { step: 'error', message: 'Nu am putut înregistra video-ul. Încearcă din nou.' })
  }

  if (state.step === 'done')
    return <p className="mt-8 rounded-[16px] bg-cyan-50 px-5 py-4 text-[16px] text-cyan-700">Mulțumim! Am primit video-ul. Îl verificăm și îți scriem când recompensa este disponibilă.</p>

  return (
    <div className="mt-8 grid gap-5">
      <label className="grid gap-2 text-[15px] text-ink">
        Video-ul tău (MP4, MOV sau WebM, cel mult 300 MB)
        <input type="file" accept="video/mp4,video/quicktime,video/webm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="field" />
      </label>
      <label className="grid gap-2 text-[15px] text-ink">
        Cum ți s-a părut produsul? (opțional)
        <select value={rating} onChange={(e) => setRating(e.target.value)} className="field">
          <option value="">Nu aleg</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} din 5
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-start gap-3 text-[14.5px] text-text">
        <input type="checkbox" checked={ads} onChange={(e) => setAds(e.target.checked)} className="mt-1" />
        <span>Sunt de acord ca Biohack Tech să folosească video-ul meu în reclame și pe site. Opțional: recompensa nu depinde de acest acord, iar acordul îl pot retrage oricând scriindu-vă.</span>
      </label>
      {state.step === 'error' && <p className="text-[15px] text-ink">{state.message}</p>}
      <button type="button" onClick={() => void send()} disabled={state.step === 'sending'} className="cta">
        {state.step === 'sending' ? `Se încarcă… ${state.progress ?? 0}%` : 'Trimite video-ul'}
      </button>
    </div>
  )
}
