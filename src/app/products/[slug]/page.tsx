import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Breadcrumb, ProductHero } from '@/components/product/ProductHero'
import { ProductSections } from '@/components/product/ProductSections'
import { ContactBlock } from '@/components/site/ContactBlock'
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
      <section className="pt-[calc(var(--nav-h)+40px)] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+20px)]">
        <div className="wrap">
          <Breadcrumb name={product.name} />
          <ProductHero productId={product.id} highlights={content.highlights} />
        </div>
      </section>

      <div className="border-t border-mist-2" />
      <ProductSections product={product} content={content} />

      <section className="pb-[var(--sec)]">
        <div className="wrap">
          <ContactBlock
            title={`Întrebări despre ${product.name}?`}
            text={
              product.guidance
                ? 'Spune-ne ce vrei să obții și îți recomandăm protocolul potrivit.'
                : 'Spune-ne ce model te interesează și cum îl vei folosi.'
            }
          />
          <p className="mt-8 max-w-[60em] text-[13px] leading-relaxed text-faint">
            {product.name} este un produs pentru starea generală de bine. Informațiile de pe această pagină au caracter general și nu
            înlocuiesc sfatul medicului. Rezultatele variază de la o persoană la alta.
          </p>
        </div>
      </section>

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
