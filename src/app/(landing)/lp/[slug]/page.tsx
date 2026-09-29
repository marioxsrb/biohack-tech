import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LandingPage } from '@/components/landing/LandingPage'
import { getProduct, productHref } from '@/content/catalog'
import { getLanding, landings } from '@/content/landings'
import { pageMetadata } from '@/lib/seo'

export function generateStaticParams() {
  return landings.map((l) => ({ slug: l.slug }))
}

export const dynamicParams = false

/**
 * Landings are for ad traffic only: never indexed, and their canonical is the product page, so search
 * engines see one page per product. Their hostnames also get X-Robots-Tag: noindex from the proxy.
 */
export async function generateMetadata({ params }: PageProps<'/lp/[slug]'>): Promise<Metadata> {
  const landing = getLanding((await params).slug)
  if (!landing) return {}
  const product = getProduct(landing.productId)!
  const img = landing.hero.image.src
  return {
    ...pageMetadata({
      title: landing.meta.title,
      description: landing.meta.description,
      path: productHref(product),
      image: { url: img.src, width: img.width, height: img.height, alt: landing.hero.image.alt },
    }),
    title: { absolute: landing.meta.title },
    robots: { index: false, follow: false },
  }
}

export default async function LandingRoute({ params }: PageProps<'/lp/[slug]'>) {
  const landing = getLanding((await params).slug)
  if (!landing) notFound()
  return <LandingPage landing={landing} />
}
