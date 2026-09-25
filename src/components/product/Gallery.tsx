'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { Arrow } from '@/components/ui/icons'
import type { ProductImage } from '@/content/catalog'

/**
 * Product gallery. The main stage is a native scroll-snap track, so it swipes on touch
 * devices with no gesture code; thumbnails and arrows drive the same track.
 * Cutouts sit whole on the stage, photos fill it.
 */
/** `frame` lets wide products (glasses) use a shallower stage on phones, keeping the buy button on the first screen. */
export function Gallery({ images, label, frame = 'aspect-[4/3]' }: { images: ProductImage[]; label: string; frame?: string }) {
  const track = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  // Keep the active index in sync with swipes.
  useEffect(() => {
    const el = track.current
    if (!el) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setActive(Math.round(el.scrollLeft / el.clientWidth)))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])

  const go = (i: number) => {
    const el = track.current
    if (!el) return
    const next = (i + images.length) % images.length
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: next * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' })
    setActive(next)
  }

  return (
    <div role="region" aria-roledescription="galerie" aria-label={label} className="gallery-in">
      <div className="group relative">
        <div
          ref={track}
          className={`flex ${frame} snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-[24px] [scrollbar-width:none] max-sm:-mx-[var(--gut)] max-sm:rounded-none [&::-webkit-scrollbar]:hidden`}
          tabIndex={0}
          aria-label={`${label}, imaginea ${active + 1} din ${images.length}. Folosește săgețile pentru a schimba imaginea.`}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              e.preventDefault()
              go(active + 1)
            }
            if (e.key === 'ArrowLeft') {
              e.preventDefault()
              go(active - 1)
            }
          }}
        >
          {images.map((img, i) => (
            <div
              key={img.src.src}
              className="stage relative h-full w-full flex-none snap-center"
              aria-hidden={i !== active}
            >
              <div className={`absolute inset-0 ${img.kind === 'photo' ? '' : img.bleed === 'bottom' ? 'px-[7%] pt-[7%]' : 'p-[7%]'}`}>
                <div className="relative h-full w-full">
                  <Image
                    src={img.src}
                    alt={img.alt}
                    fill
                    sizes="(min-width: 1152px) 640px, (min-width: 768px) 56vw, 100vw"
                    priority={i === 0}
                    data-kind={img.kind}
                    placeholder={img.kind === 'photo' ? 'blur' : 'empty'}
                    className={img.kind === 'photo' ? 'object-cover' : `object-contain ${img.bleed === 'bottom' ? 'object-bottom' : ''}`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(active - 1)}
              className="gal-arrow left-4"
              aria-label="Imaginea anterioară"
            >
              <Arrow className="h-4 w-4 rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => go(active + 1)}
              className="gal-arrow right-4"
              aria-label="Imaginea următoare"
            >
              <Arrow className="h-4 w-4" />
            </button>
            {/* Phones: which image this is, in numbers, plus dots. Thumbnails are hidden there. */}
            <span className="absolute top-3 right-3 rounded-full bg-paper/90 px-2.5 py-1 text-[13px] font-medium text-ink tabular-nums sm:hidden" aria-hidden>
              {active + 1} / {images.length}
            </span>
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5 sm:hidden" aria-hidden>
              {images.map((img, i) => (
                <span
                  key={img.src.src}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? 'w-5 bg-ink' : 'w-1.5 bg-ink/25'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {images.length > 1 && (
        <ul className="mt-3 flex gap-2 max-sm:hidden" aria-label="Alege imaginea">
          {images.map((img, i) => (
            <li key={img.src.src} className="w-[84px] flex-none">
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={`Imaginea ${i + 1}: ${img.alt}`}
                aria-current={i === active}
                className={`block aspect-[4/3] w-full overflow-hidden rounded-[10px] transition-shadow duration-200 ${
                  i === active ? 'shadow-[0_0_0_2px_var(--color-ink)]' : 'opacity-80 hover:opacity-100'
                }`}
              >
                <span className="stage relative block h-full w-full">
                  <span className={`absolute inset-0 ${img.kind === 'photo' ? '' : img.bleed === 'bottom' ? 'px-[10%] pt-[10%]' : 'p-[10%]'}`}>
                    <span className="relative block h-full w-full">
                      <Image
                        src={img.src}
                        alt=""
                        fill
                        sizes="84px"
                        data-kind={img.kind}
                        className={img.kind === 'photo' ? 'object-cover' : `object-contain ${img.bleed === 'bottom' ? 'object-bottom' : ''}`}
                      />
                    </span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
