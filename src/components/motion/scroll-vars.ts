'use client'

import { useEffect, type RefObject } from 'react'

/**
 * One passive scroll listener for the whole page. Each registered element gets CSS
 * variables it can use in transforms, filters and colours:
 *
 *   --in    0 → 1 while the element travels from the bottom of the viewport to its top
 *   --pin   0 → 1 across the element's scroll length (for sticky scenes: height − viewport)
 *   --out   0 → 1 while the element's top moves from the viewport top to its own height above it
 *
 * Only transform/opacity/filter/colour consume them, so nothing triggers layout.
 * With prefers-reduced-motion the variables are pinned to their end state.
 */
type Entry = { el: HTMLElement; last: string }
const entries = new Set<Entry>()
let frame = 0
let bound = false

function measure() {
  frame = 0
  const vh = window.innerHeight
  for (const e of entries) {
    const r = e.el.getBoundingClientRect()
    if (r.bottom < -vh || r.top > vh * 2) continue
    const inView = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)))
    const span = r.height - vh
    const pin = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : inView
    const out = Math.min(1, Math.max(0, -r.top / r.height))
    const next = `${inView.toFixed(4)}|${pin.toFixed(4)}|${out.toFixed(4)}`
    if (next === e.last) continue
    e.last = next
    e.el.style.setProperty('--in', inView.toFixed(4))
    e.el.style.setProperty('--pin', pin.toFixed(4))
    e.el.style.setProperty('--out', out.toFixed(4))
  }
}

const schedule = () => {
  if (!frame) frame = requestAnimationFrame(measure)
}

export function useScrollVars(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.setProperty('--in', '0.5')
      el.style.setProperty('--pin', '0.5')
      el.style.setProperty('--out', '0')
      el.dataset.still = ''
      return
    }
    const entry = { el, last: '' }
    entries.add(entry)
    if (!bound) {
      bound = true
      window.addEventListener('scroll', schedule, { passive: true })
      window.addEventListener('resize', schedule)
    }
    schedule()
    return () => {
      entries.delete(entry)
    }
  }, [ref])
}
