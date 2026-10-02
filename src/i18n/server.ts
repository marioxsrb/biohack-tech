import { lang } from 'next/root-params'
import { defaultLocale, isLocale, type Locale } from './locales'
import { ui, type Ui } from './ui'

/** The language of the page being rendered (Server Components only). */
export async function getLocale(): Promise<Locale> {
  const l = await lang()
  return isLocale(l) ? l : defaultLocale
}

export async function getUi(): Promise<Ui> {
  return ui[await getLocale()]
}
