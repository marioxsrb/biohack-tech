import type { Metadata } from 'next'
import { CalmFeature } from '@/components/home/CalmFeature'
import { Discover } from '@/components/home/Discover'
import { FocusFeature } from '@/components/home/FocusFeature'
import { Hero } from '@/components/home/Hero'
import { GlassesScene } from '@/components/scenes/GlassesScene'
import { Lineup } from '@/components/site/Lineup'
import { site } from '@/config/site'
import { pageMetadata } from '@/lib/seo'
import og from '@/assets/img/balance-wave/lifestyle-canapea.webp'

export const metadata: Metadata = {
  ...pageMetadata({
    title: `${site.name}: NEUROS Calm, Focus și Amber`,
    description:
      'Trei produse NEUROS pentru fiecare zi: Calm pentru relaxare, Focus pentru concentrare și Amber pentru ecrane. Livrare gratuită în România.',
    path: '/',
    image: { url: og.src, width: og.width, height: og.height, alt: 'Femeie relaxată pe canapea, purtând NEUROS Calm' },
  }),
  title: { absolute: `${site.name}: NEUROS Calm, Focus și Amber` },
}

/** Plain document flow: every section renders from the server and scrolls natively. */
export default function Home() {
  return (
    <>
      <Hero />
      <Discover />
      <CalmFeature />
      <FocusFeature />
      <GlassesScene />
      <Lineup />
    </>
  )
}
