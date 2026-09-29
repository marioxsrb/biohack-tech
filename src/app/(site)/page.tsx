import type { Metadata } from 'next'
import { ContactSection } from '@/components/home/ContactSection'
import { Discover } from '@/components/home/Discover'
import { Hero } from '@/components/home/Hero'
import { HomeFaq } from '@/components/home/HomeFaq'
import { Offers } from '@/components/home/Offers'
import { Rhythm } from '@/components/home/Rhythm'
import { Why } from '@/components/home/Why'
import { site } from '@/config/site'
import { pageMetadata } from '@/lib/seo'
import og from '@/assets/img/balance-wave/lifestyle-canapea.webp'

export const metadata: Metadata = {
  ...pageMetadata({
    title: `${site.name}: NEUROS Calm, Focus, Amber și Flow`,
    description:
      'NEUROS Calm pentru relaxare, Focus pentru concentrare, Amber pentru ecrane și casca NEUROS Flow pentru rutina de acasă. Livrare gratuită în România.',
    path: '/',
    image: { url: og.src, width: og.width, height: og.height, alt: 'Femeie relaxată pe canapea, purtând NEUROS Calm' },
  }),
  title: { absolute: `${site.name}: NEUROS Calm, Focus, Amber și Flow` },
}

/**
 * Plain document flow: every section renders from the server and scrolls natively.
 * Hero, the four products (once), why buy here, the same day with and without the products, the offers
 * (to close a decision, not to open it), questions, a person to write to.
 */
export default function Home() {
  return (
    <>
      <Hero />
      <Discover />
      <Why />
      <Rhythm />
      <Offers />
      <HomeFaq />
      <ContactSection />
    </>
  )
}
