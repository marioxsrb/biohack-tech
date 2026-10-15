'use client'

import Link from '@/components/ui/Link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Close } from '@/components/ui/icons'
import { useLocale } from '@/i18n/LocaleProvider'
import { WELCOME_CONSENT_TEXT, WELCOME_CONSENT_TEXT_EN } from '@/lib/consent/marketing'

/** One minute on the site (across pages of the same visit) before the offer shows. */
const AFTER_MS = 60_000
/** Closed without an address: not again for a week. Sent: never again on this browser. */
const SNOOZE_MS = 7 * 86_400_000
const STATE_KEY = 'bt-welcome'
const START_KEY = 'bt-welcome-start'
const HIDDEN = /\/(checkout|cart|admin|dezabonare|reluare|retragere)(\/|$)/

const COPY = {
  ro: {
    title: '10% reducere la comanda ta',
    lead: 'Lasă-ne adresa de email și îți trimitem imediat codul.',
    placeholder: 'Adresa ta de email',
    send: 'Trimite-mi codul',
    sending: 'Se trimite…',
    done: 'Gata! Verifică emailul: codul de 10% e pe drum.',
    privacy: 'Confidențialitate',
    close: 'Închide',
    invalid: 'Verifică adresa de email.',
    failed: 'Nu am putut trimite codul. Încearcă din nou.',
  },
  en: {
    title: '10% off your order',
    lead: 'Leave us your email address and we will send you the code right away.',
    placeholder: 'Your email address',
    send: 'Send me the code',
    sending: 'Sending…',
    done: 'Done! Check your email: your 10% code is on its way.',
    privacy: 'Privacy',
    close: 'Close',
    invalid: 'Check the email address.',
    failed: 'We could not send the code. Please try again.',
  },
}

const read = (k: string) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {}
}

/**
 * The website's 10% offer: a small card (bottom left on desktop, bottom on phones) after a minute on the main site
 * or a landing, never on acces (prices behind the form) and never in the cart, checkout or admin. It never takes
 * focus or blocks the page. The address gets LONGEVITY10 by email (/api/welcome).
 */
export function WelcomePopup() {
  const locale = useLocale()
  const t = COPY[locale]
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const hiddenHere = HIDDEN.test(pathname)

  useEffect(() => {
    // acces.<domain>: prices are behind the form there (same test as the gate's pre-paint script).
    if (hiddenHere || /^acces\./.test(location.hostname)) return
    const s = read(STATE_KEY)
    if (s === 'sent' || (s && Number(s) > Date.now())) return
    let start = 0
    try {
      start = Number(sessionStorage.getItem(START_KEY) ?? 0)
      if (!start) sessionStorage.setItem(START_KEY, String((start = Date.now())))
    } catch {
      start = Date.now()
    }
    // Never on top of the cookie choice: waits until that banner is answered.
    let timer: ReturnType<typeof setTimeout>
    const show = () => (document.querySelector('.consent-in') ? (timer = setTimeout(show, 3000)) : setOpen(true))
    timer = setTimeout(show, Math.max(0, start + AFTER_MS - Date.now()))
    return () => clearTimeout(timer)
  }, [hiddenHere])

  if (!open || hiddenHere) return null

  const close = () => {
    setOpen(false)
    if (state !== 'done') write(STATE_KEY, String(Date.now() + SNOOZE_MS))
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (state === 'busy') return
    const value = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setState('error')
      setError(t.invalid)
      return
    }
    setState('busy')
    try {
      const res = await fetch('/api/welcome', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: value, page: pathname, website: (e.currentTarget.elements.namedItem('website') as HTMLInputElement | null)?.value ?? '' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message ?? t.failed)
      setState('done')
      write(STATE_KEY, 'sent')
    } catch (err) {
      setState('error')
      setError(err instanceof Error && err.message ? err.message : t.failed)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="welcome-title"
      className="added-popup fixed z-[250] w-[min(360px,calc(100vw-2*var(--gut)))] rounded-[20px] bg-paper p-5 shadow-[0_24px_60px_-20px_rgba(8,17,19,.35),0_0_0_1px_rgba(8,17,19,.06)] md:bottom-6 md:left-6 max-md:inset-x-[var(--gut)] max-md:bottom-[max(12px,env(safe-area-inset-bottom))] max-md:w-auto"
    >
      <div className="flex items-start justify-between gap-3">
        <p id="welcome-title" className="text-[18px] leading-snug font-semibold tracking-[-0.01em] text-ink">
          {t.title}
        </p>
        <button type="button" onClick={close} aria-label={t.close} className="-mt-1.5 -mr-2 flex h-10 w-10 flex-none items-center justify-center rounded-full text-muted transition-colors hover:bg-mist hover:text-ink">
          <Close className="h-4 w-4" />
        </button>
      </div>
      {state === 'done' ? (
        <p className="mt-2 text-[15px] leading-snug text-text" role="status">
          {t.done}
        </p>
      ) : (
        <form onSubmit={submit} noValidate className="mt-1.5">
          <p className="text-[14.5px] leading-snug text-text">{t.lead}</p>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
          <label className="sr-only" htmlFor="welcome-email">
            {t.placeholder}
          </label>
          <input
            id="welcome-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.placeholder}
            aria-invalid={state === 'error'}
            aria-describedby={state === 'error' ? 'welcome-error' : undefined}
            className="mt-3 h-12 w-full rounded-[12px] bg-paper px-3.5 text-[16px] text-ink shadow-[inset_0_0_0_1px_var(--color-line)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-ink)]"
          />
          {state === 'error' && (
            <p id="welcome-error" className="mt-1.5 text-[13.5px] text-red-deep">
              {error}
            </p>
          )}
          <button type="submit" disabled={state === 'busy'} className="cta mt-2.5 w-full">
            {state === 'busy' ? t.sending : t.send}
          </button>
          <p className="mt-2.5 text-[12px] leading-snug text-muted">
            {locale === 'en' ? WELCOME_CONSENT_TEXT_EN : WELCOME_CONSENT_TEXT}{' '}
            <Link href="/privacy-policy" target="_blank" className="underline underline-offset-2 hover:text-ink">
              {t.privacy}
            </Link>
          </p>
        </form>
      )}
    </div>
  )
}
