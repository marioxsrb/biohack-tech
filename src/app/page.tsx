import type { Metadata } from 'next'
import { BrandStory } from '@/components/home/BrandStory'
import { Hero } from '@/components/home/Hero'
import { ProductShowcase } from '@/components/home/ProductShowcase'
import { Assurance } from '@/components/site/Assurance'
import { site } from '@/config/site'
import { pageMetadata } from '@/lib/seo'
import og from '@/assets/img/balance-wave/lifestyle-canapea.webp'

export const metadata: Metadata = {
  ...pageMetadata({
    title: `${site.name}: Balance Wave, BrainLink Pro și Ochelari Biohack`,
    description:
      'Trei produse simple pentru fiecare zi: Balance Wave pentru relaxare, BrainLink Pro pentru focus și Ochelari Biohack pentru ecrane. Livrare gratuită în România.',
    path: '/',
    image: { url: og.src, width: og.width, height: og.height, alt: 'Femeie relaxată pe canapea, purtând Balance Wave' },
  }),
  title: { absolute: `${site.name}: Balance Wave, BrainLink Pro și Ochelari Biohack` },
}

export default function Home() {
  return (
    <>
      <Hero />
      <ProductShowcase />
      <BrandStory />
      <Assurance />
    </>
  )
}
