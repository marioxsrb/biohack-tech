import Link from '@/components/ui/Link'
import { Arrow } from '@/components/ui/icons'
import { BULK_OFFER } from '@/config/promotions'
import type { Locale } from '@/i18n/locales'

const COPY = {
  ro: { kicker: 'Pentru companii', text: (pct: number, min: number) => `${pct}% reducere la NEUROS Calm și Focus, de la ${min} de bucăți. Factură pe firmă.`, cta: 'Vezi oferta', href: '/pentru-companii' },
  en: { kicker: 'For business', text: (pct: number, min: number) => `${pct}% off NEUROS Calm and Focus, from ${min} units. Company invoice.`, cta: 'See the offer', href: '/for-business' },
}

/** A quiet entry to the business offer: one line on the home page, one under the buy box of Calm and Focus. */
export function BusinessStrip({ locale, compact = false, className = '' }: { locale: Locale; compact?: boolean; className?: string }) {
  const t = COPY[locale]
  if (compact)
    return (
      <Link href={t.href} className={`group flex items-center justify-between gap-3 rounded-[14px] bg-mist px-4 py-3 text-[14.5px] text-text hover:bg-mist-2 ${className}`}>
        <span>
          <b className="font-semibold text-ink">{t.kicker}:</b> {t.text(BULK_OFFER.percent, BULK_OFFER.minUnits)}
        </span>
        <Arrow className="h-4 w-4 flex-none text-ink transition-transform group-hover:translate-x-0.5" />
      </Link>
    )
  return (
    <section aria-label={t.kicker} className={`wrap ${className}`}>
      <Link href={t.href} className="group flex flex-wrap items-center justify-between gap-4 rounded-[24px] bg-ink px-[clamp(20px,4vw,40px)] py-6 text-white">
        <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="rounded-full bg-cyan-300 px-3 py-1 text-[14px] font-semibold text-ink">−{BULK_OFFER.percent}%</span>
          <span className="text-[13px] font-semibold tracking-[0.12em] text-cyan-300 uppercase">{t.kicker}</span>
          <span className="text-[17px] text-white/90">{t.text(BULK_OFFER.percent, BULK_OFFER.minUnits)}</span>
        </span>
        <span className="inline-flex items-center gap-2 text-[15.5px] font-medium">
          {t.cta} <Arrow className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </section>
  )
}
