import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { site } from '@/config/site'
import { intlOrigin } from '@/lib/seo'
import { isIntlHost } from '@/lib/sites'

/** Each storefront points to its own sitemap (biohack-tech.ro, www.biohack-tech.net). */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const intl = isIntlHost((await headers()).get('host'))
  return {
    rules: { userAgent: '*', allow: '/', // Cart, checkout and order pages are left crawlable on purpose: their own noindex keeps them out of results.
    disallow: ['/admin', '/api/'] },
    sitemap: `${intl ? intlOrigin() : site.url}/sitemap.xml`,
  }
}
