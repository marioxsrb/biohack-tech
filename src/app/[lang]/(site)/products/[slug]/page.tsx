import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProductHero } from '@/components/product/ProductHero'
import { ProductSections } from '@/components/product/ProductSections'
import { ReviewMarquee } from '@/components/reviews/ReviewMarquee'

import { getProductBySlug, productHref, products } from '@/content/catalog'
import { getProductContent } from '@/content/product-content'
import { getLocale } from '@/i18n/server'
import { localePath } from '@/i18n/locales'
import { absolute, breadcrumbJsonLd, JsonLd, pageMetadata, productJsonLd } from '@/lib/seo'

const COPY = {
  ro: { home: 'Acasă', products: 'Produse', note: (name: string) => `${name} este un produs de wellness. Pentru o afecțiune, cere întâi sfatul medicului. Rezultatele diferă de la o persoană la alta.` },
  en: { home: 'Home', products: 'Products', note: (name: string) => `${name} is a wellness product. If you have a medical condition, ask your doctor first. Results differ from person to person.` },
}

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: PageProps<'/[lang]/products/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const locale = await getLocale()
  const product = getProductBySlug(slug, locale)
  if (!product) return {}
  const { seo } = getProductContent(product.id, locale)
  const img = product.lifestyle.src
  return pageMetadata({
    title: seo.title,
    description: seo.description,
    path: productHref(product),
    locale,
    image: { url: img.src, width: img.width, height: img.height, alt: product.lifestyle.alt },
  })
}

export default async function ProductPage({ params }: PageProps<'/[lang]/products/[slug]'>) {
  const { slug } = await params
  const locale = await getLocale()
  const t = COPY[locale]
  const product = getProductBySlug(slug, locale)
  if (!product) notFound()
  const content = getProductContent(product.id, locale)

  const gallery = product.variants?.[0]?.images ?? product.images
  const imageUrls = [product.lifestyle, ...gallery].map((i) => absolute(i.src.src))

  return (
    <>
      <section id="cumpara" className="scroll-mt-[var(--nav-h)] pt-[calc(var(--nav-h)+48px)] pb-[var(--sec)] max-sm:pt-[var(--nav-h)]">
        <div className="wrap">
          <ProductHero productId={product.id} intro={content.intro} highlights={content.highlights} />
        </div>
      </section>

      <ReviewMarquee productId={product.id} className="mb-[var(--sec)]" />
      <ProductSections product={product} content={content} locale={locale} />

      <p className="wrap py-8 text-[13px] leading-relaxed text-muted">
        {t.note(product.name)}
      </p>

      <JsonLd data={productJsonLd(product, content.seo.description, imageUrls, locale)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: t.home, path: localePath(locale, '/') },
          { name: t.products, path: localePath(locale, '/products') },
          { name: product.name, path: localePath(locale, productHref(product)) },
        ])}
      />
    </>
  )
}
