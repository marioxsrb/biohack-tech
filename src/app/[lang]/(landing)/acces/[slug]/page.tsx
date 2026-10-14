import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { GateProvider } from '@/components/gate/Gate'
import { VisitBeacon } from '@/components/gate/VisitBeacon'
import { LandingPage } from '@/components/landing/LandingPage'
import { getProduct } from '@/content/catalog'
import { getLanding, landings } from '@/content/landings'

export function generateStaticParams() {
  return landings.map((l) => ({ slug: l.slug }))
}

export const dynamicParams = false

/**
 * The price-gated funnel (acces.<domain>/<product>): the product's landing (benefits, how it is used, what
 * arrives, reviews, questions) with the price and the purchase behind a short form. Same catalog, cart,
 * checkout and backend as the main site. Never indexed.
 */
export async function generateMetadata({ params }: PageProps<'/[lang]/acces/[slug]'>): Promise<Metadata> {
  const landing = getLanding((await params).slug)
  if (!landing) return {}
  const product = getProduct(landing.productId)!
  return { title: { absolute: `${product.name} | Biohack Tech` }, description: product.tagline, robots: { index: false, follow: false } }
}

export default async function GatedProductRoute({ params }: PageProps<'/[lang]/acces/[slug]'>) {
  const landing = getLanding((await params).slug)
  if (!landing) notFound()
  return (
    <GateProvider productId={landing.productId}>
      <VisitBeacon page={landing.slug} />
      <LandingPage landing={landing} gated />
    </GateProvider>
  )
}
