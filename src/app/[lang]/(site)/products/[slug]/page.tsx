import { ProductViewed, VisitBeacon } from '@/components/analytics/VisitBeacon'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProductHero } from '@/components/product/ProductHero'
import { ProductSections } from '@/components/product/ProductSections'
import { BookSections } from '@/components/product/BookSections'
import { BookCover } from '@/components/book/BookCover'
import { ReviewMarquee } from '@/components/reviews/ReviewMarquee'
import { CalmFacts } from '@/components/calm/CalmFacts'
import { CalmScience } from '@/components/calm/CalmScience'

import { allSlugs, getProductBySlug, isBook, productHref } from '@/content/catalog'
import { getProductContent } from '@/content/product-content'
import { getLocale } from '@/i18n/server'
import { localePath } from '@/i18n/locales'
import { absolute, breadcrumbJsonLd, JsonLd, pageMetadata, productJsonLd } from '@/lib/seo'
import { settingsForRender } from '@/server/store-settings'

const COPY = {
  ro: { home: 'Acasă', products: 'Produse', note: (name: string) => `${name} este un produs de wellness. Pentru o afecțiune, cere întâi sfatul medicului. Rezultatele diferă de la o persoană la alta.` },
  en: { home: 'Home', products: 'Products', note: (name: string) => `${name} is a wellness product. If you have a medical condition, ask your doctor first. Results differ from person to person.` },
}

export function generateStaticParams() {
  // The book's page too: it answers 404 until the book is released (server/store-settings).
  return allSlugs().map((slug) => ({ slug }))
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
  await settingsForRender()
  const { slug } = await params
  const locale = await getLocale()
  const t = COPY[locale]
  const product = getProductBySlug(slug, locale)
  if (!product) notFound()
  const content = getProductContent(product.id, locale)
  // The Romanian NEUROS Calm page has its own story sections (components/calm).
  const calmRo = locale === 'ro' && product.id === 'balance-wave'

  const gallery = product.variants?.[0]?.images ?? product.images
  const imageUrls = [product.lifestyle, ...gallery].map((i) => absolute(i.src.src))

  return (
    <>
      <section id="cumpara" className="scroll-mt-[var(--nav-h)] pt-[calc(var(--nav-h)+48px)] pb-[var(--sec)] max-sm:pt-[var(--nav-h)]">
        <div className="wrap">
          <ProductHero
            productId={product.id}
            intro={content.intro}
            highlights={content.highlights}
            {...(isBook(product.id) && {
              // The book: its cover as an object on warm paper (the original artwork, shown no larger than it holds),
              // and its title on two lines with the author, instead of the devices' gallery and name.
              media: (
                <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[24px] bg-[#f7f3ec] md:sticky md:top-[calc(var(--nav-h)+24px)] max-md:aspect-[4/5]">
                  <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(closest-side,rgba(201,164,92,.22),transparent)]" />
                  <BookCover width="clamp(190px, 21vw, 262px)" sizes="(min-width: 768px) 262px, 190px" alt={product.cutout.alt} priority />
                </div>
              ),
              title: (
                <>
                  Știu. Vreau.
                  <br />
                  DE CE NU POT?
                  <span className="mt-4 block text-[18px] leading-snug font-normal tracking-normal text-text">{locale === 'en' ? 'by' : 'de'} Diana L. Palotaș</span>
                </>
              ),
            })}
          />
        </div>
      </section>

      <VisitBeacon page={product.slug} />
      <ProductViewed productId={product.id} />
      <ReviewMarquee
        productId={product.id}
        className="mb-[var(--sec)]"
        {...(calmRo && {
          note: {
            title: 'Același aparat ca în clinicile Neuros.',
            text: 'Rezultatele obținute de clienții noștri în clinică sunt cu NEUROS Calm, exact produsul de pe această pagină.',
          },
        })}
      />
      {calmRo && (
        <>
          <CalmFacts />
          <CalmScience />
        </>
      )}
      {/* The book has its own editorial page; the devices keep their product story. */}
      {isBook(product.id) ? <BookSections product={product} locale={locale} /> : <ProductSections product={product} content={content} locale={locale} />}

      {!isBook(product.id) && (
        <p className="wrap py-8 text-[13px] leading-relaxed text-muted">
          {t.note(product.name)}
        </p>
      )}

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
