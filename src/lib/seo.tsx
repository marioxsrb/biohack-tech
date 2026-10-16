import type { Metadata } from 'next'
import { site, terms } from '@/config/site'
import { isPurchasable, productHref, type Product } from '@/content/catalog'
import { CURRENCY } from '@/lib/money'
import { defaultLocale, localePath, localeTag, type Locale } from '@/i18n/locales'
import { convertUnit } from '@/lib/currency'
import { siteOrigin } from '@/lib/sites'
import ogDefault from '@/assets/img/balance-wave/lifestyle-canapea.webp'

/**
 * The two storefronts for search engines: Romanian pages belong to biohack-tech.ro (plain URLs), English pages to
 * the international www.biohack-tech.net (/en/…). The English copy the .ro host also serves (biohack-tech.ro/en)
 * names the .net page as its canonical, so only one English version is indexed; .net's Romanian copy (chosen in
 * the language switch) names the .ro page. The same HTML on both hosts, so pages stay static.
 */
export const intlOrigin = () => siteOrigin('net', site.url)
export const absolute = (path = '/') => (/^\/en(\/|$)/.test(path) ? `${intlOrigin()}${path}` : `${site.url}${path === '/' ? '' : path}`)
/** The page's public URL in a language: '/products' → https://biohack-tech.ro/products or https://www.biohack-tech.net/en/products. */
export const pageUrl = (locale: Locale, path: string) => absolute(localePath(locale, path))

type PageMeta = {
  title: string
  description: string
  /** Internal path, without the language prefix. */
  path: string
  locale?: Locale
  /** false: the page exists only in Romanian (legal texts, landings); every language points to it. */
  translated?: boolean
  image?: { url: string; width: number; height: number; alt: string }
}

/**
 * Unique title, description, canonical URL, language alternates (hreflang), Open Graph and Twitter data.
 * A translated page names both language versions; Romanian is also the x-default.
 */
/** The sharing image of pages that have none of their own (the store's main photograph). */
const DEFAULT_IMAGE = { url: ogDefault.src, width: ogDefault.width, height: ogDefault.height, alt: 'NEUROS Calm' }

export function pageMetadata({ title, description, path, locale = defaultLocale, translated = true, image: own }: PageMeta): Metadata {
  const image = own ?? DEFAULT_IMAGE
  const url = translated ? pageUrl(locale, path) : absolute(path)
  return {
    title,
    description,
    alternates: {
      canonical: url,
      // Romanian on .ro for Romania; English on .net for everyone else (also the default for other languages).
      ...(translated && { languages: { 'ro-RO': pageUrl('ro', path), en: pageUrl('en', path), 'x-default': pageUrl('en', path) } }),
    },
    openGraph: {
      type: 'website',
      locale: localeTag[locale].replace('-', '_'),
      siteName: site.name,
      url,
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

export function organizationJsonLd(locale: Locale = defaultLocale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.name,
    url: site.url,
    email: site.email,
    telephone: site.phone,
    description: site.description[locale],
  }
}

/** One price, or the range when configurations cost differently (in lei, or converted like the page shows it). */
function offerPrice(p: Product & { price: number }, money: (bani: number) => string) {
  const prices = (p.variants ?? []).map((v) => v.price).filter((x): x is number => typeof x === 'number')
  if (!p.variablePrice || !prices.length) return { '@type': 'Offer', price: money(p.price) }
  return {
    '@type': 'AggregateOffer',
    lowPrice: money(Math.min(...prices)),
    highPrice: money(Math.max(...prices)),
    offerCount: prices.length,
  }
}

/**
 * Product structured data. An offer is published only once the product has an approved RON price. The English page
 * (canonical on .net) states the euro price the international store shows and charges (lei at the BNR rate, rounded
 * like the page), with delivery and returns worldwide.
 */
export function productJsonLd(p: Product, description: string, imageUrls: string[], locale: Locale = defaultLocale) {
  const url = pageUrl(locale, productHref(p))
  const intl = locale === 'en'
  const currency = intl ? 'EUR' : CURRENCY
  const money = (bani: number) => (convertUnit(bani, intl ? 'EUR' : 'RON') / 100).toFixed(2)
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
        ...offerPrice(p, money),
        priceCurrency: currency,
        availability: 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition',
        seller: { '@type': 'Organization', name: site.name },
        ...(!intl && {
          shippingDetails: {
            '@type': 'OfferShippingDetails',
            shippingRate: { '@type': 'MonetaryAmount', value: 0, currency },
            shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'RO' },
          },
        }),
        hasMerchantReturnPolicy: {
          '@type': 'MerchantReturnPolicy',
          ...(!intl && { applicableCountry: 'RO' }),
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
