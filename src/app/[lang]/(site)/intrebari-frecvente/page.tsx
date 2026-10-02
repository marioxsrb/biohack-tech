import type { Metadata } from 'next'
import Link from '@/components/ui/Link'
import { Accordion } from '@/components/ui/Accordion'
import { Arrow } from '@/components/ui/icons'
import { homeContent } from '@/content/home'
import { getLocale } from '@/i18n/server'
import { pageMetadata } from '@/lib/seo'

const COPY = {
  ro: {
    title: 'Întrebări frecvente',
    description: 'Răspunsuri despre produsele NEUROS, oferte, plată, livrare, retur și garanție la Biohack Tech.',
    lead: 'Ai altă întrebare? Scrie-ne și îți răspundem în cel mult 24 de ore.',
  },
  en: {
    title: 'Frequently asked questions',
    description: 'Answers about NEUROS products, offers, payment, delivery, returns and warranty at Biohack Tech.',
    lead: 'Have another question? Write to us and we will reply within 24 hours.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const { title, description } = COPY[locale]
  return pageMetadata({ title, description, path: '/intrebari-frecvente', locale })
}

/** Every question, grouped. The homepage shows only the ones that decide a purchase. */
export default async function FaqPage() {
  const locale = await getLocale()
  const t = COPY[locale]
  const { faq } = homeContent[locale]
  return (
    <section className="pt-[calc(var(--nav-h)+64px)] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+32px)]">
      <div className="wrap grid gap-y-10 md:grid-cols-12 md:gap-x-10">
        <div className="md:col-span-4">
          <h1 className="text-[clamp(38px,4.6vw,60px)] leading-[1] tracking-[-0.045em]">{t.title}</h1>
          <p className="mt-4 max-w-[22em] text-[17px] leading-relaxed text-text">{t.lead}</p>
          <Link href="/contact-us" className="tlink mt-3">
            Contact <Arrow />
          </Link>
        </div>
        <div className="space-y-12 md:col-span-8">
          {faq.map((g) => (
            <div key={g.title}>
              <h2 className="mb-2 text-[14px] font-semibold tracking-[0.12em] text-cyan-700 uppercase">{g.title}</h2>
              <Accordion items={g.items} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
