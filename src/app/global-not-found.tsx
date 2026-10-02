import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import NextLink from 'next/link'
import './globals.css'

const geist = Geist({ subsets: ['latin', 'latin-ext'], variable: '--font-geist', display: 'swap' })

export const metadata: Metadata = { title: 'Pagina s-a mutat | Biohack Tech', robots: { index: false } }

/**
 * A URL that matches no route (several unknown segments). It renders outside the [lang] layout, so it
 * speaks both languages and links home. Known single segments get app/[lang]/not-found.tsx instead.
 */
export default function GlobalNotFound() {
  return (
    <html lang="ro" className={geist.variable}>
      <body>
        <main className="wrap max-w-[760px] pt-[18vh] pb-[var(--sec)]">
          <p className="mono !text-cyan-700">404</p>
          <h1 className="mt-3 text-[36px] leading-tight tracking-[-0.035em]">Pagina s-a mutat.</h1>
          <p className="sub mt-2" lang="en">This page has moved.</p>
          <p className="mt-8 flex gap-6 text-[17px]">
            <NextLink href="/" className="tlink">
              Înapoi la Biohack Tech
            </NextLink>
            <NextLink href="/en" lang="en" className="tlink">
              Back to Biohack Tech
            </NextLink>
          </p>
        </main>
      </body>
    </html>
  )
}
