import type { MetadataRoute } from 'next'
import { productHref, products } from '@/content/catalog'
import { legalPages } from '@/content/legal'
import { localePath } from '@/i18n/locales'
import { absolute } from '@/lib/seo'

type Entry = MetadataRoute.Sitemap[number]

/** A page that exists in both languages: the Romanian URL, the English one, each naming the other. */
function both(path: string, changeFrequency: Entry['changeFrequency'], priority: number): Entry[] {
  const languages = { ro: absolute(path), en: absolute(localePath('en', path)) }
  return [
    { url: languages.ro, changeFrequency, priority, alternates: { languages } },
    { url: languages.en, changeFrequency, priority, alternates: { languages } },
  ]
}

/** Legal texts exist only in Romanian (their /en copies point their canonical here). */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...both('/', 'weekly', 1),
    ...both('/products', 'weekly', 0.9),
    ...products.flatMap((p) => both(productHref(p), 'weekly', 0.9)),
    ...both('/about-us', 'monthly', 0.5),
    ...both('/contact-us', 'monthly', 0.5),
    ...both('/intrebari-frecvente', 'monthly', 0.5),
    ...legalPages.map((p) => ({ url: absolute(`/${p.slug}`), changeFrequency: 'yearly' as const, priority: 0.2 })),
  ]
}
