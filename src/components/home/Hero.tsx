import Image from 'next/image'
import { Arrow } from '@/components/ui/icons'
import hero from '@/assets/img/balance-wave/lifestyle-canapea.webp'

/** Campaign hero: one photograph, one line, one action. */
export function Hero() {
  return (
    <section className="relative isolate flex h-[100svh] max-h-[980px] min-h-[640px] items-end overflow-hidden bg-dark text-white max-sm:min-h-[600px]">
      <Image
        src={hero}
        alt="Femeie relaxată pe canapea, cu Balance Wave la gât"
        fill
        priority
        placeholder="blur"
        sizes="100vw"
        className="-z-10 object-cover object-[68%_30%] max-sm:object-[72%_20%]"
      />
      {/* Legibility only: darkens the side and bottom where the text sits. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(8,17,19,.78)_0%,rgba(8,17,19,.35)_45%,rgba(8,17,19,0)_70%)] max-md:bg-[linear-gradient(0deg,rgba(8,17,19,.88)_0%,rgba(8,17,19,.45)_42%,rgba(8,17,19,0)_70%)]"
      />
      <div className="wrap w-full pb-[clamp(56px,11vh,120px)]">
        <h1 className="hero-rise max-w-[9.5em] text-[clamp(44px,6.4vw,92px)] leading-[0.98] tracking-[-0.045em] !text-white">
          Minte limpede.
          <br />
          Corp relaxat.
        </h1>
        <p className="hero-rise mt-6 max-w-[24em] text-[clamp(17px,1.4vw,20px)] leading-snug text-white/80 [animation-delay:.08s] max-sm:mt-4">
          Trei produse simple, pentru fiecare zi.
        </p>
        <a href="#produse" className="cta hero-rise mt-9 [animation-delay:.16s] max-sm:mt-7">
          Vezi produsele <Arrow />
        </a>
      </div>
    </section>
  )
}
