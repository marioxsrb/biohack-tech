import { VisitBeacon } from '@/components/gate/VisitBeacon'
import type { Metadata } from 'next'
import { Lineup } from '@/components/site/Lineup'
import { getLocale } from '@/i18n/server'
import { pageMetadata } from '@/lib/seo'
import { settingsForRender } from '@/server/store-settings'

const COPY = {
  ro: {
    title: 'Dispozitive pentru relaxare, concentrare și ecrane',
    description:
      'NEUROS Calm cu lumină roșie pentru relaxare, casca EEG NEUROS Focus, și ochelarii NEUROS Amber pentru lumina albastră. Livrare gratuită.',
    heading: 'Produse',
  },
  en: {
    title: 'Devices for relaxation, focus and screens',
    description:
      'NEUROS Calm with red light for relaxation, the NEUROS Focus EEG headband, and NEUROS Amber blue light glasses. Free worldwide delivery.',
    heading: 'Products',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const { title, description } = COPY[locale]
  return pageMetadata({ title, description, path: '/products', locale })
}

export default async function ProductsPage() {
  await settingsForRender()
  const t = COPY[await getLocale()]
  return (
    <div className="bg-mist pt-[var(--nav-h)]">
      <VisitBeacon page="products" />
      <Lineup title={t.heading} headingLevel={1} />
    </div>
  )
}
