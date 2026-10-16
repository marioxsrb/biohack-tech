import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { productHref, products } from '@/content/catalog'
import { legalPages } from '@/content/legal'
import { isIntlHost } from '@/lib/sites'
import { pageUrl } from '@/lib/seo'

type Entry = MetadataRoute.Sitemap[number]

/**
 * Each storefront lists its own pages: biohack-tech.ro the Romanian ones, www.biohack-tech.net the English ones,
 * each naming the other language's page (hreflang) and the English one as the default for other languages.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const intl = isIntlHost((await headers()).get('host'))
  const page = (path: string, changeFrequency: Entry['changeFrequency'], priority: number): Entry => {
    const languages = { 'ro-RO': pageUrl('ro', path), en: pageUrl('en', path), 'x-default': pageUrl('en', path) }
    return { url: pageUrl(intl ? 'en' : 'ro', path), changeFrequency, priority, alternates: { languages } }
  }
  return [
    page('/', 'weekly', 1),
    page('/products', 'weekly', 0.9),
    ...products.map((p) => page(productHref(p), 'weekly', 0.9)),
    page('/about-us', 'monthly', 0.5),
    page('/contact-us', 'monthly', 0.5),
    page('/intrebari-frecvente', 'monthly', 0.5),
    ...legalPages.map((p) => page(`/${p.slug}`, 'yearly', 0.2)),
  ]
}
