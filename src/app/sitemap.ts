import type { MetadataRoute } from 'next'
import { productHref, products } from '@/content/catalog'
import { legalPages } from '@/content/legal'
import { absolute } from '@/lib/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absolute('/'), changeFrequency: 'weekly', priority: 1 },
    { url: absolute('/products'), changeFrequency: 'weekly', priority: 0.9 },
    ...products.map((p) => ({ url: absolute(productHref(p)), changeFrequency: 'weekly' as const, priority: 0.9 })),
    { url: absolute('/about-us'), changeFrequency: 'monthly', priority: 0.5 },
    { url: absolute('/contact-us'), changeFrequency: 'monthly', priority: 0.5 },
    { url: absolute('/intrebari-frecvente'), changeFrequency: 'monthly', priority: 0.5 },
    ...legalPages.map((p) => ({ url: absolute(`/${p.slug}`), changeFrequency: 'yearly' as const, priority: 0.2 })),
  ]
}
