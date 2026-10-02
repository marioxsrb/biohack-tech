'use client'

import NextLink from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale } from '@/i18n/LocaleProvider'
import { localePath, splitLocale, type Locale } from '@/i18n/locales'

const NAMES: Record<Locale, string> = { ro: 'Română', en: 'English' }

/**
 * RO · EN, beside the cart: two quiet letters in a hairline pill, the current one solid. Each one is a
 * link to the same page in that language (crawlable, works without JavaScript).
 */
export function LanguageSwitch({ dark = false, className = '' }: { dark?: boolean; className?: string }) {
  const locale = useLocale()
  const { path } = splitLocale(usePathname() ?? '/')
  const ring = dark ? 'shadow-[inset_0_0_0_1px_rgb(255_255_255/0.28)]' : 'shadow-[inset_0_0_0_1px_rgb(8_17_19/0.14)]'
  return (
    <div role="group" aria-label={locale === 'en' ? 'Language' : 'Limba'} className={`flex h-8 items-center rounded-full p-0.5 text-[12.5px] font-semibold tracking-[0.04em] ${ring} ${className}`}>
      {(['ro', 'en'] as const).map((l) => {
        const on = l === locale
        return (
          <NextLink
            key={l}
            href={localePath(l, path)}
            hrefLang={l}
            lang={l}
            aria-current={on ? 'true' : undefined}
            aria-label={NAMES[l]}
            className={`flex h-7 min-w-9 items-center justify-center rounded-full px-2 uppercase transition-colors duration-200 ${
              on ? (dark ? 'bg-white text-ink' : 'bg-ink text-white') : dark ? 'text-white/75 hover:text-white' : 'text-muted hover:text-ink'
            }`}
          >
            {l}
          </NextLink>
        )
      })}
    </div>
  )
}
