'use client'

import { useEffect, type RefObject } from 'react'

/**
 * One passive scroll listener for the whole page. Each registered element gets CSS
 * variables that are pure functions of scroll position (no easing, no inertia), so the
 * composition follows the user's scroll exactly, at any speed:
 *
 *   --in    0 → 1 while the element travels from the bottom of the viewport to its top
 *   --pin   0 → 1 across the element's scroll length (sticky scenes: height − viewport)
 *
 * An element can also declare `data-dark="from,to"` (a --pin range). Inside that range it
 * gets data-theme="dark", outside it "light"; the header reads this to pick its colours.
 *
 * `data-states="hero:0-0.17 words:0.26-0.53"` works the same way for any named state: the
 * element gets data-hero, data-words… while --pin is inside the range. Scenes use this to
 * make only the visible layer focusable and clickable.
 *
 * Only transform, opacity and colour consume these variables. With reduced motion the
 * variables still update (so fades still follow scroll), and CSS drops the transforms.
 */
type Entry = { el: HTMLElement; last: string; dark?: [number, number]; states: [string, number, number][] }
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
    const next = `${inView.toFixed(4)}|${pin.toFixed(4)}`
    if (next === e.last) continue
    e.last = next
    e.el.style.setProperty('--in', inView.toFixed(4))
    e.el.style.setProperty('--pin', pin.toFixed(4))
    if (e.dark) {
      const theme = pin >= e.dark[0] && pin <= e.dark[1] ? 'dark' : 'light'
      if (e.el.dataset.theme !== theme) e.el.dataset.theme = theme
    }
    for (const [name, a, b] of e.states) {
      const on = pin >= a && pin <= b
      if (on !== name in e.el.dataset) {
        if (on) e.el.dataset[name] = ''
        else delete e.el.dataset[name]
      }
    }
  }
}

export const scheduleScrollVars = () => {
  if (!frame) frame = requestAnimationFrame(measure)
}

export function useScrollVars(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const range = el.dataset.dark?.split(',').map(Number) as [number, number] | undefined
    const states = (el.dataset.states ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map((d) => {
        const [name, r] = d.split(':')
        const [a, b] = r.split('-').map(Number)
        return [name, a, b] as [string, number, number]
      })
    const entry: Entry = { el, last: '', dark: range, states }
    entries.add(entry)
    if (!bound) {
      bound = true
      window.addEventListener('scroll', scheduleScrollVars, { passive: true })
      window.addEventListener('resize', scheduleScrollVars)
    }
    scheduleScrollVars()
    return () => {
      entries.delete(entry)
    }
  }, [ref])
}
