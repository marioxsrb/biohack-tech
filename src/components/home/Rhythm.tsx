import Image from 'next/image'
import { Check } from '@/components/ui/icons'
import { rhythm } from '@/content/home'

/**
 * Before / with, as two surfaces side by side: the same evening without a habit (grey, desaturated)
 * and with one (warm, in colour). Routines, not results: nothing here promises an outcome.
 */
export function Rhythm() {
  return (
    <section aria-labelledby="rhythm-title" className="pt-[var(--sec)]">
      <div className="wrap">
        <div className="grid gap-y-4 md:grid-cols-12 md:gap-x-6">
          <h2 id="rhythm-title" className="text-[clamp(34px,4.4vw,60px)] leading-[1] tracking-[-0.045em] md:col-span-6">
            {rhythm.title}
          </h2>
          <p className="max-w-[30em] self-end text-[18px] leading-relaxed text-text md:col-span-5 md:col-start-8">{rhythm.intro}</p>
        </div>

        <div className="mt-12 grid overflow-hidden rounded-[28px] md:grid-cols-2 max-sm:mt-10 max-sm:-mx-[var(--gut)] max-sm:rounded-none">
          <div className="bg-[#dfe4e6] p-[clamp(20px,3.4vw,40px)]">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[18px]">
              <Image src={rhythm.before.image.src} alt={rhythm.before.image.alt} fill placeholder="blur" sizes="(min-width: 1152px) 520px, (min-width: 768px) 46vw, 100vw" className="object-cover grayscale-[0.85] contrast-[0.9]" />
            </div>
            <p className="mt-6 text-[14px] font-semibold tracking-[0.12em] text-[#4a575d] uppercase">{rhythm.before.label}</p>
            <ul className="mt-4 space-y-3">
              {rhythm.before.items.map((t) => (
                <li key={t} className="flex gap-3 text-[17px] leading-snug text-[#3a464b]">
                  <span aria-hidden className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-[#7d8a90]" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-paper p-[clamp(20px,3.4vw,40px)]">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[18px]">
              <Image src={rhythm.after.image.src} alt={rhythm.after.image.alt} fill placeholder="blur" sizes="(min-width: 1152px) 520px, (min-width: 768px) 46vw, 100vw" className="object-cover object-[50%_35%]" />
            </div>
            <p className="mt-6 text-[14px] font-semibold tracking-[0.12em] text-cyan-700 uppercase">{rhythm.after.label}</p>
            <ul className="mt-4 space-y-3">
              {rhythm.after.items.map((t) => (
                <li key={t} className="flex gap-3 text-[17px] leading-snug font-medium text-ink">
                  <Check className="mt-0.5 h-5 w-5 flex-none text-cyan-700" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-4 text-[14px] text-muted">{rhythm.note}</p>
      </div>
    </section>
  )
}
