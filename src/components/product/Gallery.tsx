'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { Arrow } from '@/components/ui/icons'
import type { ProductImage } from '@/content/catalog'
import { useLocale } from '@/i18n/LocaleProvider'

const COPY = {
  ro: {
    role: 'galerie',
    stage: (label: string, n: number, of: number) => `${label}, imaginea ${n} din ${of}. Folosește săgețile pentru a schimba imaginea.`,
    prev: 'Imaginea anterioară',
    next: 'Imaginea următoare',
    pick: 'Alege imaginea',
    thumb: (n: number, alt: string) => `Imaginea ${n}: ${alt}`,
  },
  en: {
    role: 'gallery',
    stage: (label: string, n: number, of: number) => `${label}, image ${n} of ${of}. Use the arrow keys to change the image.`,
    prev: 'Previous image',
    next: 'Next image',
    pick: 'Choose an image',
    thumb: (n: number, alt: string) => `Image ${n}: ${alt}`,
  },
}

type Props = {
  images: ProductImage[]
  label: string
  /** Wide products (glasses) use a shallower stage on phones, keeping the buy button on the first screen. */
  wide?: boolean
}

/**
 * Product gallery on a white stage. The stage is a native scroll-snap track, so it swipes
 * on touch devices with no gesture code; thumbnails and arrows drive the same track.
 * Cutouts sit whole, with a little air; photographs fill the stage.
 */
export function Gallery({ images, label, wide }: Props) {
  const t = COPY[useLocale()]
  const track = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  // Keep the active index in sync with swipes.
  useEffect(() => {
    const el = track.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setActive(Math.round(el.scrollLeft / el.clientWidth)))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
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
    <div role="region" aria-roledescription={t.role} aria-label={label} className="gallery-in">
      <div className="relative">
        <div
          ref={track}
          className={`flex aspect-[5/4] snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-[24px] bg-paper [scrollbar-width:none] max-sm:rounded-[20px] [&::-webkit-scrollbar]:hidden ${wide ? 'max-sm:aspect-[16/11]' : 'max-sm:aspect-square'}`}
          tabIndex={0}
          aria-label={t.stage(label, active + 1, images.length)}
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
            <div key={img.src.src} className="relative h-full w-full flex-none snap-center" aria-hidden={i !== active}>
              <div className={`absolute inset-0 ${img.kind === 'photo' ? '' : img.bleed === 'bottom' ? 'px-[8%] pt-[8%]' : 'p-[10%]'}`}>
                <div className="relative h-full w-full">
                  <Image
                    src={img.src}
                    alt={img.alt}
                    fill
                    sizes="(min-width: 1152px) 640px, (min-width: 768px) 56vw, 100vw"
                    preload={i === 0}
                    fetchPriority={i === 0 ? 'high' : 'low'}
                    placeholder={img.kind === 'photo' ? 'blur' : 'empty'}
                    className={img.studio ? 'object-contain' : img.kind === 'photo' ? 'object-cover' : `object-contain ${img.bleed === 'bottom' ? 'object-bottom' : ''}`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {images.length > 1 && (
          <>
            <button type="button" onClick={() => go(active - 1)} className="gal-arrow left-4" aria-label={t.prev}>
              <Arrow className="h-4 w-4 rotate-180" />
            </button>
            <button type="button" onClick={() => go(active + 1)} className="gal-arrow right-4" aria-label={t.next}>
              <Arrow className="h-4 w-4" />
            </button>
            {/* Phones: which image this is, in numbers, plus dots; the thumbnails sit under the photo. */}
            <span className="absolute top-3 right-3 rounded-full bg-mist/95 px-2.5 py-1 text-[13px] font-medium text-ink tabular-nums sm:hidden" aria-hidden>
              {active + 1} / {images.length}
            </span>
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5 sm:hidden" aria-hidden>
              {images.map((img, i) => (
                <span key={img.src.src} className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? 'w-5 bg-ink' : 'w-1.5 bg-ink/25'}`} />
              ))}
            </div>
          </>
        )}
      </div>

      {images.length > 1 && (
        <ul className="mt-2.5 flex gap-1.5 overflow-x-auto [scrollbar-width:none] sm:mt-3 sm:gap-2 [&::-webkit-scrollbar]:hidden" aria-label={t.pick}>
          {images.map((img, i) => (
            <li key={img.src.src} className="w-[56px] flex-none sm:w-auto sm:max-w-[88px] sm:min-w-0 sm:flex-1">
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={t.thumb(i + 1, img.alt)}
                aria-current={i === active}
                className={`relative block aspect-[5/4] w-full overflow-hidden rounded-[12px] bg-paper transition-[box-shadow,opacity] duration-200 ${
                  i === active ? 'shadow-[0_0_0_2px_var(--color-ink)]' : 'opacity-75 hover:opacity-100'
                }`}
              >
                <Image
                  src={img.src}
                  alt=""
                  fill
                  sizes="88px"
                  className={img.kind === 'photo' ? 'object-cover' : `object-contain p-[12%] ${img.bleed === 'bottom' ? 'object-bottom pb-0' : ''}`}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
