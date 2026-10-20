'use client'

/**
 * NEUROS Amber (Romanian), under the reviews: "Știai că?" (facts, each with its source) and "Ce spune știința, pe
 * înțelesul tuturor" (the studies as a row of cards, charts only with figures from the papers). Same layout as
 * the Calm and Focus pages. Copy in content/amber-story.ts.
 */
import { Bars } from '@/components/calm/CalmScience'
import { Row, RowArrows, rowCard, useRow } from '@/components/calm/carousel'
import { External } from '@/components/ui/icons'
import { amberFacts, amberScience, amberStudies, type AmberStudy } from '@/content/amber-story'

const titleClass = 'text-[clamp(30px,3.2vw,46px)] leading-[1.05] tracking-[-0.04em] text-balance'
const warm = 'bg-[linear-gradient(160deg,#fdf3d9_0%,#ffffff_75%)]'
const red = 'bg-[linear-gradient(160deg,#fde6df_0%,#ffffff_75%)]'

export function AmberFacts() {
  const { row, edge, step } = useRow()
  return (
    <section aria-labelledby="stiai-ca-amber" className="wrap pb-[var(--sec)]">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h2 id="stiai-ca-amber" className={titleClass}>
            Știai că?
          </h2>
          <p className="mt-3 max-w-[30em] text-[17px] leading-relaxed text-muted md:text-[18px]">Câteva lucruri despre lumină, seară și somn, pe care puțini le știu.</p>
        </div>
        <RowArrows edge={edge} step={step} />
      </div>
      <Row row={row} className="mt-8 md:mt-10">
        {amberFacts.map((f, i) => (
          <li key={f.title} className={rowCard}>
            <article className="flex h-full flex-col overflow-hidden rounded-[22px] bg-paper">
              <div className={`relative flex h-[170px] flex-none flex-col justify-center border-b border-mist-2 px-6 ${i % 2 ? red : warm}`}>
                <span className="text-[clamp(40px,4vw,54px)] leading-none font-medium tracking-[-0.05em] text-ink tabular-nums">{f.big}</span>
                {f.small && <span className="mt-2 text-[14px] text-[#9a5b14]">{f.small}</span>}
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

/** Drawings for the studies whose point isn't a single number. */
function Visual({ kind }: { kind: NonNullable<AmberStudy['visual']> }) {
  const soft = 'flex h-full flex-col items-center justify-center bg-[linear-gradient(160deg,#fdf6e6_0%,#ffffff_75%)] px-5'
  if (kind === 'spectrum')
    return (
      <div className={soft}>
        <div className="w-full max-w-[240px]">
          {/* The visible spectrum; the yellow lens stops the blue end, the red lens also most of the green. */}
          <div className="h-5 w-full rounded-full bg-[linear-gradient(90deg,#6a3fd1_0%,#2f6fe0_18%,#22a7c8_30%,#3fb34a_45%,#c9d42b_58%,#f4c21b_66%,#f08a1c_78%,#e2492b_90%,#b5221f_100%)]" />
          <div className="relative mt-2 h-8 text-[11px] font-semibold text-muted">
            <span className="amber-sweep absolute top-0 left-0 h-2 rounded-full bg-[#F2C21B]" style={{ ['--to' as string]: '33%' }} />
            <span className="amber-sweep absolute top-3 left-0 h-2 rounded-full bg-[#E2492B]" style={{ ['--to' as string]: '55%' }} />
          </div>
          <p className="text-center text-[12px] text-muted">Galben: oprește albastrul. Roșu: și o parte din verde.</p>
        </div>
      </div>
    )
  if (kind === 'melatonin')
    return (
      <div className={soft}>
        <span aria-hidden className="relative flex h-[84px] w-[84px] items-center justify-center">
          <span className="calm-breathe absolute inset-0 rounded-full bg-[#fde3b0]" />
          <svg viewBox="0 0 24 24" className="relative h-9 w-9 text-[#9a5b14]">
            <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor" />
          </svg>
        </span>
        <p className="mt-2 text-[12px] text-muted">Melatonina, semnalul de noapte al corpului</p>
      </div>
    )
  // clock: the evening hours before sleep
  return (
    <div className={soft}>
      <svg aria-hidden viewBox="0 0 100 100" className="h-[92px] w-[92px]">
        <circle cx="50" cy="50" r="44" fill="#fff" stroke="#e8dcc6" strokeWidth="3" />
        <path d="M50 50 L50 6 A44 44 0 0 1 88.1 28 Z" fill="#F2C21B" opacity=".85" />
        <path d="M50 50 L88.1 28 A44 44 0 0 1 94 50 Z" fill="#E2492B" opacity=".9" />
        <path d="M50 50 L50 22" stroke="#15181A" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M50 50 L68 50" stroke="#15181A" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="50" cy="50" r="3.5" fill="#15181A" />
      </svg>
      <p className="mt-2 text-[12px] text-muted">Ultimele ore ale serii, înainte de somn</p>
    </div>
  )
}

function StudyCard({ s, n }: { s: AmberStudy; n: number }) {
  const tagClass = s.tag === 'Somn' ? 'bg-[#eef0ff] text-[#4f46e5]' : s.tag === 'Ecrane' ? 'bg-cyan-50 text-cyan-700' : 'bg-[#fff4e0] text-[#8a6a24]'
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[22px] bg-paper">
      <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
        <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${tagClass}`}>{s.tag}</span>
        <span className="text-[12px] font-semibold text-muted/70 tabular-nums">Studiul {n}</span>
      </div>
      <h3 className="px-5 pt-3 text-[19px] leading-snug font-medium tracking-[-0.02em] text-ink sm:px-6">{s.title}</h3>
      <div className="mx-5 mt-4 h-[150px] flex-none overflow-hidden rounded-[16px] sm:mx-6">{s.chart ? <Bars chart={s.chart} /> : s.visual ? <Visual kind={s.visual} /> : null}</div>
      <p className="px-5 pt-4 text-[15px] leading-relaxed text-text sm:px-6">{s.text}</p>
      <div className="mt-auto flex items-end justify-between gap-3 px-5 pt-5 pb-5 sm:px-6 sm:pb-6">
        <p className="text-[12.5px] leading-snug text-muted italic">{s.cite}</p>
        <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex flex-none items-center gap-1 rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink transition hover:border-ink">
          Studiul
          <External className="h-3.5 w-3.5" />
        </a>
      </div>
    </article>
  )
}

export function AmberScience() {
  const { row, edge, step } = useRow()
  return (
    <section aria-labelledby="ce-spune-stiinta-amber" className="wrap pb-[var(--sec)]">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h2 id="ce-spune-stiinta-amber" className={`${titleClass} max-w-[15em]`}>
            {amberScience.title}
          </h2>
          <p className="mt-3 max-w-[36em] text-[17px] leading-relaxed text-muted md:text-[18px]">{amberScience.intro}</p>
        </div>
        <RowArrows edge={edge} step={step} />
      </div>
      <Row row={row} className="mt-8 md:mt-10">
        {amberStudies.map((s, i) => (
          <li key={s.title} className={rowCard}>
            <StudyCard s={s} n={i + 1} />
          </li>
        ))}
      </Row>
      <p className="mt-6 max-w-[46em] text-[13.5px] leading-relaxed text-muted">{amberScience.footnote}</p>
    </section>
  )
}
