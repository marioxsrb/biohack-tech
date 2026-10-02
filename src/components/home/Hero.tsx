import Image from 'next/image'
import { Arrow } from '@/components/ui/icons'
import { getLocale } from '@/i18n/server'
import hero from '@/assets/img/balance-wave/lifestyle-canapea.webp'

const COPY = {
  ro: {
    alt: 'Femeie relaxată pe canapea, cu NEUROS Calm la gât',
    line1: 'Mai calm seara.',
    line2: 'Mai atent ziua.',
    cta: 'Alege produsul',
    help: 'Te ajutăm să alegi',
  },
  en: {
    alt: 'Relaxed woman on a sofa, with NEUROS Calm around her neck',
    line1: 'Calmer evenings.',
    line2: 'Sharper days.',
    cta: 'Choose a product',
    help: 'Help me choose',
  },
}

/** The campaign photograph, one line, one action. Rendered by the server; no script needed. */
export async function Hero() {
  const t = COPY[await getLocale()]
  return (
    <section className="relative isolate flex h-[92svh] max-h-[960px] min-h-[600px] items-end overflow-hidden bg-dark text-white">
      <Image
        src={hero}
        alt={t.alt}
        fill
        loading="eager"
        fetchPriority="high"
        placeholder="blur"
        sizes="100vw"
        className="hero-img -z-10 object-cover object-[68%_30%] max-sm:object-[74%_22%]"
      />
      {/* Local shading only where text sits: the bar at the top, the headline at the lower left. */}
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-44 bg-[linear-gradient(180deg,rgba(8,17,19,.75),rgba(8,17,19,0))]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(8,17,19,.72)_0%,rgba(8,17,19,.25)_45%,rgba(8,17,19,0)_65%)] max-md:hidden" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-[55%] bg-[linear-gradient(0deg,rgba(8,17,19,.88),rgba(8,17,19,0))] max-md:h-[65%]" />

      {/* The photograph's lower edge; the header turns solid here. */}
      <span id="hero-end" aria-hidden className="absolute inset-x-0 bottom-0 h-px" />

      
      <div className="hero-copy wrap w-full pb-[clamp(64px,11vh,120px)] max-md:pb-[56px]">
        <h1 className="max-w-[9em] text-[clamp(52px,6.9vw,100px)] leading-[0.96] tracking-[-0.045em] !text-white">
          {t.line1}
          <br />
          {t.line2}
        </h1>
        <div className="on-dark mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <a href="#produse" className="cta">
            {t.cta} <Arrow />
          </a>
          <a href="#contact" className="tlink">
            {t.help} <Arrow />
          </a>
        </div>
      </div>
    </section>
  )
}
