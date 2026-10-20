'use client'

/**
 * "Ce spune știința, pe înțelesul tuturor" on the Romanian NEUROS Calm page, in place of
 * "Cum susține calmul": what the device does (five parts beside the vagus nerve drawing), then the
 * studies as a row of cards. Charts only show figures taken from the papers; where a study's point
 * isn't a number, the card has a small drawing (the depth one is labelled as a diagram).
 */
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

import { Row, RowArrows, rowCard, useRow } from '@/components/calm/carousel'
import { science, studies, type Chart, type Study } from '@/content/calm-science'
import { External } from '@/components/ui/icons'
import activ from '@/assets/img/balance-wave/dispozitiv-activ.webp'
import nervVag from '@/assets/img/balance-wave/pillar-nerv-vag.webp'

const titleClass = 'text-[clamp(30px,3.2vw,46px)] leading-[1.05] tracking-[-0.04em] text-balance'
const ro = (n: number) => n.toLocaleString('ro-RO', { maximumFractionDigits: 1 })

/** True once the element has scrolled into view (for the bars to grow). */
function useSeen<T extends Element>() {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        setSeen(true)
        io.disconnect()
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return { ref, seen }
}

// ── How it works ───────────────────────────────────────────────────────────────

function PartIcon({ k }: { k: (typeof science.how)[number]['key'] }) {
  const c = 'h-5 w-5'
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (k === 'nerve')
    return (
      <svg aria-hidden viewBox="0 0 24 24" className={c}>
        <path d="M12 3v4c0 3-4 3-4 7s4 3 4 7" {...stroke} />
        <path d="M12 9c2 0 3-1 4-2M10 14c-2 0-3 1-4 2" {...stroke} />
      </svg>
    )
  if (k === 'ir')
    return (
      <svg aria-hidden viewBox="0 0 24 24" className={c}>
        <path d="M4 12h12M12 7l5 5-5 5" {...stroke} />
        <path d="M20 5v14" {...stroke} strokeDasharray="2 3" />
      </svg>
    )
  if (k === 'red')
    return (
      <svg aria-hidden viewBox="0 0 24 24" className={c}>
        <circle cx="12" cy="12" r="4" {...stroke} />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" {...stroke} />
      </svg>
    )
  if (k === 'rhythm')
    return (
      <svg aria-hidden viewBox="0 0 24 24" className={c}>
        <path d="M2 12h3l2-5 3 10 3-12 3 10 2-3h4" {...stroke} />
      </svg>
    )
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={c}>
      <rect x="5" y="3" width="14" height="18" rx="2" {...stroke} />
      <path d="M9 8h6M9 12h6M9 16h3" {...stroke} />
    </svg>
  )
}

function HowItWorks() {
  return (
    <div className="mt-10 grid overflow-hidden rounded-[28px] bg-paper md:mt-14 md:grid-cols-12">
      <div className="relative aspect-[4/3] md:col-span-5 md:aspect-auto md:min-h-[440px]">
        <Image src={nervVag} alt="Ilustrație: nervul vag pornește din creier și ajunge la inimă, plămâni și stomac" fill placeholder="blur" sizes="(min-width: 768px) 460px, 100vw" className="object-cover" />
      </div>
      <div className="p-[clamp(24px,4.5vw,56px)] md:col-span-7">
        <h3 className="text-[22px] leading-snug font-medium tracking-[-0.025em] text-ink">{science.howTitle}</h3>
        <ul className="mt-6 divide-y divide-mist-2">
          {science.how.map((p) => (
            <li key={p.key} className="flex gap-4 py-4 first:pt-0 last:pb-0">
              <span className={`mt-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-full ${p.key === 'red' || p.key === 'ir' ? 'bg-[#fdecec] text-[#c0392b]' : 'bg-cyan-50 text-cyan-700'}`}>
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

// ── Study cards ────────────────────────────────────────────────────────────────

export function Bars({ chart }: { chart: Chart }) {
  const { ref, seen } = useSeen<HTMLDivElement>()
  const max = Math.max(...chart.bars.map((b) => b.value))
  return (
    <div ref={ref} className="flex h-full flex-col justify-center bg-mist/60 px-5">
      <p className="text-[12.5px] leading-snug text-muted">
        {chart.caption}
        {chart.lowerIsBetter && <span className="text-muted/80"> · mai puțin e mai bine</span>}
      </p>
      <div className="mt-3 space-y-2.5">
        {chart.bars.map((b) => (
          <div key={b.label}>
            <div className="flex items-baseline justify-between text-[13px]">
              <span className={b.highlight ? 'font-semibold text-ink' : 'text-text'}>{b.label}</span>
              <span className={`tabular-nums ${b.highlight ? 'font-semibold text-ink' : 'text-muted'}`}>
                {ro(b.value)}
                {chart.unit && ` ${chart.unit}`}
              </span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-mist-2">
              <div
                className={`h-full rounded-full transition-[width] duration-1000 ease-[var(--ease-brand)] ${b.highlight ? 'bg-cyan-700' : 'bg-muted/45'}`}
                style={{ width: seen ? `${(b.value / max) * 100}%` : '0%' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StudyVisual({ kind }: { kind: NonNullable<Study['visual']> }) {
  if (kind === 'hrv')
    return (
      <div className="flex h-full flex-col justify-center bg-[linear-gradient(160deg,#ecf8fa_0%,#ffffff_75%)] px-5">
        <svg aria-hidden viewBox="0 0 300 70" className="h-16 w-full text-cyan-700">
          <path
            d="M0 40h30l6-22 6 40 6-18h52l6-22 6 40 6-18h34l6-22 6 40 6-18h62l6-22 6 40 6-18h22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
        <p className="mt-2 text-[12.5px] text-muted">HRV: cât variază pauza dintre două bătăi</p>
      </div>
    )
  if (kind === 'mito')
    return (
      <div className="relative flex h-full items-center justify-center overflow-hidden bg-[linear-gradient(160deg,#fdecec_0%,#ffffff_75%)]">
        <span aria-hidden className="absolute top-4 left-4 h-1 w-24 rotate-[24deg] rounded-full bg-gradient-to-r from-transparent to-[#ef4444]" />
        <span aria-hidden className="absolute top-10 left-2 h-1 w-24 rotate-[24deg] rounded-full bg-gradient-to-r from-transparent to-[#ef4444]/70" />
        <svg aria-hidden viewBox="0 0 160 80" className="relative h-20 w-40">
          <rect x="4" y="8" width="152" height="64" rx="32" fill="#fff" stroke="#c0392b" strokeWidth="2.5" />
          <path d="M24 40c8-18 14 18 22 0s14 18 22 0 14 18 22 0 14 18 22 0 14 18 22 0" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="absolute right-4 bottom-3 text-[12px] text-muted">mitocondrie</span>
      </div>
    )
  if (kind === 'moon')
    return (
      <div className="relative h-full overflow-hidden bg-[linear-gradient(170deg,#0b1a2e_0%,#2a1620_100%)]">
        <span aria-hidden className="absolute -bottom-10 left-1/2 h-32 w-56 -translate-x-1/2 rounded-full bg-[#ef4444]/35 blur-2xl" />
        <svg aria-hidden viewBox="0 0 24 24" className="absolute top-5 right-6 h-10 w-10 text-[#f6e3b4]">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="currentColor" />
        </svg>
        <p className="absolute bottom-4 left-5 text-[13px] text-white/75">30 de minute, în fiecare seară</p>
      </div>
    )
  if (kind === 'collar')
    return (
      <div className="relative flex h-full items-center justify-center overflow-hidden bg-[radial-gradient(60%_70%_at_50%_60%,#fde3e1_0%,#ffffff_100%)]">
        <Image src={activ} alt="" sizes="160px" className="relative w-[46%] max-w-[170px] drop-shadow-[0_16px_24px_rgba(11,19,22,0.18)]" />
        <span className="absolute bottom-3 left-5 text-[12px] text-muted">Un colier cu lumină, purtat la gât</span>
      </div>
    )
  // depth
  return (
    <div className="flex h-full flex-col justify-center bg-white px-5">
      <div className="relative h-[86px] overflow-hidden rounded-[12px]">
        <div className="absolute inset-y-0 left-0 w-[22%] bg-[#f6d9c9]" />
        <div className="absolute inset-y-0 left-[22%] w-[30%] bg-[#f0c4b4]" />
        <div className="absolute inset-y-0 left-[52%] right-0 bg-[#e8b0a3]" />
        <div className="absolute top-[24%] left-0 flex items-center">
          <span className="h-[3px] w-[38%] min-w-[90px] rounded-full bg-[#ef4444]" />
        </div>
        <div className="absolute top-[64%] left-0 flex w-full items-center">
          <span className="h-[3px] w-[82%] rounded-full bg-[#7f1d1d]" />
        </div>
        <span className="absolute top-[6%] left-[40%] text-[11.5px] font-semibold text-[#b42f2f]">660 nm</span>
        <span className="absolute top-[70%] left-[83%] text-[11.5px] font-semibold text-[#7f1d1d]">808 nm</span>
      </div>
      <p className="mt-2 text-[12px] text-muted">Schemă, nu la scară: piele, țesut, mai adânc</p>
    </div>
  )
}

function StudyCard({ s, n }: { s: Study; n: number }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[22px] bg-paper">
      <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
        <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${s.tag === 'Nervul vag' ? 'bg-cyan-50 text-cyan-700' : s.tag === 'Ritmul' ? 'bg-[#eef0ff] text-[#4f46e5]' : 'bg-[#fdecec] text-[#b42f2f]'}`}>{s.tag}</span>
        {s.upcoming ? <span className="rounded-full bg-mist px-2.5 py-1 text-[12px] font-semibold text-muted">În pregătire</span> : <span className="text-[12px] font-semibold text-muted/70 tabular-nums">Studiul {n}</span>}
      </div>
      <h3 className="px-5 pt-3 text-[19px] leading-snug font-medium tracking-[-0.02em] text-ink sm:px-6">{s.title}</h3>
      <div className="mx-5 mt-4 h-[150px] flex-none overflow-hidden rounded-[16px] sm:mx-6">{s.chart ? <Bars chart={s.chart} /> : s.visual ? <StudyVisual kind={s.visual} /> : null}</div>
      <p className="px-5 pt-4 text-[15px] leading-relaxed text-text sm:px-6">{s.text}</p>
      <div className="mt-auto flex items-end justify-between gap-3 px-5 pt-5 pb-5 sm:px-6 sm:pb-6">
        <p className="text-[12.5px] leading-snug text-muted italic">{s.cite}</p>
        <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex flex-none items-center gap-1 rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink transition hover:border-ink">
          {s.upcoming ? 'Detalii' : 'Studiul'}
          <External className="h-3.5 w-3.5" />
        </a>
      </div>
    </article>
  )
}

export function CalmScience() {
  const { row, edge, step } = useRow()
  // "Studiul 1…8": the upcoming trial at the end is not numbered.
  const numbers = studies.map((s, i) => studies.slice(0, i + 1).filter((x) => !x.upcoming).length)
  return (
    <section aria-labelledby="ce-spune-stiinta" className="wrap pb-[var(--sec)]">
      <h2 id="ce-spune-stiinta" className={`${titleClass} max-w-[15em]`}>
        {science.title}
      </h2>
      <p className="mt-3 max-w-[34em] text-[17px] leading-relaxed text-muted md:text-[18px]">{science.intro}</p>

      <HowItWorks />

      <div className="mt-12 flex items-end justify-between gap-6 md:mt-14">
        <h3 className="text-[clamp(24px,2.4vw,32px)] leading-tight tracking-[-0.03em] text-ink">{science.studiesTitle}</h3>
        <RowArrows edge={edge} step={step} />
      </div>
      <Row row={row} className="mt-6 md:mt-8">
        {studies.map((s, i) => (
          <li key={s.title} className={rowCard}>
            <StudyCard s={s} n={numbers[i]} />
          </li>
        ))}
      </Row>
      <p className="mt-6 max-w-[46em] text-[13.5px] leading-relaxed text-muted">
        Studiile privesc metodele pe care se bazează NEUROS Calm: stimularea nervului vag, lumina roșie și infraroșie, ritmul SMR. NEUROS Calm este un produs de wellness și nu înlocuiește un tratament medical.
      </p>
    </section>
  )
}
