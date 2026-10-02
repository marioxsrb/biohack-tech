import Link from '@/components/ui/Link'
import { Accordion } from '@/components/ui/Accordion'
import { Arrow } from '@/components/ui/icons'
import { homeContent } from '@/content/home'
import { getLocale } from '@/i18n/server'

const COPY = {
  ro: { title: 'Întrebări frecvente', intro: 'Ce ne întreabă clienții înainte să comande.', all: 'Toate întrebările' },
  en: { title: 'Frequently asked questions', intro: 'What customers ask us before they order.', all: 'All questions' },
}

/** Only the questions that decide a purchase. The rest live on /intrebari-frecvente. */
export async function HomeFaq() {
  const locale = await getLocale()
  const t = COPY[locale]
  const { homeFaq } = homeContent[locale]
  return (
    <section aria-labelledby="faq-title" className="wrap pt-[var(--sec)]">
      <div className="grid gap-y-6 lg:grid-cols-12 lg:gap-x-10">
        <div className="lg:col-span-5">
          <h2 id="faq-title" className="text-[clamp(34px,4vw,54px)] leading-[1] tracking-[-0.045em]">
            {t.title}
          </h2>
          <p className="mt-4 max-w-[22em] text-[17px] leading-relaxed text-text">{t.intro}</p>
          <Link href="/intrebari-frecvente" className="tlink mt-3">
            {t.all} <Arrow />
          </Link>
        </div>
        <div className="lg:col-span-7">
          <Accordion items={homeFaq} />
        </div>
      </div>
    </section>
  )
}
