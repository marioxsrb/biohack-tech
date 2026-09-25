import Link from 'next/link'
import { Faq } from '@/components/ui/Faq'
import { Idx } from '@/components/ui/Idx'
import { Arrow } from '@/components/ui/icons'
import { homeFaqs } from '@/content/home'

export function HomeFaq() {
  return (
    <section className="sec bg-mist" aria-labelledby="faq-title">
      <div className="wrap grid gap-y-10 md:grid-cols-12 md:gap-x-6">
        <div className="md:col-span-4">
          <Idx n="05">Întrebări</Idx>
          <h2 id="faq-title" className="h2 rev">
            Întrebări frecvente
          </h2>
          <p className="sub rev mt-4">Comenzi, livrare, garanție și ghidaj.</p>
          <Link href="/contact-us" className="tlink rev mt-3">
            Altă întrebare? Scrie-ne <Arrow />
          </Link>
        </div>
        <div className="rev md:col-span-8">
          <Faq items={homeFaqs} />
        </div>
      </div>
    </section>
  )
}
