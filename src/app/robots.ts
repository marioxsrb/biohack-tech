import type { MetadataRoute } from 'next'
import { absolute } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/checkout', '/cart', '/comanda/', '/admin', '/api/'] },
    sitemap: absolute('/sitemap.xml'),
  }
}
