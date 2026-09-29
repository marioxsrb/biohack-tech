import type { Metadata } from 'next'
import { ContactSection } from '@/components/home/ContactSection'
import { Chooser } from '@/components/home/Chooser'
import { Discover } from '@/components/home/Discover'
import { Hero } from '@/components/home/Hero'
import { HomeFaq } from '@/components/home/HomeFaq'
import { Offers } from '@/components/home/Offers'
import { Rhythm } from '@/components/home/Rhythm'
import { site } from '@/config/site'
import { pageMetadata } from '@/lib/seo'
import og from '@/assets/img/balance-wave/lifestyle-canapea.webp'

export const metadata: Metadata = {
  ...pageMetadata({
    title: `${site.name}: NEUROS Calm, Focus, Amber și NEUROS Flow`,
    description:
      'NEUROS Calm pentru relaxare, Focus pentru concentrare, Amber pentru ecrane și casca NEUROS Flow pentru rutina de acasă. Livrare gratuită în România.',
    path: '/',
    image: { url: og.src, width: og.width, height: og.height, alt: 'Femeie relaxată pe canapea, purtând NEUROS Calm' },
  }),
  title: { absolute: `${site.name}: NEUROS Calm, Focus, Amber și NEUROS Flow` },
}

/**
 * Plain document flow: every section renders from the server and scrolls natively.
 * Built around three decisions: I know what I want (the product row, one action per card), I want to
 * compare (what do you want to change, then the offers), I am not sure (questions, then a person).
 */
export default function Home() {
  return (
    <>
      <Hero />
      <Discover />
      <Chooser />
      <Offers />
      <Rhythm />
      <HomeFaq />
      <ContactSection />
    </>
  )
}
