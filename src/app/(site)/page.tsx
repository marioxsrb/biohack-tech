import type { Metadata } from 'next'
import { BrandIdea } from '@/components/home/BrandIdea'
import { CalmFeature } from '@/components/home/CalmFeature'
import { ContactSection } from '@/components/home/ContactSection'
import { DayMoments } from '@/components/home/DayMoments'
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
    title: `${site.name}: NEUROS Calm, Focus, Amber și Brain Flow`,
    description:
      'NEUROS Calm pentru relaxare, Focus pentru concentrare, Amber pentru ecrane și casca Brain Flow pentru rutina de acasă. Livrare gratuită în România.',
    path: '/',
    image: { url: og.src, width: og.width, height: og.height, alt: 'Femeie relaxată pe canapea, purtând NEUROS Calm' },
  }),
  title: { absolute: `${site.name}: NEUROS Calm, Focus, Amber și Brain Flow` },
}

/**
 * Plain document flow: every section renders from the server and scrolls natively.
 * The story: the brand and the products, what they are for, how a day changes, where each one fits,
 * the offers, one product up close, then questions and a person to write to. Light and dark surfaces
 * alternate so each section starts clearly.
 */
export default function Home() {
  return (
    <>
      <Hero />
      <Discover />
      <BrandIdea />
      <Rhythm />
      <DayMoments />
      <Offers />
      <CalmFeature />
      <HomeFaq />
      <ContactSection />
    </>
  )
}
