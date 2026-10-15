import { VisitBeacon } from '@/components/gate/VisitBeacon'
import type { Metadata } from 'next'
import { ContactSection } from '@/components/home/ContactSection'
import { Discover } from '@/components/home/Discover'
import { Hero } from '@/components/home/Hero'
import { HomeFaq } from '@/components/home/HomeFaq'
import { Offers } from '@/components/home/Offers'
import { Rhythm } from '@/components/home/Rhythm'
import { Why } from '@/components/home/Why'
import { ReviewMarquee } from '@/components/reviews/ReviewMarquee'
import { site } from '@/config/site'
import { getLocale } from '@/i18n/server'
import { pageMetadata } from '@/lib/seo'
import og from '@/assets/img/balance-wave/lifestyle-canapea.webp'
import { settingsForRender } from '@/server/store-settings'

const META = {
  ro: {
    title: `Dispozitive pentru relaxare și concentrare | ${site.name}`,
    description:
      'Dispozitive NEUROS pentru stres, concentrare și ochi obosiți de ecrane: Calm cu lumină roșie, casca EEG Focus și ochelarii Amber. Livrare gratuită.',
    alt: 'Femeie relaxată pe canapea, purtând NEUROS Calm',
  },
  en: {
    title: `Devices for relaxation and focus | ${site.name}`,
    description:
      'NEUROS devices for stress, focus and screen-tired eyes: Calm with red light, the Focus EEG headband and Amber glasses. Free delivery in Romania.',
    alt: 'Relaxed woman on a sofa, wearing NEUROS Calm',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const m = META[locale]
  return {
    ...pageMetadata({
      title: m.title,
      description: m.description,
      path: '/',
      locale,
      image: { url: og.src, width: og.width, height: og.height, alt: m.alt },
    }),
    title: { absolute: m.title },
  }
}

/**
 * Plain document flow: every section renders from the server and scrolls natively.
 * Hero, the four products (once), why buy here, real reviews under the customer count, the same day with and without the products, the offers
 * (to close a decision, not to open it), questions, a person to write to.
 */
export default async function Home() {
  await settingsForRender()
  return (
    <>
      <VisitBeacon page="home" />
      <Hero />
      <Discover />
      <Why />
      <ReviewMarquee className="pt-[var(--sec)]" />
      <Rhythm />
      <Offers />
      <HomeFaq />
      <ContactSection />
    </>
  )
}
