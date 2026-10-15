'use client'

import Link from '@/components/ui/Link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { Close } from '@/components/ui/icons'
import { useLocale } from '@/i18n/LocaleProvider'
import { ALL, NONE, actionFor, withdrawn, type ConsentChoice, type OptionalCategory } from '@/lib/consent/cookies'
import { consentStore } from '@/lib/consent/store'
import { clearVendorCookies, configuredVendors, pageView, startVendor, vendorsToLoad } from '@/lib/consent/vendors'

export const OPEN_COOKIE_SETTINGS = 'bt:cookie-settings'
/** Any "Setări cookies" control on the site opens the preferences with this. */
export const openCookieSettings = () => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS))

const COPY = {
  ro: {
    category: {
      analytics: { title: 'Analiză', text: 'Ne arată cum este folosit site-ul, ca să îl facem mai clar. Datele sunt statistice.' },
      marketing: { title: 'Marketing', text: 'Măsoară reclamele Biohack Tech și le face mai relevante pe alte platforme.' },
    } as Record<OptionalCategory, { title: string; text: string }>,
    whatAnalytics: 'de analiză, ca să vedem ce funcționează pe site',
    whatMarketing: 'de marketing, pentru reclame relevante',
    whatJoin: ', și ',
    bannerTitle: 'Tu alegi ce cookie-uri folosim',
    customizeShort: 'Setări',
    bannerText: (what: string) => `Coșul și plata folosesc doar ce este necesar. Cu acordul tău, folosim și cookie-uri ${what}.`,
    policy: 'Politica de cookies',
    reject: 'Refuz opționalele',
    accept: 'Accept toate',
    customize: 'Aleg eu ce accept',
    settings: 'Setări cookies',
    settingsText: 'Alegi pe categorii. Poți reveni oricând din „Setări cookies”, jos în pagină.',
    closeKeep: 'Închide fără să schimbi alegerea',
    necessary: 'Necesare',
    alwaysOn: 'Mereu active',
    necessaryText: 'Țin minte coșul, datele din formularul de comandă cât ai fila deschisă și această alegere. La plata cu cardul, Stripe folosește cookie-uri de securitate și prevenire a fraudei.',
    unused: 'Nu folosim acum',
    services: 'Servicii:',
    save: 'Salvez alegerea',
  },
  en: {
    category: {
      analytics: { title: 'Analytics', text: 'Shows us how the site is used, so we can make it easier to use. The data is statistical.' },
      marketing: { title: 'Marketing', text: 'Measures Biohack Tech ads and makes them more relevant on other platforms.' },
    } as Record<OptionalCategory, { title: string; text: string }>,
    whatAnalytics: 'analytics cookies, to see what works on the site',
    whatMarketing: 'marketing cookies, for relevant ads',
    whatJoin: ', and ',
    bannerTitle: 'You choose which cookies we use',
    customizeShort: 'Settings',
    bannerText: (what: string) => `The cart and payment use only what is necessary. With your consent, we also use ${what}.`,
    policy: 'Cookie policy',
    reject: 'Reject optional',
    accept: 'Accept all',
    customize: 'Let me choose',
    settings: 'Cookie settings',
    settingsText: 'Choose by category. You can come back any time from “Cookie settings” at the bottom of the page.',
    closeKeep: 'Close without changing your choice',
    necessary: 'Necessary',
    alwaysOn: 'Always on',
    necessaryText: 'They remember your cart, the order form while the tab is open, and this choice. For card payments, Stripe uses cookies for security and fraud prevention.',
    unused: 'Not in use',
    services: 'Services:',
    save: 'Save my choice',
  },
}

const noop = () => () => {}

/**
 * The cookie banner, the preferences dialog and the script loader, in one place.
 * The banner appears only when there is something to decide: at least one optional tool configured,
 * and no current choice. Accept and reject have the same weight; nothing optional is pre-selected.
 * Optional scripts start only here, only after consent. Withdrawing a category removes its cookies
 * and reloads the page, so its scripts are gone too.
 */
export function ConsentManager() {
  const hydrated = useSyncExternalStore(noop, () => true, () => false)
  const stored = useSyncExternalStore(consentStore.subscribe, consentStore.get, consentStore.getServer)
  const pathname = usePathname()
  const vendors = configuredVendors()
  const used = new Set(vendors.map((v) => v.category))
  const [open, setOpen] = useState(false)

  // Start what the stored choice allows (again on each page: a page may exclude a tool).
  useEffect(() => {
    for (const v of vendorsToLoad(stored, pathname)) startVendor(v)
    pageView()
  }, [stored, pathname])

  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener(OPEN_COOKIE_SETTINGS, show)
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, show)
  }, [])

  const decide = useCallback(
    (choice: ConsentChoice) => {
      const before = consentStore.get()
      const saved = consentStore.save(choice)
      setOpen(false)
      // Proof of the choice, under the random id only. Losing it never blocks the visitor.
      fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: saved.id, version: saved.version, analytics: saved.analytics, marketing: saved.marketing, action: actionFor(choice), page: pathname }),
        keepalive: true,
      }).catch(() => {})
      const gone = withdrawn(before, choice)
      if (gone.length) {
        clearVendorCookies(gone)
        // Scripts already running cannot be unloaded; a reload starts the page without them.
        if (vendorsToLoad(before, pathname).some((v) => gone.includes(v.category))) window.location.reload()
      }
    },
    [pathname],
  )

  if (!hydrated) return null
  const banner = vendors.length > 0 && !stored && !open

  return (
    <>
      {banner && <Banner used={used} onAccept={() => decide(ALL)} onReject={() => decide(NONE)} onCustomize={() => setOpen(true)} />}
      {open && <Preferences used={used} initial={stored ?? NONE} vendors={vendors} onSave={decide} onClose={() => setOpen(false)} />}
    </>
  )
}

function Banner({ used, onAccept, onReject, onCustomize }: { used: Set<OptionalCategory>; onAccept: () => void; onReject: () => void; onCustomize: () => void }) {
  const titleId = useId()
  const t = COPY[useLocale()]
  const what = [used.has('analytics') && t.whatAnalytics, used.has('marketing') && t.whatMarketing].filter(Boolean).join(t.whatJoin)
  return (
    <section
      role="region"
      aria-labelledby={titleId}
      className="consent-in fixed z-[300] print:hidden rounded-[16px] bg-paper p-3.5 text-[13.5px] leading-snug text-text shadow-[0_18px_44px_-18px_rgba(8,17,19,.4),0_0_0_1px_rgba(8,17,19,.06)] md:bottom-5 md:left-5 md:w-[340px] max-md:inset-x-3 max-md:bottom-[max(10px,env(safe-area-inset-bottom))]"
    >
      <h2 id={titleId} className="sr-only">
        {t.bannerTitle}
      </h2>
      <p>
        {t.bannerText(what)}{' '}
        <Link href="/politica-cookies" className="font-medium text-ink underline underline-offset-2">
          {t.policy}
        </Link>
      </p>
      {/* Refusing is as easy as accepting: the same button, side by side. */}
      <div className="mt-2.5 grid grid-cols-[1fr_1fr_auto] items-center gap-1.5">
        <button type="button" onClick={onReject} className="consent-btn sm">
          {t.reject}
        </button>
        <button type="button" onClick={onAccept} className="consent-btn sm">
          {t.accept}
        </button>
        <button type="button" onClick={onCustomize} className="flex min-h-10 items-center rounded-[10px] px-2 text-[13px] font-medium text-ink underline underline-offset-2 hover:bg-mist">
          {t.customizeShort}
        </button>
      </div>
    </section>
  )
}

function Preferences({
  used,
  initial,
  vendors,
  onSave,
  onClose,
}: {
  used: Set<OptionalCategory>
  initial: ConsentChoice
  vendors: ReturnType<typeof configuredVendors>
  onSave: (c: ConsentChoice) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const t = COPY[useLocale()]
  const [choice, setChoice] = useState<ConsentChoice>({ analytics: initial.analytics && used.has('analytics'), marketing: initial.marketing && used.has('marketing') })

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
    const opener = document.activeElement as HTMLElement | null
    return () => opener?.focus?.()
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className="consent-dialog m-auto w-[min(560px,calc(100vw-24px))] max-h-[min(88dvh,760px)] overflow-y-auto rounded-[22px] bg-paper p-0 text-text shadow-[0_30px_80px_-20px_rgba(8,17,19,.5)] backdrop:bg-[rgb(8_17_19/0.45)]"
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-6 max-sm:px-5">
        <div>
          <h2 id={titleId} className="text-[22px] leading-tight tracking-[-0.02em]">
            {t.settings}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed">
            {t.settingsText}{' '}
            <Link href="/politica-cookies" onClick={onClose} className="font-medium text-ink underline underline-offset-4">
              {t.policy}
            </Link>
          </p>
        </div>
        <button type="button" autoFocus onClick={onClose} aria-label={t.closeKeep} className="-mt-1 -mr-2 flex h-11 w-11 flex-none items-center justify-center rounded-full text-ink hover:bg-mist">
          <Close className="h-5 w-5" />
        </button>
      </div>

      <ul className="mt-5 divide-y divide-mist-2 border-y border-mist-2 px-6 max-sm:px-5">
        <li className="py-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-[16.5px] font-medium">{t.necessary}</h3>
            <span className="rounded-full bg-mist px-2.5 py-1 text-[13px] font-medium text-muted">{t.alwaysOn}</span>
          </div>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
            {t.necessaryText}
          </p>
        </li>
        {(['analytics', 'marketing'] as const).map((k) => {
          const tools = vendors.filter((v) => v.category === k)
          const available = used.has(k)
          return (
            <li key={k} className="py-4">
              <div className="flex items-center justify-between gap-4">
                <h3 id={`consent-${k}`} className="text-[16.5px] font-medium">
                  {t.category[k].title}
                </h3>
                {available ? (
                  <Switch labelledBy={`consent-${k}`} checked={choice[k]} onChange={(on) => setChoice((c) => ({ ...c, [k]: on }))} />
                ) : (
                  <span className="rounded-full bg-mist px-2.5 py-1 text-[13px] font-medium text-muted">{t.unused}</span>
                )}
              </div>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{t.category[k].text}</p>
              {tools.length > 0 && <p className="mt-1.5 text-[13.5px] text-muted">{t.services} {tools.map((v) => v.name).join(', ')}.</p>}
            </li>
          )
        })}
      </ul>

      <div className="grid gap-2 px-6 pt-5 pb-6 sm:grid-cols-3 max-sm:px-5">
        <button type="button" onClick={() => onSave(NONE)} className="consent-btn">
          {t.reject}
        </button>
        <button type="button" onClick={() => onSave(choice)} className="consent-btn">
          {t.save}
        </button>
        <button type="button" onClick={() => onSave({ analytics: used.has('analytics'), marketing: used.has('marketing') })} className="consent-btn">
          {t.accept}
        </button>
      </div>
    </dialog>
  )
}

function Switch({ checked, onChange, labelledBy }: { checked: boolean; onChange: (on: boolean) => void; labelledBy: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-[52px] flex-none rounded-full transition-colors ${checked ? 'bg-ink' : 'bg-mist-2 shadow-[inset_0_0_0_1px_var(--color-line)]'}`}
    >
      <span aria-hidden className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-paper shadow-sm transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  )
}

/** "Setări cookies" in the footer: always present, opens the preferences. */
export function CookieSettingsButton({ className }: { className?: string }) {
  const t = COPY[useLocale()]
  return (
    <button type="button" onClick={openCookieSettings} className={className}>
      {t.settings}
    </button>
  )
}
