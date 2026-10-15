import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { AddedPopup } from '@/components/cart/AddedPopup'
import { WelcomePopup } from '@/components/site/WelcomePopup'
import { CartProvider } from '@/components/cart/CartProvider'
import { OfferSheetsProvider } from '@/components/offers/OfferSheets'
import { ConsentManager } from '@/components/consent/ConsentManager'
import { GATE_SCRIPT, GateRoot } from '@/components/gate/Gate'
import { notFound } from 'next/navigation'
import { lang } from 'next/root-params'
import { site } from '@/config/site'
import { LocaleProvider } from '@/i18n/LocaleProvider'
import { isLocale, locales } from '@/i18n/locales'
import { JsonLd, organizationJsonLd } from '@/lib/seo'
import '../globals.css'

const geist = Geist({ subsets: ['latin', 'latin-ext'], variable: '--font-geist', display: 'swap' })
// Mono sets only small labels: it loads with the page CSS instead of being preloaded ahead of the photograph.
const geistMono = Geist_Mono({ subsets: ['latin', 'latin-ext'], variable: '--font-geist-mono', display: 'swap', preload: false })

/** Both languages are known at build time; any other first segment is not a page. */
export function generateStaticParams() {
  return locales.map((l) => ({ lang: l }))
}
export const dynamicParams = false

const TITLE = { ro: 'dispozitive pentru relaxare și concentrare', en: 'devices for relaxation and focus' }

export async function generateMetadata(): Promise<Metadata> {
  const locale = await lang()
  const l = isLocale(locale) ? locale : 'ro'
  return {
    metadataBase: new URL(site.url),
    title: { default: `${site.name}: ${TITLE[l]}`, template: `%s | ${site.name}` },
    description: site.description[l],
    applicationName: site.name,
    formatDetection: { telephone: false },
  }
}

export const viewport: Viewport = {
  themeColor: '#081113',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: LayoutProps<'/[lang]'>) {
  const locale = await lang()
  if (!isLocale(locale)) notFound()
  return (
    <html lang={locale} data-scroll-behavior="smooth" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        {/* acces.<domain> only: marks prices as locked before the first paint (components/gate). */}
        <script dangerouslySetInnerHTML={{ __html: GATE_SCRIPT }} />
      </head>
      <body>
        {/* Site chrome (header, footer) lives in (site)/layout; advertising landings in (landing) have their own. */}
        <LocaleProvider locale={locale}>
          {/* First in the tab order, so the cookie choice is reachable before the page. */}
          <ConsentManager />
          <GateRoot>
            <CartProvider>
              <OfferSheetsProvider>
                {children}
                <AddedPopup />
                <WelcomePopup />
              </OfferSheetsProvider>
            </CartProvider>
          </GateRoot>
        </LocaleProvider>
        <JsonLd data={organizationJsonLd(locale)} />
      </body>
    </html>
  )
}
