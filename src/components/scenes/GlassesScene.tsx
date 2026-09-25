'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { useScrollVars } from '@/components/motion/scroll-vars'
import { Check } from '@/components/ui/icons'
import { getProduct, variantLabel } from '@/content/catalog'
import { SceneBuy } from './SceneBuy'
import portrait from '@/assets/img/glasses/result-stil.webp'

/**
 * Scene 5. Fashion, not tech: an editorial portrait on one side; on the other, the frame
 * itself, large, over its oversized model name. Frames switch by tapping, arrow keys or
 * a swipe on the stage, sliding in the direction you move.
 */
export function GlassesScene({ mode = 'home' }: { mode?: 'home' | 'page' }) {
  const product = getProduct('ochelari-biohack')!
  const variants = product.variants!
  const ref = useRef<HTMLElement>(null)
  const [index, setIndex] = useState(0)
  const swipe = useRef<number | null>(null)
  useScrollVars(ref)

  const go = (i: number) => {
    const next = (i + variants.length) % variants.length
    if (next !== index) setIndex(next)
  }

  const v = variants[index]
  const model = product.options![0].values.find((o) => o.id === v.options.model)!.label
  const label = variantLabel(product, v)

  return (
    <section ref={ref} id="ochelari" aria-labelledby="gl-title" className="gl-scene relative scroll-mt-[var(--nav-h)] overflow-hidden bg-paper py-[var(--sec)]">
      <div className="wrap grid grid-cols-1 items-center gap-y-12 md:grid-cols-12 md:gap-x-6">
        {/* Portrait, bleeding off the left edge */}
        <figure className="gl-portrait relative aspect-[4/5] md:col-span-5 md:-ml-[calc((100vw-min(100vw,1152px))/2+var(--gut))] max-md:-mx-[var(--gut)] max-md:aspect-[5/4]">
          <Image src={portrait} alt="Femeie purtând Ochelari Biohack cat eye bej, în lumină naturală" fill placeholder="blur" sizes="(min-width: 768px) 46vw, 100vw" className="gl-portrait-img object-cover object-[50%_30%]" />
          <figcaption className="absolute bottom-4 left-[max(var(--gut),calc((100vw-1152px)/2+var(--gut)))] rounded-full bg-paper/90 px-3 py-1.5 font-mono text-[11.5px] tracking-[0.1em] text-ink uppercase backdrop-blur md:left-auto md:right-4">
            Cat eye · Bej
          </figcaption>
        </figure>

        <div className="md:col-span-7 md:pl-6">
          <SceneBuy productId="ochelari-biohack" headingId="gl-title" part="head" line="Filtrează lumina albastră a ecranelor. Alege rama care îți place." />

          {/* Stage */}
          <div
            className="gl-stage relative mt-8 aspect-[16/9] touch-pan-y select-none"
            onPointerDown={(e) => (swipe.current = e.clientX)}
            onPointerUp={(e) => {
              if (swipe.current === null) return
              const dx = e.clientX - swipe.current
              swipe.current = null
              if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1))
            }}
            onPointerCancel={() => (swipe.current = null)}
          >
            <p aria-hidden className="gl-giant pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 leading-none font-medium tracking-[-0.06em] whitespace-nowrap">
              <span key={model} className="gl-giant-word inline-block">
                {model}
              </span>
            </p>
            <span aria-hidden className="gl-shadow absolute bottom-[10%] left-1/2 h-6 w-[62%] -translate-x-1/2 rounded-[50%]" />
            {variants.map((vv, i) => (
              <div
                key={vv.id}
                className="gl-frame absolute inset-0"
                data-state={i === index ? 'on' : i < index ? 'before' : 'after'}
                aria-hidden={i !== index}
              >
                <Image src={vv.images[0].src} alt={vv.images[0].alt} fill sizes="(min-width: 768px) 560px, 92vw" className="object-contain p-[4%]" />
              </div>
            ))}
          </div>

          {/* Selector */}
          <div
            role="radiogroup"
            aria-label="Alege rama"
            className="mt-6 grid grid-cols-4 gap-2 max-sm:grid-cols-2"
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault()
                go(index + (e.key === 'ArrowRight' ? 1 : -1))
              }
            }}
          >
            {variants.map((vv, i) => (
              <button
                key={vv.id}
                type="button"
                role="radio"
                aria-checked={i === index}
                tabIndex={i === index ? 0 : -1}
                onClick={() => go(i)}
                className="gl-pick group relative rounded-[12px] p-2 text-left transition-[background-color,box-shadow] duration-200 hover:bg-mist aria-checked:bg-mist aria-checked:shadow-[inset_0_0_0_2px_var(--color-ink)]"
              >
                <span aria-hidden className="absolute top-2 right-2 hidden h-5 w-5 items-center justify-center rounded-full bg-ink text-white group-aria-checked:flex">
                  <Check className="h-3 w-3" />
                </span>
                <span className="relative block aspect-[16/9]">
                  <Image src={vv.images[0].src} alt="" fill sizes="120px" className="object-contain p-[6%]" />
                </span>
                <span className="mt-1 block text-[14px] leading-tight text-text group-aria-checked:font-semibold group-aria-checked:text-ink">
                  {variantLabel(product, vv)}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-8">
            <SceneBuy
              productId="ochelari-biohack"
              headingId="gl-title"
              part="action"
              variantId={v.id}
              note={`Rama aleasă: ${label}`}
              showLink={mode === 'home'}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
