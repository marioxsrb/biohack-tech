'use client'

import { useId, useState } from 'react'
import { Plus } from './icons'

/**
 * Accordion with real buttons: each question is a <button aria-expanded aria-controls> inside a heading,
 * each answer a labelled region. Tab moves between questions; Enter or Space opens and closes one.
 * Answers stay in the HTML (hidden until opened), so they are readable without script and by search.
 */
export function Accordion({ items, headingLevel = 3 }: { items: { q: string; a: string }[]; headingLevel?: 3 | 4 }) {
  const base = useId()
  const [open, setOpen] = useState<number | null>(null)
  const H = headingLevel === 3 ? 'h3' : 'h4'
  return (
    <div className="border-t border-line">
      {items.map((f, i) => {
        const on = open === i
        const btn = `${base}-q${i}`
        const panel = `${base}-a${i}`
        return (
          <div key={f.q} className="border-b border-line">
            <H className="m-0">
              <button
                type="button"
                id={btn}
                aria-expanded={on}
                aria-controls={panel}
                onClick={() => setOpen(on ? null : i)}
                className="flex min-h-16 w-full cursor-pointer items-center justify-between gap-6 py-4 text-left text-[17px] leading-snug font-medium tracking-[-0.012em] text-ink"
              >
                {f.q}
                <span
                  aria-hidden
                  className={`flex h-8 w-8 flex-none items-center justify-center rounded-full transition-[transform,background-color,color] duration-300 ${
                    on ? 'rotate-45 bg-ink text-white' : 'shadow-[inset_0_0_0_1px_var(--color-line)]'
                  }`}
                >
                  <Plus className="h-4 w-4" />
                </span>
              </button>
            </H>
            <div id={panel} role="region" aria-labelledby={btn} hidden={!on}>
              <p className="max-w-[44em] pb-6 text-[16px] leading-relaxed text-text">{f.a}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
