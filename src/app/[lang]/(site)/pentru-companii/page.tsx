import type { Metadata } from 'next'
import { BUSINESS_COPY, BusinessPage } from '@/components/b2b/BusinessPage'
import { getLocale } from '@/i18n/server'
import { pageMetadata } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const { title, description } = BUSINESS_COPY[locale]
  return pageMetadata({ title, description, path: locale === 'en' ? '/for-business' : '/pentru-companii', locale })
}

/** The business offer (40% from 25 Calm + Focus units). The English address is /for-business (same page). */
export default async function BusinessOfferPage() {
  return <BusinessPage locale={await getLocale()} />
}
