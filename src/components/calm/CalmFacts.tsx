'use client'

/**
 * "Știai că?" on the NEUROS Calm product page, under the reviews: nine short facts about the vagus
 * nerve and light, as a row of cards. Each card has a small drawing instead of a photograph, and
 * points to its source in the list under the row.
 */
import { Row, RowArrows, rowCard, useRow } from '@/components/calm/carousel'
import { facts, factSources, type FactVisual } from '@/content/calm-science'
import { External } from '@/components/ui/icons'

const titleClass = 'text-[clamp(30px,3.2vw,46px)] leading-[1.05] tracking-[-0.04em] text-balance'
const sourceNo = (id: string) => factSources.findIndex((s) => s.id === id) + 1

const big = 'font-medium tracking-[-0.05em] tabular-nums leading-none'

function Visual({ kind }: { kind: FactVisual }) {
  switch (kind) {
    case 'vagus':
      return (
        <div className="relative h-full bg-[linear-gradient(160deg,#ecf8fa_0%,#ffffff_70%)]">
          <svg aria-hidden viewBox="0 0 320 180" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
            <path d="M-10 40 C 60 10, 90 120, 150 90 S 250 20, 330 120" fill="none" stroke="#0e7490" strokeOpacity=".22" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" />
          </svg>
          <div className="relative flex h-full flex-col justify-center px-6">
            <span className={`${big} text-[52px] text-ink italic`}>Vagus</span>
            <span className="mt-2 text-[14px] text-cyan-700">lat. „rătăcitor”</span>
          </div>
        </div>
      )
    case 'percent':
      return (
        <div className="flex h-full flex-col justify-center bg-[linear-gradient(160deg,#ecf8fa_0%,#ffffff_70%)] px-6">
          <span className={`${big} text-[56px] text-ink`}>80–90%</span>
          <span className="mt-3 flex items-center gap-2 text-[14px] text-cyan-700">
            corp
            <svg aria-hidden viewBox="0 0 40 10" className="h-2.5 w-10">
              <path d="M0 5h36M31 1l5 4-5 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            creier
          </span>
        </div>
      )
    case 'heart':
      return (
        <div className="flex h-full items-center gap-5 bg-[linear-gradient(160deg,#fdecec_0%,#ffffff_70%)] px-6">
          <div>
            <span className={`${big} block text-[40px] text-muted/70 line-through decoration-2`}>100</span>
            <span className="mt-1 block text-[12px] text-muted">fără frână</span>
          </div>
          <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6 flex-none text-[#d23b3b]">
            <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <span className={`${big} block text-[48px] text-ink`}>60–80</span>
            <span className="mt-1 block text-[12px] text-muted">bătăi pe minut, în liniște</span>
          </div>
        </div>
      )
    case 'breath':
      return (
        <div className="relative flex h-full items-center justify-center overflow-hidden bg-[linear-gradient(160deg,#ecf8fa_0%,#ffffff_70%)]">
          <span aria-hidden className="calm-breathe absolute h-28 w-28 rounded-full bg-cyan-100" />
          <span aria-hidden className="calm-breathe absolute h-20 w-20 rounded-full bg-cyan-700/15" style={{ animationDelay: '-.2s' }} />
          <span className="relative grid text-center text-[15px] font-medium text-cyan-700">
            <span className="calm-breathe-in col-start-1 row-start-1">Inspiră</span>
            <span className="calm-breathe-out col-start-1 row-start-1">Expiră lung</span>
          </span>
        </div>
      )
    case 'night':
      return (
        <div className="relative h-full overflow-hidden bg-[linear-gradient(170deg,#0b1a2e_0%,#152a4a_100%)]">
          {[
            [18, 22],
            [70, 30],
            [82, 62],
            [40, 70],
            [28, 48],
            [60, 16],
          ].map(([x, y]) => (
            <span key={`${x}-${y}`} aria-hidden className="absolute h-[3px] w-[3px] rounded-full bg-white/60" style={{ left: `${x}%`, top: `${y}%` }} />
          ))}
          <svg aria-hidden viewBox="0 0 24 24" className="absolute top-6 right-8 h-12 w-12 text-[#f6e3b4]">
            <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="currentColor" />
          </svg>
          <div className="absolute bottom-5 left-6">
            <span className="text-[13px] text-white/60">Somn profund</span>
            <svg aria-hidden viewBox="0 0 200 30" className="mt-1 h-6 w-48">
              <path d="M0 8 C 30 8, 40 24, 70 24 S 110 24, 130 24 S 170 10, 200 10" fill="none" stroke="#7fdcec" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      )
    case 'nobel':
      return (
        <div className="flex h-full flex-col justify-center bg-[linear-gradient(160deg,#f7f1e3_0%,#ffffff_70%)] px-6">
          <span className={`${big} text-[56px] text-ink`}>1921</span>
          <span className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-[#c9a45c]/15 px-3 py-1 text-[13px] font-semibold text-[#8a6a24]">Premiul Nobel, 1936</span>
        </div>
      )
    case 'budapest':
      return (
        <div className="relative h-full overflow-hidden bg-[linear-gradient(160deg,#fdecec_0%,#ffffff_70%)]">
          <span aria-hidden className="absolute top-8 right-6 h-1 w-40 origin-right -rotate-[18deg] rounded-full bg-gradient-to-l from-[#ef4444] to-transparent" />
          <div className="relative flex h-full flex-col justify-center px-6">
            <span className={`${big} text-[56px] text-ink`}>1967</span>
            <span className="mt-2 text-[14px] text-[#b42f2f]">Budapesta, primul laser „blând”</span>
          </div>
        </div>
      )
    case 'nasa':
      return (
        <div className="relative h-full overflow-hidden bg-[linear-gradient(170deg,#0b1316_0%,#1a2328_100%)] px-6">
          <div className="flex h-full flex-col justify-center">
            <span className={`${big} text-[48px] tracking-[0.02em] !text-white`}>NASA</span>
            <span className="mt-2 text-[14px] text-white/65">LED-uri roșii, pentru plante în spațiu</span>
          </div>
          <span aria-hidden className="absolute top-6 right-6 grid grid-cols-3 gap-1.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i} className="h-2.5 w-2.5 rounded-full bg-[#ef4444] shadow-[0_0_10px_#ef4444]" />
            ))}
          </span>
        </div>
      )
    case 'spectrum':
      return (
        <div className="flex h-full flex-col justify-center bg-white px-6">
          <div className="relative">
            <div className="h-4 rounded-full bg-[linear-gradient(90deg,#7c3aed_0%,#2563eb_13%,#10b981_27%,#facc15_38%,#f97316_46%,#ef4444_56%,#b91c1c_66%,#5b1414_76%,#1f0a0a_86%,#0b0b0b_100%)]" />
            {/* Scale 400–850 nm: 660 → 58%, 810 → 91%. */}
            <Marker at={58} label="660 nm" sub="o vezi" />
            <Marker at={91} label="810 nm" sub="abia" />
          </div>
          <div className="mt-11 flex justify-between text-[11px] text-muted">
            <span>400 nm</span>
            <span>850 nm</span>
          </div>
        </div>
      )
  }
}

function Marker({ at, label, sub }: { at: number; label: string; sub: string }) {
  return (
    <span className="absolute top-0 -translate-x-1/2 text-center" style={{ left: `${at}%` }}>
      <span aria-hidden className="mx-auto block h-7 w-[2px] -translate-y-1.5 rounded bg-ink" />
      <span className="block text-[12px] font-semibold whitespace-nowrap text-ink">{label}</span>
      <span className="block text-[11px] text-muted">{sub}</span>
    </span>
  )
}

/** The source links point into the list below, which starts closed. */
const openSources = () => {
  const d = document.getElementById('surse-stiai-ca') as HTMLDetailsElement | null
  if (d) d.open = true
}

export function CalmFacts() {
  const { row, edge, step } = useRow()
  return (
    <section aria-labelledby="stiai-ca" className="wrap pb-[var(--sec)]">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h2 id="stiai-ca" className={titleClass}>
            Știai că?
          </h2>
          <p className="mt-3 max-w-[30em] text-[17px] leading-relaxed text-muted md:text-[18px]">Câteva lucruri despre nervul vag și despre lumină, pe care puțini le știu.</p>
        </div>
        <RowArrows edge={edge} step={step} />
      </div>

      <Row row={row} className="mt-8 md:mt-10">
        {facts.map((f, i) => (
          <li key={f.title} className={rowCard}>
            <article className="flex h-full flex-col overflow-hidden rounded-[22px] bg-paper">
              <div className="relative h-[190px] flex-none overflow-hidden border-b border-mist-2">
                <Visual kind={f.visual} />
                <span className="absolute bottom-3 right-4 text-[12px] font-semibold text-muted/70 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <h3 className="text-[19px] leading-snug font-medium tracking-[-0.02em] text-ink">{f.title}</h3>
                <p className="mt-2 text-[15.5px] leading-relaxed text-text">{f.text}</p>
                <p className="mt-auto pt-4 text-[12.5px] text-muted">
                  Sursa{' '}
                  {f.sources.map((id, k) => (
                    <a key={id} href={`#sursa-${id}`} onClick={openSources} className="font-semibold text-cyan-700 hover:underline">
                      {k > 0 && ', '}[{sourceNo(id)}]
                    </a>
                  ))}
                </p>
              </div>
            </article>
          </li>
        ))}
      </Row>

      <details id="surse-stiai-ca" className="group mt-6 rounded-[18px] bg-paper px-5 py-4 open:pb-5">
        <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-medium text-ink">
          Surse
          <span aria-hidden className="text-muted transition group-open:rotate-45">+</span>
        </summary>
        <ol className="mt-3 space-y-1.5 text-[14px] leading-relaxed text-text">
          {factSources.map((s, i) => (
            <li key={s.id} id={`sursa-${s.id}`} className="scroll-mt-[calc(var(--nav-h)+24px)]">
              <span className="text-muted tabular-nums">[{i + 1}]</span>{' '}
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline decoration-line underline-offset-2 hover:decoration-ink">
                {s.label}
                <External className="h-3.5 w-3.5" />
              </a>
            </li>
          ))}
        </ol>
      </details>
    </section>
  )
}
