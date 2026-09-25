'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { Arrow } from '@/components/ui/icons'
import { getProduct, productHref } from '@/content/catalog'
import { formatMoney } from '@/lib/money'

const W = 1440
const H = 220
const POINTS = 180
const REST = 0.18

/**
 * Scene 4. A signal line runs across the screen behind the headset. Scattered while you're
 * distracted; hold the button (or wait for the first demo) and it settles into a calm wave,
 * the way a Neuros Game responds to attention. An illustration, labelled as such.
 * The path is written straight to the DOM each frame, only while the scene is visible.
 */
export function BrainLinkScene({ mode = 'home' }: { mode?: 'home' | 'page' }) {
  const product = getProduct('brainlink-pro')!
  const root = useRef<HTMLElement>(null)
  const path = useRef<SVGPathElement>(null)
  const readout = useRef<HTMLSpanElement>(null)
  const bar = useRef<HTMLSpanElement>(null)
  const target = useRef(REST)

  useEffect(() => {
    const el = root.current
    const line = path.current
    if (!el || !line) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let focus = REST
    let t = 0
    let raf = 0
    let visible = false
    let demoDone = false
    let demoTimer: ReturnType<typeof setTimeout> | undefined
    const phases = [0.3, 1.7, 2.9, 4.1, 5.3]

    const draw = () => {
      let d = ''
      for (let i = 0; i <= POINTS; i++) {
        const x = (i / POINTS) * W
        const u = i / POINTS
        const calm = Math.sin(u * Math.PI * 2 * 3.2 - t * 1.4) * 34
        let noise = 0
        for (let k = 0; k < phases.length; k++) noise += Math.sin(u * (19 + k * 13) + phases[k] + t * (2.1 + k * 0.9)) * (26 - k * 4)
        const y = H / 2 + calm * focus + noise * (1 - focus) * 0.95
        d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
      }
      line.setAttribute('d', d)
      el.style.setProperty('--f', focus.toFixed(3))
      const v = Math.round(focus * 100)
      if (readout.current) readout.current.textContent = String(v).padStart(2, '0')
      if (bar.current) bar.current.style.transform = `scaleX(${focus.toFixed(3)})`
    }

    const loop = () => {
      focus += (target.current - focus) * 0.045
      t += 1 / 60
      draw()
      raf = visible ? requestAnimationFrame(loop) : 0
    }

    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting
        if (still) {
          focus = target.current
          draw()
          return
        }
        if (visible && !raf) raf = requestAnimationFrame(loop)
        // First time it's properly on screen, show what focusing looks like.
        if (visible && e.intersectionRatio > 0.45 && !demoDone) {
          demoDone = true
          target.current = 0.9
          demoTimer = setTimeout(() => {
            if (target.current === 0.9) target.current = REST + 0.1
          }, 3200)
        }
      },
      { threshold: [0, 0.5] },
    )
    io.observe(el)
    draw()

    // Reduced motion: redraw when the button changes the target.
    const onTarget = () => still && ((focus = target.current), draw())
    el.addEventListener('focus-target', onTarget)

    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
      clearTimeout(demoTimer)
      el.removeEventListener('focus-target', onTarget)
    }
  }, [])

  const hold = (on: boolean) => {
    target.current = on ? 1 : REST + 0.1
    root.current?.dispatchEvent(new Event('focus-target'))
  }

  return (
    <section ref={root} id="brainlink" aria-labelledby="bl-title" className="bl-scene relative overflow-hidden bg-mist py-[var(--sec)]">
      <div className="wrap grid grid-cols-1 items-end gap-y-6 md:grid-cols-12 md:gap-x-6">
        <div className="md:col-span-7">
          <p className="font-mono text-[11.5px] tracking-[0.14em] text-muted uppercase">Pentru focus</p>
          <h2 id="bl-title" className="mt-3 text-[clamp(48px,8vw,120px)] leading-[0.92] tracking-[-0.055em]">
            BrainLink Pro
          </h2>
        </div>
        <div className="md:col-span-4 md:col-start-9">
          <p className="text-[17px] leading-relaxed text-text">Jocuri pe tabletă pe care le controlezi cu atenția. Când ești atent, jocul înaintează.</p>
          {mode === 'home' && (
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
              <span className="text-[19px] font-medium text-ink tabular-nums">{formatMoney(product.price)}</span>
              <Link href={productHref(product)} className="tlink">
                Vezi BrainLink Pro <Arrow />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* The signal runs the full width of the screen, behind the headset. */}
      <div className="relative mt-10 max-sm:mt-6">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden className="bl-wave absolute inset-x-0 top-1/2 h-[clamp(120px,18vw,220px)] w-full -translate-y-1/2">
          <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="bl-axis" />
          <path ref={path} className="bl-signal" fill="none" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="bl-product relative mx-auto aspect-[964/633] w-[min(620px,84vw)]">
          <Image src={product.cutout.src} alt={product.cutout.alt} fill sizes="(min-width: 768px) 620px, 84vw" className="object-contain" />
        </div>
      </div>

      <div className="wrap mt-8 flex flex-wrap items-center justify-between gap-x-8 gap-y-5 max-sm:mt-4">
        <button
          type="button"
          className="bl-hold"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            hold(true)
          }}
          onPointerUp={() => hold(false)}
          onPointerCancel={() => hold(false)}
          onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && hold(true)}
          onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && hold(false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className="bl-hold-ring" aria-hidden />
          Ține apăsat ca să te concentrezi
        </button>
        <div className="flex items-center gap-4" aria-hidden>
          <span className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">Focus</span>
          <span className="relative h-px w-28 bg-line">
            <span ref={bar} className="absolute inset-0 origin-left bg-cyan-700" style={{ transform: `scaleX(${REST})` }} />
          </span>
          <span ref={readout} className="w-7 font-mono text-[15px] text-ink tabular-nums">
            18
          </span>
        </div>
        <p className="w-full font-mono text-[11.5px] tracking-[0.1em] text-muted uppercase">Ilustrație. Așa răspund jocurile când ești atent.</p>
      </div>
    </section>
  )
}
