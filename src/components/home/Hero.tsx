import Image from 'next/image'
import { Arrow } from '@/components/ui/icons'
import hero from '@/assets/img/balance-wave/lifestyle-canapea.webp'

/** The campaign photograph, one line, one action. Rendered by the server; no script needed. */
export function Hero() {
  return (
    <section className="relative isolate flex h-[92svh] max-h-[960px] min-h-[600px] items-end overflow-hidden bg-dark text-white">
      <Image
        src={hero}
        alt="Femeie relaxată pe canapea, cu NEUROS Calm la gât"
        fill
        priority
        placeholder="blur"
        sizes="100vw"
        className="hero-img -z-10 object-cover object-[68%_30%] max-sm:object-[74%_22%]"
      />
      {/* Local shading only where text sits: the bar at the top, the headline at the lower left. */}
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-44 bg-[linear-gradient(180deg,rgba(8,17,19,.75),rgba(8,17,19,0))]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(8,17,19,.72)_0%,rgba(8,17,19,.25)_45%,rgba(8,17,19,0)_65%)] max-md:hidden" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-[55%] bg-[linear-gradient(0deg,rgba(8,17,19,.88),rgba(8,17,19,0))] max-md:h-[65%]" />

      {/* Marks where the product panels begin to overlap the photo; the header turns solid here. */}
      <span id="hero-end" aria-hidden className="absolute inset-x-0 bottom-[140px] h-px max-md:bottom-[96px]" />

      {/* Bottom padding leaves room for the product panels that rise over the photo's edge. */}
      <div className="hero-copy wrap w-full pb-[clamp(150px,22vh,230px)] max-md:pb-[120px]">
        <h1 className="max-w-[9em] text-[clamp(46px,6.4vw,92px)] leading-[0.96] tracking-[-0.045em] !text-white">
          Minte limpede.
          <br />
          Corp relaxat.
        </h1>
        <p className="mt-5 max-w-[26em] text-[clamp(16px,1.3vw,19px)] leading-snug text-white/85">
          Trei produse pentru relaxare, focus și timpul petrecut în fața ecranelor.
        </p>
        <a href="#produse" className="cta mt-7">
          Vezi produsele <Arrow />
        </a>
      </div>
    </section>
  )
}
