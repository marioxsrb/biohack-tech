import type { Metadata } from 'next'
import { Approach } from '@/components/home/Approach'
import { Compare } from '@/components/home/Compare'
import { Hero } from '@/components/home/Hero'
import { HomeFaq } from '@/components/home/HomeFaq'
import { HowToOrder } from '@/components/home/HowToOrder'
import { ProductChapters } from '@/components/home/ProductChapters'
import { ContactBlock } from '@/components/site/ContactBlock'
import { site } from '@/config/site'
import { pageMetadata } from '@/lib/seo'
import og from '@/assets/img/balance-wave/lifestyle-canapea.webp'

export const metadata: Metadata = {
  ...pageMetadata({
    title: `${site.name}: Balance Wave, BrainLink Pro și Ochelari Biohack`,
    description:
      'Comandă online Balance Wave, BrainLink Pro și Ochelari Biohack: dispozitive de wellness pentru relaxare, focus și ore la ecran. Livrare gratuită în România.',
    path: '/',
    image: { url: og.src, width: og.width, height: og.height, alt: 'Femeie relaxată pe canapea, purtând Balance Wave' },
  }),
  title: { absolute: `${site.name}: Balance Wave, BrainLink Pro și Ochelari Biohack` },
}

export default function Home() {
  return (
    <>
      <Hero />
      <ProductChapters />
      <Compare />
      <HowToOrder />
      <Approach />
      <HomeFaq />
      <section className="py-[var(--sec)]">
        <div className="wrap">
          <ContactBlock />
        </div>
      </section>
    </>
  )
}
