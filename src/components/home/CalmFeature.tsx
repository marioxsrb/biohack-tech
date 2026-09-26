import Image from 'next/image'
import { SceneBuy } from '@/components/scenes/SceneBuy'
import { getProduct } from '@/content/catalog'
import calm from '@/assets/img/balance-wave/result-calm.webp'

/**
 * NEUROS Calm's moment: a dark room, the device large on the floor line, a static red
 * light behind it. Hovering the device brightens the light and lifts it a little.
 */
export function CalmFeature() {
  const p = getProduct('balance-wave')!
  return (
    <section aria-labelledby="bw-title" className="relative mt-[var(--sec)] overflow-hidden bg-dark text-white">
      <div className="wrap grid min-h-[min(860px,100svh)] grid-cols-1 md:grid-cols-12 md:gap-x-6">
        <div className="relative z-10 self-center py-[var(--sec)] md:col-span-5 max-md:pb-8">
          <SceneBuy productId="balance-wave" headingId="bw-title" tone="dark" line="Câteva minute de lumină roșie, la gât. Apoi se oprește singur." />
          <p className="mt-8 font-mono text-[12px] tracking-[0.12em] text-white/70 uppercase">Lumină roșie · 5-20 min · Oprire automată</p>

          {/* The device in use, small, as proof of how it's worn */}
          <figure className="mt-10 flex items-center gap-4 max-md:hidden">
            <span className="relative h-20 w-28 flex-none overflow-hidden rounded-[10px]">
              <Image src={calm} alt="Femeie relaxată purtând NEUROS Calm la gât" fill sizes="112px" className="object-cover" />
            </span>
            <figcaption className="text-[15px] leading-snug text-white/80">Se așază la gât. Poți citi sau lucra ușor între timp.</figcaption>
          </figure>
        </div>

        {/* The device stands on the section's lower edge; its cable is cropped in the source photo. */}
        <div className="group relative self-end md:col-span-7 max-md:-mx-[var(--gut)]">
          <span aria-hidden className="glow pointer-events-none absolute inset-x-0 bottom-0 h-[90%] bg-[radial-gradient(ellipse_55%_60%_at_50%_85%,rgb(230_69_69/.38),rgb(230_69_69/.08)_55%,transparent_75%)] opacity-75" />
          <div className="lift relative mx-auto aspect-[631/478] w-[min(680px,100%)] origin-bottom">
            <Image src={p.cutout.src} alt={p.cutout.alt} fill sizes="(min-width: 768px) 680px, 100vw" className="object-contain object-bottom" />
          </div>
        </div>
      </div>
    </section>
  )
}
