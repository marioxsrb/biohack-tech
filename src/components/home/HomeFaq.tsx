import Link from 'next/link'
import { Accordion } from '@/components/ui/Accordion'
import { Arrow } from '@/components/ui/icons'
import { homeFaq } from '@/content/home'

/** Only the questions that decide a purchase. The rest live on /intrebari-frecvente. */
export function HomeFaq() {
  return (
    <section aria-labelledby="faq-title" className="wrap pt-[var(--sec)]">
      <div className="grid gap-y-6 lg:grid-cols-12 lg:gap-x-10">
        <div className="lg:col-span-5">
          <h2 id="faq-title" className="text-[clamp(34px,4vw,54px)] leading-[1] tracking-[-0.045em]">
            Întrebări
          </h2>
          <p className="mt-4 max-w-[22em] text-[17px] leading-relaxed text-text">Ce ne întreabă oamenii înainte să comande.</p>
          <Link href="/intrebari-frecvente" className="tlink mt-3">
            Toate întrebările <Arrow />
          </Link>
        </div>
        <div className="lg:col-span-7">
          <Accordion items={homeFaq} />
        </div>
      </div>
    </section>
  )
}
