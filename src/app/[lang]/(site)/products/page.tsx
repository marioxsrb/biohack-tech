import { VisitBeacon } from '@/components/analytics/VisitBeacon'
import type { Metadata } from 'next'
import { Lineup } from '@/components/site/Lineup'
import { getLocale } from '@/i18n/server'
import { pageMetadata } from '@/lib/seo'
import { settingsForRender } from '@/server/store-settings'

const COPY = {
  ro: {
    title: 'Calm, somn mai lin și focus',
    description:
      'NEUROS Calm pentru liniște seara, NEUROS Focus pentru concentrare și NEUROS Amber pentru seri mai blânde. Livrare gratuită.',
    heading: 'Pentru calm, focus și seri liniștite',
  },
  en: {
    title: 'Calm, easier sleep and focus',
    description:
      'NEUROS Calm for quiet evenings, NEUROS Focus for concentration and NEUROS Amber for softer evenings. Free worldwide delivery.',
    heading: 'For calm, focus and quieter evenings',
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
