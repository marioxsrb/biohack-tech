import Image from 'next/image'
import { SceneBuy } from './SceneBuy'
import { getProduct } from '@/content/catalog'

/**
 * The homepage's one product moment: NEUROS Calm large on a dark surface, its red light
 * warm behind it. Name, one sentence, price, button. The explaining happens on the product page.
 */
export function CalmFeature() {
  const p = getProduct('balance-wave')!
  return (
    <section aria-labelledby="calm-title" className="relative mt-[var(--sec)] overflow-hidden bg-dark text-white">
      <div className="wrap grid min-h-[min(820px,100svh)] grid-cols-1 md:grid-cols-12 md:gap-x-6">
        <div className="relative z-10 self-center py-[var(--sec)] md:col-span-5 max-md:pb-6">
          <SceneBuy productId="balance-wave" headingId="calm-title" tone="dark" line="Câteva minute de lumină roșie, la gât. Alegi durata și te relaxezi." />
        </div>

        {/* The device stands on the section's lower edge; its cable is cropped in the source photo. */}
        <div className="group relative self-end md:col-span-7 max-md:-mx-[var(--gut)]">
          <span aria-hidden className="glow pointer-events-none absolute inset-x-0 bottom-0 h-[90%] bg-[radial-gradient(ellipse_55%_60%_at_50%_85%,rgb(230_69_69/.36),rgb(230_69_69/.08)_55%,transparent_75%)] opacity-75" />
          <div className="lift relative mx-auto aspect-[631/478] w-[min(720px,100%)] origin-bottom">
            <Image src={p.cutout.src} alt={p.cutout.alt} fill sizes="(min-width: 768px) 720px, 100vw" className="object-contain object-bottom" />
          </div>
        </div>
      </div>
    </section>
  )
}
