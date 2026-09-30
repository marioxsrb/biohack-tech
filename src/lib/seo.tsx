import type { Metadata } from 'next'
import { site, terms } from '@/config/site'
import { isPurchasable, productHref, type Product } from '@/content/catalog'
import { CURRENCY } from '@/lib/money'

export const absolute = (path = '/') => `${site.url}${path === '/' ? '' : path}`

type PageMeta = { title: string; description: string; path: string; image?: { url: string; width: number; height: number; alt: string } }

/** Unique title, description, canonical URL, Open Graph and Twitter data for a page. */
export function pageMetadata({ title, description, path, image }: PageMeta): Metadata {
  return {
    title,
    description,
    alternates: { canonical: absolute(path) },
    openGraph: {
      type: 'website',
      locale: site.locale,
      siteName: site.name,
      url: absolute(path),
      title,
      description,
      ...(image && { images: [image] }),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image && { images: [image.url] }),
    },
  }
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.name,
    url: site.url,
    email: site.email,
    telephone: site.phone,
    description: site.description,
  }
}

/** One price, or the range when configurations cost differently. */
function offerPrice(p: Product & { price: number }) {
  const prices = (p.variants ?? []).map((v) => v.price).filter((x): x is number => typeof x === 'number')
  if (!p.variablePrice || !prices.length) return { '@type': 'Offer', price: (p.price / 100).toFixed(2) }
  return {
    '@type': 'AggregateOffer',
    lowPrice: (Math.min(...prices) / 100).toFixed(2),
    highPrice: (Math.max(...prices) / 100).toFixed(2),
    offerCount: prices.length,
  }
}

/** Product structured data. An offer is published only once the product has an approved RON price. */
export function productJsonLd(p: Product, description: string, imageUrls: string[]) {
  const url = absolute(productHref(p))
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description,
    image: imageUrls,
    ...(p.brand && { brand: { '@type': 'Brand', name: p.brand } }),
    category: p.purpose,
    url,
    ...(isPurchasable(p) && {
      offers: {
        url,
        ...offerPrice(p),
        priceCurrency: CURRENCY,
        availability: 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition',
        seller: { '@type': 'Organization', name: site.name },
        shippingDetails: {
          '@type': 'OfferShippingDetails',
          shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: CURRENCY },
          shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'RO' },
        },
        hasMerchantReturnPolicy: {
          '@type': 'MerchantReturnPolicy',
          applicableCountry: 'RO',
          returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
          merchantReturnDays: terms.returnDays,
        },
      },
    }),
  }
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absolute(it.path) })),
  }
}

/** Serializes JSON-LD safely for inline <script>. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
