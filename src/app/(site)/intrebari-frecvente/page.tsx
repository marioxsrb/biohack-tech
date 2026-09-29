import type { Metadata } from 'next'
import Link from 'next/link'
import { Accordion } from '@/components/ui/Accordion'
import { Arrow } from '@/components/ui/icons'
import { faq } from '@/content/home'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Întrebări frecvente',
  description: 'Produse, oferte, plată, livrare, retur și garanție la Biohack Tech, pe scurt.',
  path: '/intrebari-frecvente',
})

/** Every question, grouped. The homepage shows only the ones that decide a purchase. */
export default function FaqPage() {
  return (
    <section className="pt-[calc(var(--nav-h)+64px)] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+32px)]">
      <div className="wrap grid gap-y-10 md:grid-cols-12 md:gap-x-10">
        <div className="md:col-span-4">
          <h1 className="text-[clamp(38px,4.6vw,60px)] leading-[1] tracking-[-0.045em]">Întrebări frecvente</h1>
          <p className="mt-4 max-w-[22em] text-[17px] leading-relaxed text-text">Nu găsești răspunsul? Scrie-ne și îți răspundem în cel mult 24 de ore.</p>
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
