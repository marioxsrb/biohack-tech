'use client'

/**
 * Real reviews (content/reviews.ts) drifting endlessly under the store's figures (config/social-proof.ts).
 * Homepage: every review, in two lanes running opposite ways. A product page or its landing: one lane with
 * only that product's reviews (none for a product without reviews: then nothing is shown).
 *
 * Driven by one requestAnimationFrame loop per lane, so stopping is exact and smooth:
 *   - mouse: the lane eases to a stop on the review under the cursor and eases back when the cursor leaves;
 *   - touch: a tap pins a review (the lane stops), a second tap or a tap elsewhere releases it;
 *   - drag (mouse or finger) moves the lane by hand, then it carries on;
 *   - keyboard: focusing a review stops its lane;
 *   - nothing runs while the section is off screen or the tab is hidden;
 *   - reduced motion: no drifting, the lanes still drag.
 */
import Image from 'next/image'
import { useCallback, useEffect, useRef, useState, type FocusEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { socialProof } from '@/config/social-proof'
import { getProduct } from '@/content/catalog'
import { reviews as allReviews, reviewsFor, type Review } from '@/content/reviews'
import type { ProductId } from '@/content/catalog'
import { useLocale } from '@/i18n/LocaleProvider'

const MONTHS = {
  ro: ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}
const COPY = {
  ro: { happy: 'clienți mulțumiți', of5: 'din 5', label: 'Ce spun clienții', stars: (n: number) => `${n} din 5 stele`, help: 'Treci cu cursorul peste o recenzie ca s-o oprești. Pe telefon, atinge-o.' },
  en: { happy: 'happy customers', of5: 'out of 5', label: 'What customers say', stars: (n: number) => `${n} out of 5 stars`, help: 'Hover over a review to stop it. On a phone, tap it.' },
}

const GAP = 18

/**
 * Hover means a real mouse: the device can hover and no finger touched the screen just before (touch
 * browsers send compatibility mouse events after a tap, which would re-activate a review just released).
 */
let lastTouch = 0
const realHover = () => Date.now() - lastTouch > 800 && window.matchMedia('(hover: hover)').matches
/** Drift speed in px per second. */
const SPEED = 34

const initials = (name: string) =>
  name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span aria-hidden className="inline-flex gap-[3px]">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 20 20" width={size} height={size} fill="currentColor" className={i <= Math.round(value) ? 'text-[#f5b544]' : 'text-white/18'}>
          <path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8L10 1.6z" />
        </svg>
      ))}
    </span>
  )
}

function Card({ k, r, active, dimmed, copy, showProduct, onActivate }: { k: string; r: Review; active: boolean; dimmed: boolean; copy?: boolean; showProduct: boolean; onActivate: () => void }) {
  const locale = useLocale()
  const t = COPY[locale]
  const product = getProduct(r.productId, locale)
  const [y, m] = r.month.split('-').map(Number)
  const ref = useRef<HTMLElement>(null)
  // A soft light that follows the cursor across the active review.
  const follow = (e: ReactPointerEvent) => {
    const el = ref.current
    if (!el || e.pointerType !== 'mouse') return
    const b = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - b.left}px`)
    el.style.setProperty('--my', `${e.clientY - b.top}px`)
  }
  return (
    <figure
      ref={ref}
      data-review
      data-key={k}
      tabIndex={copy ? -1 : 0}
      aria-hidden={copy || undefined}
      onPointerEnter={(e) => e.pointerType === 'mouse' && realHover() && onActivate()}
      onPointerMove={follow}
      onFocus={(e) => e.currentTarget.matches(':focus-visible') && onActivate()}
      className={`rv2-card relative flex w-[min(360px,80vw)] flex-none flex-col overflow-hidden rounded-[24px] p-6 outline-none select-none ${active ? 'is-active' : ''} ${dimmed ? 'is-dimmed' : ''}`}
    >
      <span aria-hidden className="rv2-glow pointer-events-none absolute inset-0" />
      <span aria-hidden className="pointer-events-none absolute -top-3 right-5 font-serif text-[110px] leading-none text-white/[0.05]">
        ”
      </span>
      <div className="relative flex items-center justify-between gap-3">
        <Stars value={r.rating} />
        <span className="sr-only">{t.stars(r.rating)}</span>
        <span className="text-[12.5px] text-dark-muted first-letter:uppercase">
          {MONTHS[locale][m - 1]} {y}
        </span>
      </div>
      <blockquote className="relative mt-4 flex-1 text-[16.5px] leading-[1.6] text-white/90">„{r.quote}”</blockquote>
      <figcaption className="relative mt-6 flex items-center gap-3">
        <span aria-hidden className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white/[0.08] text-[13.5px] font-semibold text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]">
          {initials(r.name)}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[15px] font-semibold text-white">{r.name}</span>
          {showProduct && <span className="mt-1 block truncate text-[13px] text-dark-muted">{product?.name}</span>}
        </span>
        {showProduct && product && (
          <span aria-hidden className="relative h-12 w-12 flex-none overflow-hidden rounded-[14px] bg-white/[0.08] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1)]">
            <Image src={product.cutout.src} alt="" fill fetchPriority="low" sizes="48px" className="object-contain p-1.5" />
          </span>
        )}
      </figcaption>
    </figure>
  )
}

function Lane({ items: list, reverse, reduced, showProduct }: { items: Review[]; reverse?: boolean; reduced: boolean; showProduct: boolean }) {
  // Enough cards that one copy is wider than any screen; the second copy is the seamless tail.
  let items = list
  while (items.length < 8) items = [...items, ...list]
  const track = useRef<HTMLDivElement>(null)
  const set = useRef<HTMLDivElement>(null)
  const lane = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<string | null>(null)
  const [pinned, setPinned] = useState(false)
  const s = useRef({ x: 0, v: 0, width: 0, visible: true, drag: null as null | { start: number; last: number; moved: number; id: number }, hold: false, snap: 0 })

  // Hold when a review is active (hovered, focused or pinned) or while dragging.
  useEffect(() => {
    s.current.hold = active !== null
  }, [active])

  useEffect(() => {
    const st = s.current
    const measure = () => {
      st.width = (set.current?.offsetWidth ?? 0) + GAP
      // Start the reverse lane half a card in, so the two lanes never line up.
      if (reverse && st.x === 0) st.x = -st.width / 2
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (set.current) ro.observe(set.current)
    const io = new IntersectionObserver(([e]) => (st.visible = e.isIntersecting), { rootMargin: '120px' })
    if (lane.current) io.observe(lane.current)

    let raf = 0
    let last = performance.now()
    const dir = reverse ? 1 : -1
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (st.visible && !document.hidden && st.width > 0) {
        const target = reduced || st.hold || st.drag ? 0 : SPEED
        // Ease toward the target speed: a soft stop and a soft start, never a jump.
        st.v += (target - st.v) * Math.min(1, dt * (target === 0 ? 7 : 2.2))
        if (Math.abs(st.v) < 0.05 && target === 0) st.v = 0
        st.x += dir * st.v * dt
        // A review stopped by a tap or the keyboard glides to the middle of the lane.
        if (Math.abs(st.snap) > 0.3) {
          const step = st.snap * Math.min(1, dt * 7)
          st.x += step
          st.snap -= step
        } else st.snap = 0
        // Keep x in (-width, 0]: the second copy takes over exactly where the first began.
        st.x = ((st.x % st.width) - st.width) % st.width
        if (track.current) track.current.style.transform = `translate3d(${st.x}px,0,0)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
    }
  }, [reverse, reduced])

  const release = useCallback(() => {
    setPinned(false)
    setActive(null)
  }, [])

  // A tap anywhere outside a pinned lane releases it.
  useEffect(() => {
    if (!pinned) return
    const off = (e: PointerEvent) => {
      if (!lane.current?.contains(e.target as Node)) release()
    }
    document.addEventListener('pointerdown', off)
    return () => document.removeEventListener('pointerdown', off)
  }, [pinned, release])

  const keyOf = (r: Review, i: number) => `${r.name}-${i}`
  // Keyboard: the browser must not scroll the lane itself; the review glides in instead.
  const onFocusCapture = (e: FocusEvent) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('[data-review]')
    if (card && e.target.matches(':focus-visible')) centre(card)
  }

  /** Glide a review to the middle of the lane (tap and keyboard; a hovered one stays under the cursor). */
  const centre = (card: HTMLElement | null) => {
    const l = lane.current
    if (!card || !l) return
    const c = card.getBoundingClientRect()
    const b = l.getBoundingClientRect()
    s.current.snap = b.left + b.width / 2 - (c.left + c.width / 2)
  }

  return (
    <div
      ref={lane}
      className="rv2-lane relative min-w-0 cursor-grab touch-pan-y py-3 active:cursor-grabbing"
      onFocus={onFocusCapture}
      onPointerLeave={(e) => e.pointerType === 'mouse' && realHover() && !pinned && setActive(null)}
      onBlur={(e) => !lane.current?.contains(e.relatedTarget as Node) && !pinned && setActive(null)}
      onPointerDown={(e) => {
        if (e.pointerType !== 'mouse') lastTouch = Date.now()
        s.current.drag = { start: e.clientX, last: e.clientX, moved: 0, id: e.pointerId }
      }}
      onPointerMove={(e) => {
        const d = s.current.drag
        if (!d || d.id !== e.pointerId) return
        const dx = e.clientX - d.last
        d.last = e.clientX
        d.moved += Math.abs(dx)
        if (d.moved > 6 && !lane.current?.hasPointerCapture(e.pointerId)) lane.current?.setPointerCapture(e.pointerId)
        s.current.x += dx
      }}
      onPointerUp={(e) => {
        const d = s.current.drag
        s.current.drag = null
        if (!d || d.moved > 6) return
        // A tap (touch or pen): pin the review under the finger, or release it.
        if (e.pointerType === 'mouse') return
        const card = (e.target as HTMLElement).closest<HTMLElement>('[data-review]')
        const k = card?.dataset.key ?? null
        if (pinned && (!k || k === active)) return release()
        if (k) {
          setActive(k)
          setPinned(true)
          centre(card)
        }
      }}
      onPointerCancel={() => (s.current.drag = null)}
    >
      <div ref={track} className="flex w-max will-change-transform" style={{ gap: GAP }}>
        {[0, 1].map((copy) => (
          <div key={copy} ref={copy ? undefined : set} className="flex" style={{ gap: GAP }}>
            {items.map((r, i) => {
              const k = keyOf(r, i)
              return (
                <Card key={k} k={k} r={r} active={active === k} dimmed={active !== null && active !== k} copy={copy === 1} showProduct={showProduct} onActivate={() => !pinned && setActive(k)} />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ReviewMarquee({ productId, variant = 'site', className = '', note }: { productId?: ProductId; variant?: 'site' | 'landing'; className?: string; note?: { title: string; text: string } }) {
  const reviews = productId ? reviewsFor(productId) : allReviews
  const locale = useLocale()
  const t = COPY[locale]
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const set = () => setReduced(mq.matches)
    set()
    mq.addEventListener('change', set)
    return () => mq.removeEventListener('change', set)
  }, [])

  if (!reviews.length) return null
  const { customers, averageRating } = socialProof
  const average = averageRating?.toLocaleString(locale === 'ro' ? 'ro-RO' : 'en-GB', { minimumFractionDigits: 1 })
  const lanes = productId ? [reviews] : [reviews.filter((_, i) => i % 2 === 0), reviews.filter((_, i) => i % 2 === 1)]

  return (
    <section aria-label={t.label} className={`${variant === 'landing' ? 'lp-wrap' : 'wrap'} max-sm:px-0 ${className}`}>
      <div className="rv2 on-dark relative isolate overflow-clip rounded-[32px] bg-dark py-[clamp(48px,7vw,88px)] text-white max-sm:rounded-none">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_12%_0%,rgb(var(--rv-glow,6_182_212)/0.22),transparent_60%),radial-gradient(50%_70%_at_100%_100%,rgb(var(--rv-glow,6_182_212)/0.12),transparent_60%)]" />

        <div className="grid items-end gap-x-10 gap-y-8 px-[clamp(24px,5vw,64px)] lg:grid-cols-[1fr_auto]">
          {customers ? (
            <p className="flex flex-wrap items-end gap-x-5 gap-y-1">
              <span className="rv2-number bg-[linear-gradient(180deg,#ffffff_30%,var(--rv-number,#7fdcec))] bg-clip-text text-[clamp(84px,12vw,156px)] leading-[0.8] font-medium tracking-[-0.065em] text-transparent tabular-nums">
                {customers}+
              </span>
              <span className="pb-[0.35em] text-[clamp(22px,2.6vw,36px)] leading-none tracking-[-0.03em] text-white/85">{t.happy}</span>
            </p>
          ) : null}

          {average && (
            <div className="flex items-center gap-4 justify-self-start rounded-[22px] bg-white/[0.06] lg:mb-2 px-5 py-4 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1)] backdrop-blur-sm">
              <span aria-hidden className="flex -space-x-2">
                {reviews.slice(0, 4).map((r) => (
                  <span key={r.name} className="flex h-10 w-10 items-center justify-center rounded-full bg-dark-3 text-[12px] font-semibold text-white shadow-[0_0_0_2.5px_var(--color-dark),inset_0_0_0_1px_rgb(255_255_255/0.14)]">
                    {initials(r.name)}
                  </span>
                ))}
              </span>
              <span className="flex items-center gap-2.5">
                <span className="text-[34px] leading-none font-semibold tracking-[-0.04em] tabular-nums">{average}</span>
                <span className="flex flex-col gap-1">
                  <Stars value={averageRating!} size={15} />
                  <span className="text-[12.5px] leading-none text-dark-muted">{t.of5}</span>
                </span>
              </span>
            </div>
          )}
        </div>

        {note && (
          <div className="mt-8 flex items-start gap-4 px-[clamp(24px,5vw,64px)]">
            <span aria-hidden className="mt-0.5 flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white/[0.08] text-[#7fdcec] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 21V8l8-5 8 5v13" />
                <path d="M9 21v-6h6v6M12 7v4M10 9h4" />
              </svg>
            </span>
            <p className="max-w-[44em] text-[15.5px] leading-relaxed text-white/75">
              <span className="font-semibold text-white">{note.title}</span> {note.text}
            </p>
          </div>
        )}

        <div className="rv2-lanes mt-[clamp(36px,5vw,56px)] grid grid-cols-[minmax(0,1fr)] gap-2">
          {lanes.map((l, i) => (
            <Lane key={i} items={l} reverse={i === 1} reduced={reduced} showProduct={!productId} />
          ))}
        </div>
        <p className="sr-only">{t.help}</p>
      </div>
    </section>
  )
}
