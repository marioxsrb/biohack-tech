import type { Metadata } from 'next'
import Image from 'next/image'
import { VisitBeacon } from '@/components/gate/VisitBeacon'
import { Arrow } from '@/components/ui/icons'
import { Wordmark } from '@/components/site/Wordmark'
import { getProduct } from '@/content/catalog'
import { landings } from '@/content/landings'

export const metadata: Metadata = { title: { absolute: 'Produsele NEUROS | Biohack Tech' }, robots: { index: false, follow: false } }

/** The price-gated funnel's home: the three products, what each is for, no price. Each opens its own page. */
export default function GatedHome() {
  return (
    <div className="min-h-dvh bg-mist">
      <VisitBeacon page="home" />
      <header className="wrap flex h-16 items-center">
        <Wordmark tone="light" />
      </header>
      <main id="main" className="wrap pt-[calc(var(--sec)*0.5)] pb-[var(--sec)]">
        <h1 className="max-w-[14em] text-[clamp(34px,4.2vw,58px)] leading-[1] tracking-[-0.045em]">Mai calm seara. Mai atent ziua.</h1>
        <p className="mt-4 max-w-[34em] text-[18px] leading-relaxed text-text">Trei dispozitive NEUROS, pentru stres, concentrare și ochi obosiți de ecrane. Alege ce te interesează și vezi prețul și oferta de azi.</p>
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {landings.map((l) => {
            const p = getProduct(l.productId)!
            return (
              <li key={l.slug}>
                <a href={`/${l.slug}`} className="group flex h-full flex-col overflow-hidden rounded-[28px] bg-paper transition-shadow hover:shadow-[0_24px_60px_-30px_rgba(8,17,19,.35)]">
                  <div className="relative aspect-[4/3] bg-mist-2">
                    <Image src={p.cutout.src} alt={p.cutout.alt} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-contain p-[10%] transition-transform duration-500 group-hover:scale-[1.04]" />
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <p className="text-[14px] font-semibold text-cyan-700">{p.purpose}</p>
                    <h2 className="mt-1 text-[28px] leading-tight tracking-[-0.03em]">{p.name}</h2>
                    <p className="mt-2 text-[15.5px] leading-snug text-text">{p.tagline}</p>
                    <span className="cta sm mt-auto self-start pt-0 mt-6">
                      Vezi produsul <Arrow />
                    </span>
                  </div>
                </a>
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}
