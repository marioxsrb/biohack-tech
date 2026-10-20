'use client'

/**
 * "Ce spune știința, pe înțelesul tuturor" on the Romanian NEUROS Focus page, in place of "Cum îți citește
 * atenția" and the old list of studies: what the headset does (five parts beside a photo), then the studies
 * as a row of cards. Charts only show figures from the papers (Bars, shared with the Calm page).
 */
import Image from 'next/image'

import { Bars } from '@/components/calm/CalmScience'
import { Row, RowArrows, rowCard, useRow } from '@/components/calm/carousel'
import { External } from '@/components/ui/icons'
import { focusScience, focusStudies, type FocusStudy } from '@/content/focus-story'
import foto from '@/assets/img/brainlink/pillar-games.webp'

const titleClass = 'text-[clamp(30px,3.2vw,46px)] leading-[1.05] tracking-[-0.04em] text-balance'
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function PartIcon({ k }: { k: (typeof focusScience.how)[number]['key'] }) {
  const c = 'h-5 w-5'
  if (k === 'signals') return <svg aria-hidden viewBox="0 0 24 24" className={c}><path d="M2 12h3l2-5 3 10 3-12 3 10 2-3h4" {...stroke} /></svg>
  if (k === 'headset') return <svg aria-hidden viewBox="0 0 24 24" className={c}><path d="M4 13a8 8 0 0 1 16 0" {...stroke} /><circle cx="8" cy="9" r="1.2" fill="currentColor" /><circle cx="12" cy="7.5" r="1.2" fill="currentColor" /><circle cx="16" cy="9" r="1.2" fill="currentColor" /></svg>
  if (k === 'game') return <svg aria-hidden viewBox="0 0 24 24" className={c}><rect x="3" y="7" width="18" height="11" rx="3" {...stroke} /><path d="M8 11v3M6.5 12.5h3M15.5 12h.01M17.5 13.5h.01" {...stroke} /></svg>
  if (k === 'training') return <svg aria-hidden viewBox="0 0 24 24" className={c}><path d="M4 18 9 12l4 3 7-8" {...stroke} /><path d="M15 7h5v5" {...stroke} /></svg>
  return <svg aria-hidden viewBox="0 0 24 24" className={c}><circle cx="12" cy="6" r="2.2" {...stroke} /><path d="M5 19c2-1 3-4 7-4s5 3 7 4M7 13l5 1 5-1" {...stroke} /></svg>
}

function HowItWorks() {
  return (
    <div className="mt-10 grid overflow-hidden rounded-[28px] bg-paper md:mt-14 md:grid-cols-12">
      <div className="relative aspect-[4/3] md:col-span-5 md:aspect-auto md:min-h-[440px]">
        <Image src={foto} alt="Tânăr pe canapea, cu NEUROS Focus pe frunte, jucând un joc de concentrare pe tabletă" fill placeholder="blur" sizes="(min-width: 768px) 460px, 100vw" className="object-cover md:object-[68%_center]" />
      </div>
      <div className="p-[clamp(24px,4.5vw,56px)] md:col-span-7">
        <h3 className="text-[22px] leading-snug font-medium tracking-[-0.025em] text-ink">{focusScience.howTitle}</h3>
        <ul className="mt-6 divide-y divide-mist-2">
          {focusScience.how.map((p) => (
            <li key={p.key} className="flex gap-4 py-4 first:pt-0 last:pb-0">
              <span className="mt-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
                <PartIcon k={p.key} />
              </span>
              <div>
                <p className="text-[16px] font-semibold text-ink">{p.label}</p>
                <p className="mt-1 text-[15.5px] leading-relaxed text-text">{p.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Small drawings for the studies whose point isn't a single number. */
function Visual({ kind }: { kind: NonNullable<FocusStudy['visual']> }) {
  const soft = 'flex h-full flex-col items-center justify-center bg-[linear-gradient(160deg,#ecf8fa_0%,#ffffff_75%)] px-5'
  if (kind === 'game')
    return (
      <div className={soft}>
        <div className="relative h-[92px] w-full max-w-[220px] overflow-hidden rounded-[12px] bg-[linear-gradient(180deg,#bfe7ef_0%,#e9f7f1_100%)]">
          <svg aria-hidden viewBox="0 0 220 92" className="absolute inset-0 h-full w-full">
            <path d="M0 80 C 40 60, 70 76, 110 62 S 180 50, 220 58 L220 92 L0 92Z" fill="#7cc4a4" />
          </svg>
          <span className="focus-rise absolute left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-cyan-700 shadow-[0_0_14px_rgba(14,116,144,0.6)]" />
        </div>
        <p className="mt-2 text-[12px] text-muted">Mingea urcă doar când copilul e atent</p>
      </div>
    )
  if (kind === 'motivation')
    return (
      <div className={soft}>
        <div className="flex items-end gap-1.5">
          {[30, 42, 38, 54, 62, 70, 84].map((h, i) => (
            <span key={i} className="w-5 rounded-t-[5px] bg-[#f5b544]" style={{ height: `${h}px`, opacity: 0.45 + i * 0.08 }} />
          ))}
        </div>
        <p className="mt-2 text-[12px] text-muted">33 de studii despre antrenamentul sub formă de joc</p>
      </div>
    )
  if (kind === 'adult' || kind === 'realtime')
    return (
      <div className={soft}>
        <svg aria-hidden viewBox="0 0 220 70" className="w-full max-w-[230px] text-cyan-700">
          {/* attention line: wobbly at first, steadier after training */}
          <path d="M0 35 C 10 10, 20 60, 30 30 S 50 5, 60 50 S 80 20, 95 38 C 110 34, 125 37, 140 35 S 175 34, 220 35" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="100" y1="4" x2="100" y2="66" stroke="#dce3e6" strokeWidth="1.5" strokeDasharray="3 4" />
        </svg>
        <p className="mt-2 text-[12px] text-muted">{kind === 'adult' ? 'Înainte și după antrenament: atenția mai stabilă' : 'Vezi pe ecran când atenția începe să fugă'}</p>
      </div>
    )
  if (kind === 'meditation')
    return (
      <div className={soft}>
        <span aria-hidden className="relative flex h-[84px] w-[84px] items-center justify-center">
          <span className="calm-breathe absolute inset-0 rounded-full bg-cyan-100" />
          <svg viewBox="0 0 24 24" className="relative h-9 w-9 text-cyan-700">
            <path d="M9 18V6l10-2v12" {...stroke} />
            <circle cx="7" cy="18" r="2" {...stroke} />
            <circle cx="17" cy="16" r="2" {...stroke} />
          </svg>
        </span>
        <p className="mt-2 text-[12px] text-muted">Feedback prin sunet, în timp ce meditezi</p>
      </div>
    )
  if (kind === 'signals')
    return (
      <div className={soft}>
        <svg aria-hidden viewBox="0 0 220 70" className="w-full max-w-[230px]">
          <path d="M0 35 C 12 15, 24 55, 36 35 S 60 15, 72 35 S 96 55, 108 35 S 132 15, 144 35 S 168 55, 180 35 S 204 15, 220 35" fill="none" stroke="#0e7490" strokeWidth="2.5" />
          <path d="M0 37 C 12 18, 24 57, 36 37 S 60 18, 72 37 S 96 56, 108 37 S 132 18, 144 37 S 168 56, 180 37 S 204 18, 220 37" fill="none" stroke="#f5b544" strokeWidth="2" strokeDasharray="4 4" />
        </svg>
        <p className="mt-2 text-[12px] text-muted">Casca de acasă și aparatul medical, suprapuse</p>
      </div>
    )
  // heart
  return (
    <div className={soft}>
      <svg aria-hidden viewBox="0 0 220 60" className="w-full max-w-[230px] text-[#c0392b]">
        <path d="M0 32h40l8-20 10 40 8-28 6 8h40l8-20 10 40 8-28 6 8h76" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <p className="mt-2 text-[12px] text-muted">24 de studii despre ritmul inimii și stres</p>
    </div>
  )
}

function StudyCard({ s, n }: { s: FocusStudy; n: number }) {
  const tagClass = s.tag === 'Copii' ? 'bg-[#fff4e0] text-[#8a6a24]' : s.tag === 'Adulți' ? 'bg-cyan-50 text-cyan-700' : 'bg-[#eef0ff] text-[#4f46e5]'
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

export function FocusScience() {
  const { row, edge, step } = useRow()
  return (
    <section aria-labelledby="ce-spune-stiinta-focus" className="wrap pb-[var(--sec)]">
      <h2 id="ce-spune-stiinta-focus" className={`${titleClass} max-w-[15em]`}>
        {focusScience.title}
      </h2>
      <p className="mt-3 max-w-[36em] text-[17px] leading-relaxed text-muted md:text-[18px]">{focusScience.intro}</p>

      <HowItWorks />

      <div className="mt-12 flex items-end justify-between gap-6 md:mt-14">
        <h3 className="text-[clamp(24px,2.4vw,32px)] leading-tight tracking-[-0.03em] text-ink">{focusScience.studiesTitle}</h3>
        <RowArrows edge={edge} step={step} />
      </div>
      <Row row={row} className="mt-6 md:mt-8">
        {focusStudies.map((s, i) => (
          <li key={s.title} className={rowCard}>
            <StudyCard s={s} n={i + 1} />
          </li>
        ))}
      </Row>
      <p className="mt-6 max-w-[46em] text-[13.5px] leading-relaxed text-muted">{focusScience.footnote}</p>
    </section>
  )
}
