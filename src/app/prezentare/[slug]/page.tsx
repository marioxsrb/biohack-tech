import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PresentationPage } from '@/components/presentation/PresentationPage'
import { getProduct } from '@/content/catalog'
import { getLanding, landings } from '@/content/landings'
import { getProductContent } from '@/content/product-content'
import { landingHost } from '@/lib/landing-hosts'
import { settingsForRender } from '@/server/store-settings'

export function generateStaticParams() {
  return landings.map((l) => ({ slug: l.slug }))
}

export const dynamicParams = false

/**
 * Public at <slug>.biohack-tech.ro/prezentare (and /lp/<slug>/prezentare on the main host, for previews).
 * Never indexed, no canonical to the shop: the page stands on its own.
 */
export async function generateMetadata({ params }: PageProps<'/prezentare/[slug]'>): Promise<Metadata> {
  const landing = getLanding((await params).slug)
  if (!landing) return {}
  const product = getProduct(landing.productId)!
  const img = product.lifestyle
  const title = `${product.name}: prezentare`
  return {
    metadataBase: new URL(`https://${landingHost(landing.slug)}`),
    title: { absolute: title },
    description: getProductContent(product.id).seo.description.replace(/ Livrare gratuită[^.]*\./, ''),
    openGraph: { type: 'website', locale: 'ro_RO', url: '/prezentare', title, images: [{ url: img.src.src, width: img.src.width, height: img.src.height, alt: img.alt }] },
    robots: { index: false, follow: false },
  }
}

export default async function PresentationRoute({ params }: PageProps<'/prezentare/[slug]'>) {
  await settingsForRender()
  const landing = getLanding((await params).slug)
  if (!landing) notFound()
  return <PresentationPage landing={landing} />
}
