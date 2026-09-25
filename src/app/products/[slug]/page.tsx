import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProductHero } from '@/components/product/ProductHero'
import { ProductSections } from '@/components/product/ProductSections'

import { getProductBySlug, productHref, products } from '@/content/catalog'
import { productContent } from '@/content/product-content'
import { absolute, breadcrumbJsonLd, JsonLd, pageMetadata, productJsonLd } from '@/lib/seo'

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: PageProps<'/products/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const product = getProductBySlug(slug)
  if (!product) return {}
  const { seo } = productContent[product.id]
  const img = product.lifestyle.src
  return pageMetadata({
    title: seo.title,
    description: seo.description,
    path: productHref(product),
    image: { url: img.src, width: img.width, height: img.height, alt: product.lifestyle.alt },
  })
}

export default async function ProductPage({ params }: PageProps<'/products/[slug]'>) {
  const { slug } = await params
  const product = getProductBySlug(slug)
  if (!product) notFound()
  const content = productContent[product.id]

  const gallery = product.variants?.[0]?.images ?? product.images
  const imageUrls = [product.lifestyle, ...gallery].map((i) => absolute(i.src.src))

  return (
    <>
      <section id="cumpara" className="scroll-mt-[var(--nav-h)] pt-[calc(var(--nav-h)+48px)] pb-[var(--sec)] max-sm:pt-[var(--nav-h)]">
        <div className="wrap">
          <ProductHero productId={product.id} intro={content.intro} benefits={content.benefits} />
        </div>
      </section>

      <ProductSections product={product} content={content} />

      <p className="wrap py-8 text-[13px] leading-relaxed text-muted">
        {product.name} este un produs de wellness. Nu înlocuiește sfatul medicului. Rezultatele diferă de la o persoană la alta.
      </p>

      <JsonLd data={productJsonLd(product, content.seo.description, imageUrls)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Acasă', path: '/' },
          { name: 'Produse', path: '/products' },
          { name: product.name, path: productHref(product) },
        ])}
      />
    </>
  )
}
