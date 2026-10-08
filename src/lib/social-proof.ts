/** The customer-count line of the product pages, from config/social-proof.ts. */
import type { Locale } from '@/i18n/locales'

const count = new Intl.NumberFormat('ro-RO', { useGrouping: 'always', maximumFractionDigits: 0 })

/** "N+ clienți au ales produsele noastre": the confirmed number, as a floor. */
export function customersLine(n: number, locale: Locale): string {
  const shown = `${count.format(n)}+`
  return locale === 'ro' ? `${shown} clienți au ales produsele noastre` : `${shown} customers have chosen our products`
}
