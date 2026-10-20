import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { VisitBeacon } from '@/components/analytics/VisitBeacon'
import { LandingPage } from '@/components/landing/LandingPage'
import { getProduct, productHref } from '@/content/catalog'
import { getLanding, landings } from '@/content/landings'
import { pageMetadata } from '@/lib/seo'
import { settingsForRender } from '@/server/store-settings'

export function generateStaticParams() {
  return landings.map((l) => ({ slug: l.slug }))
}

export const dynamicParams = false

/**
 * Landings are for ad traffic only: never indexed, and their canonical is the product page, so search
 * engines see one page per product. Their hostnames also get X-Robots-Tag: noindex from the proxy.
 */
export async function generateMetadata({ params }: PageProps<'/[lang]/lp/[slug]'>): Promise<Metadata> {
  const landing = getLanding((await params).slug)
  if (!landing) return {}
  const product = getProduct(landing.productId)!
  const img = product.lifestyle.src
  return {
    ...pageMetadata({
      title: landing.meta.title,
      description: landing.meta.description,
      path: productHref(product),
      image: { url: img.src, width: img.width, height: img.height, alt: product.lifestyle.alt },
    }),
    title: { absolute: landing.meta.title },
    robots: { index: false, follow: false },
  }
}

export default async function LandingRoute({ params }: PageProps<'/[lang]/lp/[slug]'>) {
  await settingsForRender()
  const landing = getLanding((await params).slug)
  if (!landing) notFound()
  return (
    <>
      <VisitBeacon page={landing.slug} />
      <LandingPage landing={landing} />
    </>
  )
}
