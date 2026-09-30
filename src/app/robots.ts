import type { MetadataRoute } from 'next'
import { absolute } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', // Cart, checkout and order pages are left crawlable on purpose: their own noindex keeps them out of results.
    disallow: ['/admin', '/api/'] },
    sitemap: absolute('/sitemap.xml'),
  }
}
