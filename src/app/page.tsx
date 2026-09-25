import type { Metadata } from 'next'
import { BalanceWaveFeature } from '@/components/home/BalanceWaveFeature'
import { BrainLinkFeature } from '@/components/home/BrainLinkFeature'
import { Discover } from '@/components/home/Discover'
import { Hero } from '@/components/home/Hero'
import { GlassesScene } from '@/components/scenes/GlassesScene'
import { Lineup } from '@/components/site/Lineup'
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

/** Plain document flow: every section renders from the server and scrolls natively. */
export default function Home() {
  return (
    <>
      <Hero />
      <Discover />
      <BalanceWaveFeature />
      <BrainLinkFeature />
      <GlassesScene />
      <Lineup />
    </>
  )
}
