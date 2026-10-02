/**
 * The plain building blocks of the landings and their presentation pages: theme variables, section
 * typography, steps, specifications, the product FAQ. Server-only markup with no client code, so a
 * page built from these ships no JavaScript of its own.
 */
import type { ReactNode } from 'react'
import type { ProductId } from '@/content/catalog'
import { testimonials } from '@/content/home'
import type { Landing } from '@/content/landings'

/** True for dark page backgrounds (relative luminance of the hex colour below 0.2). */
export function isDark(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.2
}

export function themeVars(t: Landing['theme']) {
  return {
    '--lp-bg': t.bg,
    '--lp-ink': t.ink,
    '--lp-muted': t.muted,
    '--lp-panel': t.panel,
    '--lp-line': t.line,
    '--lp-accent': t.accent,
  } as React.CSSProperties
}

export function Kicker({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-[13px] font-semibold tracking-[0.14em] text-[var(--lp-accent)] uppercase ${className}`}>{children}</p>
}

export function Title({ id, children, className = '' }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <h2 id={id} className={`text-[clamp(32px,3.8vw,52px)] leading-[1.02] tracking-[-0.04em] text-[var(--lp-ink)] ${className}`}>
      {children}
    </h2>
  )
}

export function Lead({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-[17.5px] leading-relaxed ${className}`}>{children}</p>
}

const COLS: Record<number, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
}

/** Numbered steps. `tone` lets a step list sit on a light or dark surface inside any theme. */
export function Steps({ items, className = '' }: { items: { title: string; text?: string }[]; className?: string }) {
  return (
    <ol className={`grid gap-8 ${COLS[items.length] ?? 'md:grid-cols-3'} ${className}`}>
      {items.map((s, i) => (
        <li key={s.title} className="border-t border-current/15 pt-5">
          <span aria-hidden className="block text-[44px] leading-none font-medium tracking-[-0.04em] tabular-nums opacity-40">
            {i + 1}
          </span>
          <span className="mt-4 block text-[20px] leading-snug font-medium tracking-[-0.015em]">{s.title}</span>
          {s.text && <span className="mt-1.5 block text-[16px] leading-relaxed opacity-75">{s.text}</span>}
        </li>
      ))}
    </ol>
  )
}

/** Label / value rows. Only verified values; unknown ones are simply not listed. */
export function Specs({ rows, className = '' }: { rows: [string, string][]; className?: string }) {
  return (
    <dl className={`divide-y divide-[var(--lp-line)] border-y border-[var(--lp-line)] ${className}`}>
      {rows.map(([k, v]) => (
        <div key={k} className="grid gap-1 py-4 sm:grid-cols-[200px_1fr] sm:gap-6">
          <dt className="text-[15px] text-[var(--lp-muted)]">{k}</dt>
          <dd className="text-[16px] text-[var(--lp-ink)]">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function LandingFaq({ items, id = 'intrebari' }: { items: { q: string; a: string }[]; id?: string }) {
  return (
    <section aria-labelledby={id} className="lp-wrap py-[var(--sec)]">
      <div className="grid gap-y-6 lg:grid-cols-12 lg:gap-x-12">
        <div className="lg:col-span-4">
          <Title id={id}>Întrebări frecvente</Title>
          <Lead className="mt-3 max-w-[20em] text-[var(--lp-muted)]">Ce ne întreabă oamenii despre acest produs.</Lead>
        </div>
        <div className="border-t border-[var(--lp-line)] lg:col-span-8">
          {items.map((f) => (
            <details key={f.q} className="group border-b border-[var(--lp-line)]">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-4 text-[18px] leading-snug font-medium tracking-[-0.012em] [&::-webkit-details-marker]:hidden">
                {f.q}
                <span
                  aria-hidden
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[20px] leading-none text-[var(--lp-accent)] shadow-[inset_0_0_0_1px_var(--lp-line)] transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="max-w-[42em] pb-6 text-[16.5px] leading-relaxed text-[var(--lp-muted)]">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Verified customer words for this product, when there are some. Nothing is shown otherwise. */
export function Testimonials({ productId }: { productId: ProductId }) {
  const list = testimonials.filter((t) => t.productId === productId)
  if (!list.length) return null
  return (
    <section aria-label="Ce spun clienții" className="lp-wrap pb-[var(--sec)]">
      <ul className="grid gap-6 md:grid-cols-3">
        {list.map((t) => (
          <li key={t.quote}>
            <blockquote className="text-[18px] leading-relaxed">„{t.quote}”</blockquote>
            <p className="mt-3 text-[14.5px] text-[var(--lp-muted)]">{t.name}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
