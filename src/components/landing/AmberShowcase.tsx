'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Arrow } from '@/components/ui/icons'
import { getProduct, variantLabel, type ProductId } from '@/content/catalog'

/**
 * One product film per frame, in public/video/amber/<variant id>(-720).mp4 with a .jpg poster (its first
 * frame). Each film is a slow camera orbit from the front to the profile, generated between the real
 * photographs of that frame (front, three-quarter, profile), on the stage's own background.
 */
const film = (id: string) => ({ hd: `/video/amber/${id}.mp4`, sd: `/video/amber/${id}-720.mp4`, poster: `/video/amber/${id}.jpg` })

/** The crossfade from one frame's film to the next (ms). */
const FADE = 1200
/** The films play faster than they were rendered: a frame turns from the front to the profile in under 6 s. */
const SPEED = 1.75
/** Dragging across the whole stage turns the frame through its whole film. */
const SCRUB = 1

/**
 * NEUROS Amber on a dark stage, after the reference's product film: one frame at a time, large, turning
 * slowly from the front to the profile, then dissolving into the next frame. Plays only while on screen
 * and never with reduced motion; the visitor can pause it, drag (or use the arrow keys) to turn the
 * frame by hand, and pick a frame.
 */
export function AmberShowcase({ productId }: { productId: ProductId }) {
  const product = getProduct(productId)!
  const frames = useMemo(
    () =>
      (product.variants ?? []).map((v) => ({
        variant: v,
        label: variantLabel(product, v),
        thumb: v.images.find((i) => i.kind === 'cutout') ?? product.cutout,
        film: film(v.id),
      })),
    [product],
  )

  const [at, setAt] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  const [playing, setPlaying] = useState(true)
  const [inView, setInView] = useState(false)
  const [near, setNear] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const videos = useRef<(HTMLVideoElement | null)[]>([])
  const bars = useRef<(HTMLSpanElement | null)[]>([])
  const drag = useRef<{ x: number; t: number } | null>(null)

  useEffect(() => {
    // Reduced motion: nothing moves until the visitor asks for it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) setPlaying(false)
    const el = stageRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 })
    // Nothing is fetched until the stage is close (it must not compete with the hero).
    const soon = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '400px 0px' })
    io.observe(el)
    soon.observe(el)
    return () => {
      io.disconnect()
      soon.disconnect()
    }
  }, [])

  const running = playing && inView

  // The current film plays while running; the others rest (the outgoing one holds its frame as it fades).
  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (!v) return
      v.defaultPlaybackRate = SPEED
      v.playbackRate = SPEED
      if (i === at && running) v.play().catch(() => setPlaying(false))
      else v.pause()
    })
  }, [at, running])

  // Progress of the current film, drawn straight onto its bar (no re-render per frame), only while the
  // stage is on screen.
  useEffect(() => {
    if (!inView) return
    let raf = 0
    const tick = () => {
      const v = videos.current[at]
      bars.current.forEach((b, i) => {
        if (!b) return
        const p = i === at && v && v.duration ? v.currentTime / v.duration : 0
        b.style.transform = `scaleX(${p})`
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [at, inView])

  const show = (i: number) => {
    const next = (i + frames.length) % frames.length
    if (next === at) return
    const v = videos.current[next]
    if (v) v.currentTime = 0
    setPrev(at)
    setAt(next)
  }

  const scrubTo = (t: number) => {
    const v = videos.current[at]
    if (!v || !v.duration) return
    v.currentTime = Math.max(0, Math.min(v.duration - 0.05, t))
  }

  const current = frames[at]
  if (!current) return null

  const pause = (
    <button
      type="button"
      onClick={() => setPlaying((p) => !p)}
      aria-label={playing ? 'Oprește prezentarea' : 'Pornește prezentarea'}
      className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20"
    >
      {playing ? (
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
          <rect x="3.5" y="2.5" width="3" height="11" rx="1" />
          <rect x="9.5" y="2.5" width="3" height="11" rx="1" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" className="h-4 w-4 translate-x-[1px]" fill="currentColor" aria-hidden>
          <path d="M4.5 2.9v10.2a.9.9 0 0 0 1.37.77l8.1-5.1a.9.9 0 0 0 0-1.54l-8.1-5.1A.9.9 0 0 0 4.5 2.9Z" />
        </svg>
      )}
    </button>
  )

  return (
    <section id="rame" aria-labelledby="rame-title" className="on-dark relative isolate bg-dark text-white">
      {/* The stage: the whole width, like the reference's product film. */}
      <div
        ref={stageRef}
        role="group"
        aria-roledescription="prezentare video"
        aria-label={`${current.label}. Săgețile stânga și dreapta rotesc rama.`}
        tabIndex={0}
        onKeyDown={(e) => {
          const v = videos.current[at]
          if (!v || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return
          e.preventDefault()
          setPlaying(false)
          scrubTo(v.currentTime + (e.key === 'ArrowRight' ? 0.5 : -0.5))
        }}
        onPointerDown={(e) => {
          const v = videos.current[at]
          if (!v) return
          drag.current = { x: e.clientX, t: v.currentTime }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          const v = videos.current[at]
          if (!d || !v || !v.duration) return
          const dx = e.clientX - d.x
          if (Math.abs(dx) < 4) return
          if (playing) setPlaying(false)
          const w = e.currentTarget.clientWidth
          scrubTo(d.t + (-dx / w) * v.duration * SCRUB)
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
        className="amber-stage relative aspect-[4/3] cursor-grab touch-pan-y overflow-hidden select-none active:cursor-grabbing md:aspect-[16/10] lg:aspect-auto lg:h-[min(56.25vw,88vh)] lg:min-h-[560px]"
        style={{ '--fade': `${FADE}ms` } as React.CSSProperties}
      >
        {frames.map((f, i) => {
          const on = i === at
          // Only the film on stage and the one after it are fetched.
          const load = near && (on || i === (at + 1) % frames.length || i === prev)
          return (
            <video
              key={f.variant.id}
              ref={(el) => {
                videos.current[i] = el
              }}
              aria-hidden={!on}
              className={`amber-film ${on ? 'is-on' : ''}`}
              poster={near || on ? f.film.poster : undefined}
              preload={load ? 'auto' : 'none'}
              muted
              playsInline
              disablePictureInPicture
              onEnded={() => running && show(at + 1)}
            >
              <source src={f.film.sd} type="video/mp4" media="(max-width: 767px)" />
              <source src={f.film.hd} type="video/mp4" />
            </video>
          )
        })}
        <div aria-hidden className="amber-scrim pointer-events-none absolute inset-0" />
        <div className="absolute top-4 right-4 lg:hidden">{pause}</div>
      </div>

      {/* Over the stage on wide screens, under it on phones and tablets. */}
      <div className="pointer-events-none relative z-10 lg:absolute lg:inset-x-0 lg:bottom-0">
        <div className="lp-wrap grid items-end gap-x-12 gap-y-7 py-9 lg:grid-cols-[1fr_auto] lg:pb-12">
          <div className="pointer-events-auto">
            <p className="text-[13px] font-semibold tracking-[0.14em] text-[#f0b35a] uppercase">Patru rame · aceeași lentilă</p>
            <h2 id="rame-title" className="mt-3 max-w-[11em] text-[clamp(32px,4vw,56px)] leading-[0.98] tracking-[-0.045em] !text-white">
              Privește-i din toate unghiurile.
            </h2>
            <p aria-live="polite" className="mt-4 text-[16px] text-white/65">
              <span key={current.variant.id} className="amber-caption inline-block">
                {current.label}
              </span>
              <span> · Trage peste ochelari ca să îi rotești.</span>
            </p>
            <a href="#comanda" className="cta mt-7 max-sm:w-full">
              Alege perechile <Arrow />
            </a>
          </div>

          <div className="pointer-events-auto flex items-end gap-3 max-lg:-mx-1">
            <ul className="grid flex-1 grid-cols-4 gap-1.5 rounded-[22px] bg-white/[0.06] p-1.5 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)] backdrop-blur-md">
              {frames.map((f, i) => {
                const on = i === at
                return (
                  <li key={f.variant.id}>
                    <button
                      type="button"
                      onClick={() => {
                        show(i)
                        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) setPlaying(true)
                      }}
                      aria-pressed={on}
                      aria-label={f.label}
                      className={`group flex w-full flex-col items-center rounded-[16px] px-2 pt-2 pb-2.5 transition-colors duration-300 lg:w-[104px] ${on ? 'bg-white/[0.1]' : 'hover:bg-white/[0.05]'}`}
                    >
                      <span className="relative block aspect-[16/8] w-full">
                        <Image
                          src={f.thumb.src}
                          alt=""
                          fill
                          sizes="104px"
                          className={`object-contain transition-opacity duration-300 ${on ? 'opacity-100' : 'opacity-50 group-hover:opacity-85'}`}
                        />
                      </span>
                      {/* "Unisex pătrat · Negru" as two lines: the shape, then the colour. */}
                      <span aria-hidden className={`mt-1.5 text-center text-[11.5px] leading-tight transition-colors duration-300 ${on ? 'text-white' : 'text-white/50'}`}>
                        {f.label.split(' · ').map((part, j) => (
                          <span key={part} className={`block ${j ? 'opacity-60' : ''}`}>
                            {part}
                          </span>
                        ))}
                      </span>
                      {/* This frame's film, as a progress line. */}
                      <span aria-hidden className="relative mt-2 block h-[2px] w-full overflow-hidden rounded-full bg-white/15">
                        <span
                          ref={(el) => {
                            bars.current[i] = el
                          }}
                          className="absolute inset-0 origin-left bg-[#f0b35a]"
                          style={{ transform: 'scaleX(0)' }}
                        />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="max-lg:hidden">{pause}</div>
          </div>
        </div>
      </div>
    </section>
  )
}
