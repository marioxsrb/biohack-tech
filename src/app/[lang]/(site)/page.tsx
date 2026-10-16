import { BookFeature } from '@/components/home/BookFeature'
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
    title: `Mai calm seara, mai clar ziua | ${site.name}`,
    description:
      'NEUROS te ajută să te liniștești, să treci mai ușor spre somn și să ai mai mult focus. Calm, Focus și Amber. Livrare gratuită.',
    alt: 'Femeie relaxată pe canapea, purtând NEUROS Calm',
  },
  en: {
    title: `Calmer evenings, clearer days | ${site.name}`,
    description:
      'NEUROS helps you unwind, ease into sleep and stay focused. Calm, Focus and Amber. Free worldwide delivery.',
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
      {/* Diana L. Palotaș's book: its own section under the three products, never a tile among them. */}
      <BookFeature />
      <Why />
      <ReviewMarquee className="pt-[var(--sec)]" />
      <Rhythm />
      <Offers />
      <HomeFaq />
      <ContactSection />
    </>
  )
}
