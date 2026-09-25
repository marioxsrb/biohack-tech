import Image from 'next/image'
import { SceneBuy } from '@/components/scenes/SceneBuy'
import { getProduct } from '@/content/catalog'
import lucru from '@/assets/img/brainlink/audience-lucru.webp'

/**
 * BrainLink as a hardware campaign: the headset large on the light surface with a soft
 * shadow, one photograph of it in use overlapping from below. Hover lifts the headset.
 */
export function BrainLinkFeature() {
  const p = getProduct('brainlink-pro')!
  return (
    <section aria-labelledby="bl-title" className="relative py-[var(--sec)]">
      <div className="wrap grid grid-cols-1 items-center gap-y-12 md:grid-cols-12 md:gap-x-6">
        <div className="group relative md:col-span-7 md:col-start-6 md:row-start-1">
          <div className="lift relative aspect-[964/633] w-full">
            <Image src={p.cutout.src} alt={p.cutout.alt} fill sizes="(min-width: 768px) 660px, 92vw" className="object-contain" />
          </div>
          <span aria-hidden className="shade absolute -bottom-3 left-[20%] h-8 w-[60%] rounded-[50%]" />
        </div>

        <div className="md:col-span-5 md:col-start-1 md:row-start-1">
          <SceneBuy productId="brainlink-pro" headingId="bl-title" line="O cască ușoară și jocuri pe tabletă, controlate prin atenție." />
        </div>

        {/* In use: overlapping photograph, set off to the left under the copy */}
        <figure className="relative md:col-span-5 md:col-start-2 md:-mt-10 max-md:-mx-[var(--gut)]">
          <div className="relative aspect-[4/3] overflow-hidden md:rounded-[16px]">
            <Image src={lucru} alt="Bărbat la laptop, concentrat, purtând BrainLink Pro" fill placeholder="blur" sizes="(min-width: 768px) 460px, 100vw" className="object-cover" />
          </div>
          <figcaption className="mt-3 font-mono text-[12px] tracking-[0.12em] text-muted uppercase max-md:px-[var(--gut)]">Focus, la birou sau la studiu</figcaption>
        </figure>
      </div>
    </section>
  )
}
