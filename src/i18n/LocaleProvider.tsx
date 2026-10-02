'use client'

import { createContext, useContext } from 'react'
import { defaultLocale, localePath, type Locale } from './locales'
import { ui, type Ui } from './ui'

const LocaleContext = createContext<Locale>(defaultLocale)

/** Set once in the root layout from the URL; every client component reads the language from here. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export const useLocale = (): Locale => useContext(LocaleContext)

/** The interface strings for the current language. */
export const useUi = (): Ui => ui[useLocale()]

/** Public URL of an internal path in the current language. */
export function useLocalePath(): (path: string) => string {
  const locale = useLocale()
  return (path) => localePath(locale, path)
}
