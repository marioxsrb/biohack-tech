'use client'

import NextLink from 'next/link'
import { usePathname } from 'next/navigation'
import { setCurrency, useCurrency } from '@/i18n/currency'
import { useLocale } from '@/i18n/LocaleProvider'
import { localePath, splitLocale, type Locale } from '@/i18n/locales'

const NAMES: Record<Locale, string> = { ro: 'Română', en: 'English' }
/** The visitor's explicit language choice (the international site opens in English unless it says ro). */
export const LANG_COOKIE = 'bt_lang'

/**
 * The language slider beside the cart: the UK and Romanian flags in a hairline pill, the current one raised on a
 * white knob that slides. Each flag is a link to the same page in that language (crawlable, works without
 * JavaScript); a click also remembers the choice, so biohack-tech.net keeps Romanian once picked.
 * Romanian prices are in lei; in English a second pill picks euro or dollar (CurrencySwitch).
 */
export function LanguageSwitch({ dark = false, className = '' }: { dark?: boolean; className?: string }) {
  const locale = useLocale()
  const { path } = splitLocale(usePathname() ?? '/')
  const ring = dark ? 'shadow-[inset_0_0_0_1px_rgb(255_255_255/0.28)]' : 'shadow-[inset_0_0_0_1px_rgb(8_17_19/0.14)]'
  const order: Locale[] = ['en', 'ro']
  const index = order.indexOf(locale)
  return (
    <div role="group" aria-label={locale === 'en' ? 'Language' : 'Limba'} className={`relative grid h-8 grid-cols-2 items-center rounded-full p-0.5 ${ring} ${className}`}>
      <span
        aria-hidden
        className={`absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] rounded-full transition-transform duration-300 ease-[var(--ease-brand)] ${dark ? 'bg-white/90' : 'bg-white shadow-[0_1px_3px_rgba(8,17,19,.18),0_0_0_1px_rgba(8,17,19,.06)]'}`}
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {order.map((l) => {
        const on = l === locale
        return (
          <NextLink
            key={l}
            href={localePath(l, path)}
            hrefLang={l}
            lang={l}
            aria-current={on ? 'true' : undefined}
            aria-label={NAMES[l]}
            title={NAMES[l]}
            onClick={() => {
              document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`
            }}
            className={`relative z-10 flex h-7 w-9 items-center justify-center rounded-full transition-opacity duration-200 ${on ? '' : 'opacity-60 hover:opacity-100'}`}
          >
            {l === 'en' ? <FlagUK /> : <FlagRO />}
          </NextLink>
        )
      })}
    </div>
  )
}

/** € · $ on English pages (Romanian pages are always in lei). */
export function CurrencySwitch({ dark = false, className = '' }: { dark?: boolean; className?: string }) {
  const locale = useLocale()
  const currency = useCurrency()
  if (locale !== 'en') return null
  const ring = dark ? 'shadow-[inset_0_0_0_1px_rgb(255_255_255/0.28)]' : 'shadow-[inset_0_0_0_1px_rgb(8_17_19/0.14)]'
  const options = [
    { c: 'EUR' as const, sign: '€', name: 'Euro' },
    { c: 'USD' as const, sign: '$', name: 'US dollar' },
  ]
  return (
    <div role="group" aria-label="Currency" className={`flex h-8 items-center rounded-full p-0.5 text-[13.5px] font-semibold ${ring} ${className}`}>
      {options.map((o) => {
        const on = o.c === currency
        return (
          <button
            key={o.c}
            type="button"
            onClick={() => setCurrency(o.c)}
            aria-pressed={on}
            aria-label={o.name}
            title={o.name}
            className={`flex h-7 min-w-8 items-center justify-center rounded-full px-2 transition-colors duration-200 ${
              on ? (dark ? 'bg-white text-ink' : 'bg-ink text-white') : dark ? 'text-white/75 hover:text-white' : 'text-muted hover:text-ink'
            }`}
          >
            {o.sign}
          </button>
        )
      })}
    </div>
  )
}

function FlagUK() {
  return (
    <svg viewBox="0 0 60 30" aria-hidden className="h-[14px] w-[22px] rounded-[2px] shadow-[0_0_0_0.5px_rgba(8,17,19,.25)]">
      <clipPath id="uk-s">
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <clipPath id="uk-t">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <g clipPath="url(#uk-s)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#uk-t)" stroke="#C8102E" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  )
}

function FlagRO() {
  return (
    <svg viewBox="0 0 3 2" aria-hidden className="h-[14px] w-[21px] rounded-[2px] shadow-[0_0_0_0.5px_rgba(8,17,19,.25)]">
      <path fill="#002B7F" d="M0 0h1v2H0z" />
      <path fill="#FCD116" d="M1 0h1v2H1z" />
      <path fill="#CE1126" d="M2 0h1v2H2z" />
    </svg>
  )
}
