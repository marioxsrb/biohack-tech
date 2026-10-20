'use client'

import Image from 'next/image'
import Link from '@/components/ui/Link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Close } from '@/components/ui/icons'
import { useLocale } from '@/i18n/LocaleProvider'
import { WELCOME_CONSENT_TEXT, WELCOME_CONSENT_TEXT_EN } from '@/lib/consent/marketing'
import { getProduct } from '@/content/catalog'
import { AmberGate } from './AmberGate'

/** One minute on the site (anywhere, across pages of the same visit) before the offer shows (business decision 16.10.2026). */
const AFTER_MS = 60_000
/** Closed without an address: not again for a week. Sent: never again on this browser. */
const SNOOZE_MS = 7 * 86_400_000
// Renamed on 15.10.2026: every browser may see the offer again once.
const STATE_KEY = 'bt-welcome2'
const START_KEY = 'bt-welcome-start'
const HIDDEN = /\/(checkout|cart|admin|dezabonare|reluare|retragere)(\/|$)/

const COPY = {
  ro: {
    badge: '−10%',
    kicker: 'Doar pentru tine',
    title: '10% reducere la prima comandă',
    lead: 'Lasă-ne adresa de email și îți trimitem imediat codul. Se adaugă peste ofertele din coș.',
    noThanks: 'Nu, mulțumesc',
    continue: 'Continuă pe site',
    placeholder: 'Adresa ta de email',
    send: 'Trimite-mi codul',
    sending: 'Se trimite…',
    done: 'Gata! Ți-am trimis codul de 10% pe email. Dacă nu îl vezi în câteva minute, uită-te și în Spam sau Promoții.',
    spamHint: 'Dacă nu găsești emailul, verifică și folderul Spam sau Promoții.',
    already: 'Pe această adresă am trimis deja codul de 10%. Caută emailul de la Biohack Tech (și în Promoții sau Spam).',
    privacy: 'Confidențialitate',
    close: 'Închide',
    invalid: 'Verifică adresa de email.',
    failed: 'Nu am putut trimite codul. Încearcă din nou.',
  },
  en: {
    badge: '−10%',
    kicker: 'Just for you',
    title: '10% off your first order',
    lead: 'Leave us your email address and we will send you the code right away. It adds to the offers in your cart.',
    noThanks: 'No, thanks',
    continue: 'Back to the site',
    placeholder: 'Your email address',
    send: 'Send me the code',
    sending: 'Sending…',
    done: 'Done! We sent your 10% code by email. If you do not see it within a few minutes, also check Spam or Promotions.',
    spamHint: 'If you cannot find the email, also check your Spam or Promotions folder.',
    already: 'We already sent the 10% code to this address. Look for the Biohack Tech email (also in Promotions or Spam).',
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
 * The website's 10% offer: a centred window over the dimmed page (a large card at the bottom on phones), with a
 * product photo, after one minute anywhere on the main site or a landing; never in the cart, checkout or admin,
 * nor over the cookie choice. Escape, a click outside or "Nu, mulțumesc" close it
 * for a week. The address gets LONGEVITY10 by email (/api/welcome).
 */
export function WelcomePopup() {
  const locale = useLocale()
  const t = COPY[locale]
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'already' | 'error'>('idle')
  const [error, setError] = useState('')
  const hiddenHere = HIDDEN.test(pathname)
  // NEUROS Amber's pages (also amber.<domain>, whose "/" is the product page): the drag-the-bar scene comes first.
  // (This component runs only in the browser: DeferredChrome loads it without server rendering.)
  const amber = /\/products\/amber\/?$/.test(pathname) || window.location.hostname.startsWith('amber.')
  const [passed, setPassed] = useState(false)
  const gate = amber && !passed
  // After the Amber scene the offer shows the glasses; everywhere else, NEUROS Focus.
  const photo = getProduct(amber ? 'ochelari-biohack' : 'brainlink-pro', locale)!.lifestyle

  useEffect(() => {
    if (hiddenHere || window.__BT_STORE__?.welcomePopup === false) return
    // ?oferta=1: shows the offer at once, whatever was chosen before (to see it, or from a link).
    if (new URLSearchParams(window.location.search).has('oferta')) {
      const t = setTimeout(() => setOpen(true), 400)
      return () => clearTimeout(t)
    }
    const s = read(STATE_KEY)
    if (s === 'sent' || (s && Number(s) > Date.now())) return
    // One minute after the visit's first page.
    let timer: ReturnType<typeof setTimeout>
    const startedAt = () => {
      try {
        const saved = Number(sessionStorage.getItem(START_KEY) ?? 0)
        if (saved) return saved
        const now = Date.now()
        sessionStorage.setItem(START_KEY, String(now))
        return now
      } catch {
        return Date.now()
      }
    }
    // Never on top of the cookie choice or an open chat: waits until they are out of the way.
    const show = () => (document.querySelector('.consent-in, .assistant-panel') ? (timer = setTimeout(show, 3000)) : setOpen(true))
    timer = setTimeout(show, Math.max(0, startedAt() + AFTER_MS - Date.now()))
    return () => clearTimeout(timer)
  }, [hiddenHere])

  // While the window is open the page behind does not scroll.
  useEffect(() => {
    if (!open || hiddenHere) return
    const html = document.documentElement
    const before = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      html.style.overflow = before
    }
  }, [open, hiddenHere])

  if (!open || hiddenHere) return null

  const close = () => {
    setOpen(false)
    if (state !== 'done' && state !== 'already') write(STATE_KEY, String(Date.now() + SNOOZE_MS))
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
        body: JSON.stringify({ email: value, page: pathname, locale, website: (e.currentTarget.elements.namedItem('website') as HTMLInputElement | null)?.value ?? '' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message ?? t.failed)
      setState(data.already ? 'already' : 'done')
      write(STATE_KEY, 'sent')
    } catch (err) {
      setState('error')
      setError(err instanceof Error && err.message ? err.message : t.failed)
    }
  }

  if (gate)
    return (
      <div className="welcome-in fixed inset-0 z-[280] flex items-center justify-center p-4 max-sm:p-3" onKeyDown={(e) => e.key === 'Escape' && close()}>
        <button type="button" aria-label={t.close} tabIndex={-1} onClick={close} className="absolute inset-0 cursor-default bg-[rgb(8_17_19/0.7)] backdrop-blur-[3px]" />
        <AmberGate onDone={() => setPassed(true)} onClose={close} />
      </div>
    )

  return (
    <div className="welcome-in fixed inset-0 z-[280] flex items-center justify-center p-4 max-sm:items-end max-sm:p-3" onKeyDown={(e) => e.key === 'Escape' && close()}>
      {/* The page behind, dimmed: a click outside closes the offer. */}
      <button type="button" aria-label={t.close} tabIndex={-1} onClick={close} className="absolute inset-0 cursor-default bg-[rgb(8_17_19/0.7)] backdrop-blur-[3px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="relative grid w-full max-w-[880px] overflow-hidden rounded-[24px] bg-paper shadow-[0_40px_100px_-30px_rgba(0,0,0,.6)] sm:grid-cols-[1fr_1.1fr]"
      >
        <div className="relative min-h-[440px] bg-ink max-sm:min-h-[170px]">
          <Image src={photo.src} alt="" fill sizes="(max-width: 640px) 100vw, 360px" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[rgb(8_17_19/0.75)] via-transparent to-transparent sm:bg-gradient-to-r sm:from-transparent sm:to-[rgb(8_17_19/0.15)]" />
          <span className="absolute bottom-4 left-4 rounded-full bg-red-dark px-4 py-2 text-[18px] font-extrabold tracking-[0.04em] text-white uppercase sm:top-4 sm:bottom-auto">
            {t.badge}
          </span>
        </div>
        <div className="flex flex-col justify-center p-9 max-sm:p-5">
          <button type="button" onClick={close} aria-label={t.close} className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-paper/90 text-ink shadow-[0_0_0_1px_rgba(8,17,19,.08)] transition-colors hover:bg-mist">
            <Close className="h-4 w-4" />
          </button>
          <p className="text-[13px] font-semibold tracking-[0.12em] text-cyan-700 uppercase">{t.kicker}</p>
          <p id="welcome-title" className="mt-2 text-[42px] leading-[1.02] font-semibold tracking-[-0.035em] text-ink max-sm:text-[30px]">
            {t.title}
          </p>
          {state === 'done' || state === 'already' ? (
            <div role="status" className="mt-4">
              <p className="text-[16px] leading-snug text-text">{state === 'already' ? t.already : t.done}</p>
              <button type="button" onClick={close} className="cta mt-5 w-full">
                {t.continue}
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="mt-3">
              <p className="text-[16px] leading-snug text-text">{t.lead}</p>
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
                className="mt-4 h-[52px] w-full rounded-[14px] bg-paper px-4 text-[16px] text-ink shadow-[inset_0_0_0_1.5px_var(--color-line)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-ink)]"
              />
              {state === 'error' && (
                <p id="welcome-error" className="mt-1.5 text-[13.5px] text-red-deep">
                  {error}
                </p>
              )}
              <button type="submit" disabled={state === 'busy'} className="cta mt-3 w-full">
                {state === 'busy' ? t.sending : t.send}
              </button>
              <p className="mt-2 text-center text-[12.5px] text-muted">{t.spamHint}</p>
              <button type="button" onClick={close} className="mt-2 w-full py-2 text-[14px] text-muted underline underline-offset-4 hover:text-ink">
                {t.noThanks}
              </button>
              <p className="mt-2 text-[11.5px] leading-snug text-faint">
                {locale === 'en' ? WELCOME_CONSENT_TEXT_EN : WELCOME_CONSENT_TEXT}{' '}
                <Link href="/privacy-policy" target="_blank" className="underline underline-offset-2 hover:text-ink">
                  {t.privacy}
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
