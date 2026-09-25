import type { Metadata } from 'next'
import { Opening } from '@/components/home/Opening'
import { BrainLinkScene } from '@/components/scenes/BrainLinkScene'
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

/**
 * One continuous sequence on one surface: the opening act (photograph → dark → the three
 * words → Balance Wave → light), BrainLink floating in over the light-up, the glasses,
 * and the three products together.
 */
export default function Home() {
  return (
    <>
      <Opening />
      <BrainLinkScene />
      <GlassesScene />
      <Lineup />
    </>
  )
}
