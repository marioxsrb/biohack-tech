import Image from 'next/image'
import Link from 'next/link'
import { Arrow } from '@/components/ui/icons'
import photo from '@/assets/img/brainlink/lifestyle-relaxare.webp'

/** One image that runs off the left edge, one headline, three sentences. */
export function BrandStory() {
  return (
    <section aria-labelledby="brand-title" className="overflow-hidden py-[var(--sec)]">
      <div className="wrap grid grid-cols-1 items-center gap-y-10 md:grid-cols-12 md:gap-x-6">
        <div className="rev relative aspect-[5/4] md:col-span-7 md:-ml-[calc((100vw-min(100vw,1152px))/2+var(--gut))] max-md:-mx-[var(--gut)] max-md:aspect-[4/3]">
          <Image
            src={photo}
            alt="Femeie relaxată, cu ochii închiși, purtând casca BrainLink Pro"
            fill
            placeholder="blur"
            sizes="(min-width: 768px) 60vw, 100vw"
            className="object-cover object-[70%_center]"
          />
        </div>
        <div className="rev md:col-span-4 md:col-start-9">
          <h2 id="brand-title" className="text-[clamp(32px,3.4vw,50px)] leading-[1.02] tracking-[-0.04em]">
            Tehnologie pe care o folosești acasă.
          </h2>
          <p className="mt-6 text-[18px] leading-relaxed text-text">
            Pornim de la ce știe știința despre creier și corp. Le transformăm în obiecte simple, pe care le folosești câteva minute pe zi. Iar
            dacă ai întrebări, un specialist te ajută să începi.
          </p>
          <Link href="/about-us" className="tlink mt-5">
            Despre noi <Arrow />
          </Link>
        </div>
      </div>
    </section>
  )
}
