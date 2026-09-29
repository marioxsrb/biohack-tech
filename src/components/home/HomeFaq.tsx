import Link from 'next/link'
import { Accordion } from '@/components/ui/Accordion'
import { faq } from '@/content/home'

/** Questions people ask before buying, grouped; each group is its own accordion. */
export function HomeFaq() {
  return (
    <section aria-labelledby="faq-title" className="wrap pt-[var(--sec)]">
      <div className="grid gap-y-8 md:grid-cols-12 md:gap-x-10">
        <div className="md:col-span-4">
          <div className="md:sticky md:top-[calc(var(--nav-h)+32px)]">
            <h2 id="faq-title" className="text-[clamp(34px,4vw,54px)] leading-[1] tracking-[-0.045em]">
              Întrebări frecvente
            </h2>
            <p className="mt-4 max-w-[24em] text-[17px] leading-relaxed text-text">Despre produse, oferte, plată, livrare și retur. Nu găsești răspunsul?</p>
            <Link href="#contact" className="tlink mt-4">
              Scrie-ne
            </Link>
          </div>
        </div>
        <div className="space-y-10 md:col-span-8">
          {faq.map((g) => (
            <div key={g.title}>
              <h3 className="mb-2 text-[14px] font-semibold tracking-[0.12em] text-cyan-700 uppercase">{g.title}</h3>
              <Accordion items={g.items} headingLevel={4} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
