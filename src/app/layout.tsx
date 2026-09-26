import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { AddedPopup } from '@/components/cart/AddedPopup'
import { CartProvider } from '@/components/cart/CartProvider'
import { Footer } from '@/components/site/Footer'
import { Header } from '@/components/site/Header'
import { site } from '@/config/site'
import { JsonLd, organizationJsonLd } from '@/lib/seo'
import './globals.css'

const geist = Geist({ subsets: ['latin', 'latin-ext'], variable: '--font-geist', display: 'swap' })
const geistMono = Geist_Mono({ subsets: ['latin', 'latin-ext'], variable: '--font-geist-mono', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name}: dispozitive de wellness pentru acasă`, template: `%s | ${site.name}` },
  description: site.description,
  applicationName: site.name,
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#081113',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" data-scroll-behavior="smooth" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body>
        <CartProvider>
          <Header />
          <main id="main">{children}</main>
          <Footer />
          <AddedPopup />
        </CartProvider>
        <JsonLd data={organizationJsonLd()} />
      </body>
    </html>
  )
}
