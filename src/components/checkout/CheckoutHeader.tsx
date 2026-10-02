'use client'

import Link from '@/components/ui/Link'
import { useSearchParams } from 'next/navigation'
import { Lock, Phone } from '@/components/ui/icons'
import { Wordmark } from '@/components/site/Wordmark'
import { site } from '@/config/site'
import { useLocale } from '@/i18n/LocaleProvider'
import { isLandingSlug } from '@/lib/landing-hosts'

/**
 * Brand, a phone number for help, and "secure payment". From an advertising landing the brand leads back
 * to that landing (on its own hostname `/lp/<slug>` redirects to its root), not to the store.
 */
export function CheckoutHeader({ live = false }: { live?: boolean }) {
  return live ? <Live /> : <Bar home="/" />
}

function Live() {
  const lp = useSearchParams().get('lp')
  return <Bar home={isLandingSlug(lp) ? `/lp/${lp}` : '/'} />
}

function Bar({ home }: { home: string }) {
  const en = useLocale() === 'en'
  return (
    <header className="border-b border-line bg-paper">
      <div className="wrap flex h-16 items-center justify-between gap-4">
        <Link href={home} aria-label="Biohack Tech" className="flex min-h-11 items-center text-ink">
          <Wordmark tone="light" />
        </Link>
        <div className="flex items-center gap-5 text-[14px] text-muted">
          <a href={site.phoneHref} className="flex min-h-11 items-center gap-2 hover:text-ink">
            <Phone className="h-4 w-4" />
            <span className="max-sm:sr-only">{en ? 'Help: ' : 'Ajutor: '}</span>
            {site.phone}
          </a>
          <span className="flex items-center gap-2 max-sm:hidden">
            <Lock className="h-4 w-4" /> {en ? 'Secure payment' : 'Plată securizată'}
          </span>
        </div>
      </div>
    </header>
  )
}
