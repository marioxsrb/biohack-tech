'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { Arrow, Check } from '@/components/ui/icons'
import { site } from '@/config/site'
import { attributionParams } from '@/lib/attribution'
import { ENQUIRY_LIMITS, ENQUIRY_TOPICS, normalizeEnquiry, validateEnquiry, type EnquiryField, type EnquiryTopic } from '@/lib/enquiry'

const EMPTY = { name: '', email: '', phone: '', topic: 'produse' as EnquiryTopic, message: '' }

/**
 * The contact form: name, email, optional phone, topic, message. Validated here for quick feedback and
 * again on the server. Contacting us subscribes to nothing. A hidden field and the time spent on the
 * page keep simple bots out without a puzzle for people.
 */
export function ContactForm({ tone = 'light', compact = false }: { tone?: 'light' | 'dark'; compact?: boolean }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<EnquiryField, string>>>({})
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [reply, setReply] = useState('')
  const [startedAt] = useState(() => Date.now())
  const [attemptId, setAttemptId] = useState(() => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())))
  const honeypot = useRef<HTMLInputElement>(null)

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'sending') return
    const found = validateEnquiry(normalizeEnquiry(form))
    setErrors(found)
    const first = Object.keys(found)[0]
    if (first) return document.getElementById(`c-${first}`)?.focus()
    setState('sending')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          website: honeypot.current?.value ?? '',
          startedAt,
          attemptId,
          page: window.location.pathname,
          attribution: Object.fromEntries(attributionParams(window.location.search)),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.fields) setErrors(data.fields)
        throw new Error(data.message)
      }
      setReply(data.reference)
      setState('sent')
    } catch (err) {
      setReply(err instanceof Error && err.message ? err.message : `Nu am putut trimite mesajul. Scrie-ne la ${site.email}.`)
      setState('error')
    }
  }

  const dark = tone === 'dark'
  const label = `block text-[14px] font-semibold tracking-[0.005em] ${dark ? 'text-white' : 'text-ink'}`
  const err = (f: EnquiryField) =>
    errors[f] ? (
      <p id={`c-${f}-err`} className={`mt-1.5 text-[14px] ${dark ? 'text-[#ffb4a8]' : 'text-red-deep'}`}>
        {errors[f]}
      </p>
    ) : null
  const a11y = (f: EnquiryField) => ({ id: `c-${f}`, 'aria-invalid': !!errors[f] || undefined, 'aria-describedby': errors[f] ? `c-${f}-err` : undefined })

  if (state === 'sent') {
    return (
      <div role="status" className="flex min-h-[320px] flex-col items-start justify-center rounded-[20px] bg-mist p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-700 text-white">
          <Check className="h-6 w-6" />
        </span>
        <p className="mt-5 text-[26px] leading-tight tracking-[-0.03em] text-ink">Mulțumim. Am primit mesajul.</p>
        <p className="mt-2 max-w-[30em] text-[16px] leading-relaxed text-text">Îți răspundem pe email, în cel mult 24 de ore.</p>
        <p className="mt-3 rounded-full bg-paper px-3 py-1 font-mono text-[13px] tracking-[0.04em] text-muted">Referința ta: {reply}</p>
        <button
          type="button"
          className="tlink mt-5"
          onClick={() => {
            setForm(EMPTY)
            setAttemptId(crypto.randomUUID())
            setState('idle')
          }}
        >
          Trimite alt mesaj <Arrow />
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate aria-busy={state === 'sending'} className="grid gap-5 sm:grid-cols-2">
      <div>
        <label htmlFor="c-name" className={label}>
          Nume
        </label>
        <input {...a11y('name')} className="field soft mt-2" autoComplete="name" value={form.name} onChange={set('name')} maxLength={ENQUIRY_LIMITS.name + 20} required />
        {err('name')}
      </div>
      <div>
        <label htmlFor="c-email" className={label}>
          Email
        </label>
        <input {...a11y('email')} className="field soft mt-2" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set('email')} required />
        {err('email')}
      </div>
      <div>
        <label htmlFor="c-phone" className={label}>
          Telefon <span className={dark ? 'font-normal text-white/70' : 'font-normal text-muted'}>(opțional)</span>
        </label>
        <input {...a11y('phone')} className="field soft mt-2" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
        {err('phone')}
      </div>
      <div>
        <label htmlFor="c-topic" className={label}>
          Despre ce ne scrii
        </label>
        <select id="c-topic" className="field soft mt-2" value={form.topic} onChange={set('topic')}>
          {(Object.keys(ENQUIRY_TOPICS) as EnquiryTopic[]).map((t) => (
            <option key={t} value={t}>
              {ENQUIRY_TOPICS[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="c-message" className={label}>
          Mesaj
        </label>
        <textarea {...a11y('message')} rows={compact ? 4 : 6} style={{ minHeight: compact ? 110 : 150 }} className="field soft mt-2 resize-y" value={form.message} onChange={set('message')} maxLength={ENQUIRY_LIMITS.message + 200} required />
        {err('message')}
      </div>
      {/* Invisible to people (and to screen readers); bots tend to fill every field. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="c-website">Website</label>
        <input ref={honeypot} id="c-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="sm:col-span-2">
        <p className={`text-[14px] leading-relaxed ${dark ? 'text-white/75' : 'text-muted'}`}>
          Folosim datele doar ca să-ți răspundem la acest mesaj. Nu te abonăm la nimic. Detalii în{' '}
          <Link href="/privacy-policy" className="underline underline-offset-4">
            politica de confidențialitate
          </Link>
          .
        </p>
        {state === 'error' && (
          <p role="alert" className={`mt-3 text-[15px] ${dark ? 'text-[#ffb4a8]' : 'text-red-deep'}`}>
            {reply}
          </p>
        )}
        <button className="cta mt-5 w-full sm:w-auto" disabled={state === 'sending'}>
          {state === 'sending' ? 'Se trimite…' : 'Trimite mesajul'} <Arrow />
        </button>
      </div>
    </form>
  )
}
