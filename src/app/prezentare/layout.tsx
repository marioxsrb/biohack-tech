import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import '../globals.css'

const geist = Geist({ subsets: ['latin', 'latin-ext'], variable: '--font-geist', display: 'swap' })

export const metadata: Metadata = { robots: { index: false, follow: false } }

export const viewport: Viewport = {
  themeColor: '#081113',
  width: 'device-width',
  initialScale: 1,
}

/**
 * A root layout of its own for the presentation pages: no cart, no offers, no cookie manager, no
 * language switch. The page is static HTML and images; the only script beyond the framework is the
 * NEUROS Focus video player.
 */
export default function PresentationLayout({ children }: LayoutProps<'/prezentare'>) {
  return (
    <html lang="ro" data-scroll-behavior="smooth" className={geist.variable}>
      <body>{children}</body>
    </html>
  )
}
