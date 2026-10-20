'use client'

/** "Știai că?" on the NEUROS Focus page, under the reviews: eleven facts, each with its big figure and its source. */
import { Row, RowArrows, rowCard, useRow } from '@/components/calm/carousel'
import { External } from '@/components/ui/icons'
import { focusFacts } from '@/content/focus-story'

const titleClass = 'text-[clamp(30px,3.2vw,46px)] leading-[1.05] tracking-[-0.04em] text-balance'
// The first facts are about attention drifting today, the last about attention being trained.
const tint = (i: number) =>
  i === 0 || i >= 6 ? 'bg-[linear-gradient(160deg,#ecf8fa_0%,#ffffff_75%)]' : 'bg-[linear-gradient(160deg,#f3f1fb_0%,#ffffff_75%)]'

export function FocusFacts() {
  const { row, edge, step } = useRow()
  return (
    <section aria-labelledby="stiai-ca-focus" className="wrap pb-[var(--sec)]">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h2 id="stiai-ca-focus" className={titleClass}>
            Știai că?
          </h2>
          <p className="mt-3 max-w-[30em] text-[17px] leading-relaxed text-muted md:text-[18px]">Câteva lucruri despre atenție și despre creier, pe care puțini le știu.</p>
        </div>
        <RowArrows edge={edge} step={step} />
      </div>
      <Row row={row} className="mt-8 md:mt-10">
        {focusFacts.map((f, i) => (
          <li key={f.title} className={rowCard}>
            <article className="flex h-full flex-col overflow-hidden rounded-[22px] bg-paper">
              <div className={`relative flex h-[170px] flex-none flex-col justify-center border-b border-mist-2 px-6 ${tint(i)}`}>
                <span className="text-[clamp(40px,4vw,54px)] leading-none font-medium tracking-[-0.05em] text-ink tabular-nums">{f.big}</span>
                {f.small && <span className="mt-2 text-[14px] text-cyan-700">{f.small}</span>}
                <span className="absolute right-4 bottom-3 text-[12px] font-semibold text-muted/70 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <h3 className="text-[19px] leading-snug font-medium tracking-[-0.02em] text-ink">{f.title}</h3>
                <p className="mt-2 text-[15.5px] leading-relaxed text-text">{f.text}</p>
                <a href={f.source.url} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex items-center gap-1 pt-4 text-[12.5px] text-muted underline decoration-line underline-offset-2 hover:text-ink">
                  Sursa: {f.source.label}
                  <External className="h-3 w-3 flex-none" />
                </a>
              </div>
            </article>
          </li>
        ))}
      </Row>
    </section>
  )
}
