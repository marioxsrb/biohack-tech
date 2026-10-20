'use client'

/** A horizontal row of cards: swiped on the phone, with arrow buttons on larger screens. */
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { Arrow } from '@/components/ui/icons'

export function useRow() {
  const row = useRef<HTMLUListElement>(null)
  const [edge, setEdge] = useState({ start: true, end: false })
  useEffect(() => {
    const el = row.current
    if (!el) return
    const update = () => setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 })
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  const step = (dir: 1 | -1) => {
    const el = row.current
    const card = el?.querySelector('li')
    if (!el || !card) return
    el.scrollBy({ left: dir * (card.getBoundingClientRect().width + 16), behavior: 'smooth' })
  }
  return { row, edge, step }
}

const arrowBtn =
  'flex h-11 w-11 items-center justify-center rounded-full border border-line bg-paper text-ink transition hover:border-ink disabled:cursor-default disabled:opacity-35 disabled:hover:border-line'

export function RowArrows({ edge, step }: Pick<ReturnType<typeof useRow>, 'edge' | 'step'>) {
  return (
    <div className="flex flex-none gap-2 max-md:hidden">
      <button type="button" onClick={() => step(-1)} disabled={edge.start} aria-label="Înapoi" className={arrowBtn}>
        <Arrow className="h-5 w-5 rotate-180" />
      </button>
      <button type="button" onClick={() => step(1)} disabled={edge.end} aria-label="Mai departe" className={arrowBtn}>
        <Arrow className="h-5 w-5" />
      </button>
    </div>
  )
}

/** The scrolling list itself; bleeds to the page gutter so cards slide in from the edge. */
export function Row({ row, children, className = '' }: { row: ReturnType<typeof useRow>['row']; children: ReactNode; className?: string }) {
  return (
    <ul
      ref={row}
      className={`-mx-[var(--gut)] flex snap-x snap-mandatory scroll-px-[var(--gut)] gap-4 overflow-x-auto px-[var(--gut)] pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {children}
    </ul>
  )
}

/** Card widths: most of the screen on a phone, two-and-a-bit on a tablet, three-and-a-bit on desktop. */
export const rowCard = 'w-[80%] flex-none snap-start sm:w-[calc((100%-16px)/2.15)] lg:w-[calc((100%-32px)/3.15)]'
