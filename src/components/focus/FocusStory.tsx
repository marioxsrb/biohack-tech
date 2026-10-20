'use client'

/**
 * NEUROS Focus product page (Romanian), above the reviews: when attention drifts and the same day with
 * the headset (both with the "Pentru copilul tău" / "Pentru tine" tabs, shared), how it's used, and when.
 * Rows of cards like the Calm page, so the page stays short. Copy in content/focus-story.ts.
 */
import Image from 'next/image'
import { useState, type ReactNode } from 'react'

import { Row, RowArrows, rowCard, useRow } from '@/components/calm/carousel'
import { Battery } from '@/components/ui/icons'
import casca from '@/assets/img/brainlink/casca-studio.webp'
import { AUDIENCES, drift, howTo, sameDay, whenToUse, type Audience, type Moment } from '@/content/focus-story'

const titleClass = 'text-[clamp(30px,3.2vw,46px)] leading-[1.05] tracking-[-0.04em] text-balance'

function Tabs({ value, onChange }: { value: Audience; onChange: (a: Audience) => void }) {
  return (
    <div role="tablist" className="mt-5 inline-flex rounded-full bg-mist-2 p-1">
      {AUDIENCES.map((a) => (
        <button
          key={a.id}
          role="tab"
          type="button"
          aria-selected={value === a.id}
          onClick={() => onChange(a.id)}
          className={`rounded-full px-4 py-2 text-[14.5px] font-semibold transition ${value === a.id ? 'bg-paper text-ink shadow-[0_2px_8px_rgba(11,19,22,0.08)]' : 'text-muted hover:text-ink'}`}
        >
          {a.label}
        </button>
      ))}
    </div>
  )
}

function Head({ id, title, intro, row, children }: { id: string; title: string; intro?: string; row: ReturnType<typeof useRow>; children?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div>
        <h2 id={id} className={`${titleClass} max-w-[15em]`}>
          {title}
        </h2>
        {intro && <p className="mt-3 max-w-[30em] text-[17px] leading-relaxed text-muted md:text-[18px]">{intro}</p>}
        {children}
      </div>
      <RowArrows edge={row.edge} step={row.step} />
    </div>
  )
}

// ── 2 ──
function Drift({ who, setWho }: { who: Audience; setWho: (a: Audience) => void }) {
  const row = useRow()
  return (
    <section aria-labelledby="atentia-fuge" className="pt-10 md:pt-14">
      <Head id="atentia-fuge" title={drift.title} intro={drift.intro} row={row}>
        <Tabs value={who} onChange={setWho} />
      </Head>
      <Row row={row.row} className="mt-6 md:mt-8">
        {drift.cards[who].map((c, i) => (
          <li key={c.title} className={rowCard}>
            <article className="flex h-full flex-col rounded-[22px] bg-paper p-5 sm:p-6">
              <span className="text-[13px] font-semibold tabular-nums text-cyan-700">{i + 1}</span>
              <h3 className="mt-2 text-[18px] leading-snug font-medium tracking-[-0.02em] text-ink">{c.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-text">{c.text}</p>
            </article>
          </li>
        ))}
      </Row>
      <p className="mt-5 max-w-[44em] text-[15px] leading-relaxed text-muted">
        {drift.footnote}{' '}
        <a href={drift.footnoteSource.url} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-2 hover:decoration-ink">
          {drift.footnoteSource.label}
        </a>
      </p>
    </section>
  )
}

/** Moments without a photograph get a small drawing in the colours of that part of the day. */
function Drawing({ kind }: { kind: NonNullable<Moment['drawing']> }) {
  if (kind === 'chart')
    return (
      <div className="flex aspect-[4/3] items-end justify-center gap-2.5 bg-[linear-gradient(160deg,#ecf8fa_0%,#ffffff_75%)] px-10 pb-10">
        {[28, 36, 34, 48, 58, 66, 78].map((h, i) => (
          <span key={i} className={`w-full rounded-t-[6px] ${i === 6 ? 'bg-cyan-700' : 'bg-cyan-700/35'}`} style={{ height: `${h}%` }} />
        ))}
      </div>
    )
  if (kind === 'school')
    return (
      <div className="flex aspect-[4/3] items-center justify-center bg-[linear-gradient(160deg,#f7f1e3_0%,#ffffff_75%)]">
        <svg aria-hidden viewBox="0 0 120 80" className="w-1/2 text-[#8a6a24]">
          <rect x="10" y="12" width="100" height="60" rx="6" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M26 34h40M26 46h56M26 58h30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M84 30l6 6 12-12" fill="none" stroke="#1f9d55" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    )
  // dinner / evening: warm light
  return (
    <div className="flex aspect-[4/3] items-center justify-center bg-[linear-gradient(170deg,#f6e6d0_0%,#f4efe6_55%,#efe7dc_100%)]">
      <span aria-hidden className="h-28 w-28 rounded-full bg-[radial-gradient(circle,#f3d2a4_0%,rgba(243,210,164,0)_72%)]" />
    </div>
  )
}

// ── 3 ──
function SameDay({ who, setWho }: { who: Audience; setWho: (a: Audience) => void }) {
  const row = useRow()
  return (
    <section aria-labelledby="aceeasi-zi" className="pt-12 md:pt-16">
      <Head id="aceeasi-zi" title={sameDay.title} intro={sameDay.intro} row={row}>
        <Tabs value={who} onChange={setWho} />
      </Head>
      <Row row={row.row} className="mt-6 md:mt-8">
        {sameDay.moments[who].map((m: Moment, i) => (
          <li key={m.when} className={rowCard}>
            <article className="flex h-full flex-col overflow-hidden rounded-[22px] bg-paper">
              {m.image ? (
                <div className="relative aspect-[4/3] overflow-hidden bg-mist">
                  <Image src={m.image} alt={m.alt ?? ''} fill placeholder="blur" sizes="(min-width: 1024px) 360px, (min-width: 640px) 46vw, 80vw" className="object-cover" />
                </div>
              ) : (
                m.drawing && <Drawing kind={m.drawing} />
              )}
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <p className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.01em] text-cyan-700">
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-cyan-50 px-1.5 text-[12px] tabular-nums">{i + 1}</span>
                  {m.when}
                </p>
                <p className="mt-2 text-[15.5px] leading-relaxed text-text">{m.text}</p>
              </div>
            </article>
          </li>
        ))}
      </Row>
      <p className="mt-5 max-w-[40em] text-[15px] leading-relaxed text-muted">{sameDay.footnote}</p>
    </section>
  )
}

// ── 4 ──
function HowTo() {
  return (
    <section aria-labelledby="cum-o-folosesti" className="pt-12 md:pt-16">
      <div className="grid overflow-hidden rounded-[28px] bg-paper md:grid-cols-12">
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[radial-gradient(60%_55%_at_50%_55%,#e3f4f8_0%,#f3fafb_55%,#ffffff_100%)] md:col-span-5 md:aspect-auto md:min-h-[400px]">
          <Image src={casca} alt="Casca NEUROS Focus" placeholder="blur" sizes="(min-width: 768px) 420px, 80vw" className="relative w-[78%] max-w-[400px] mix-blend-multiply" />
        </div>
        <div className="p-[clamp(24px,4.5vw,56px)] md:col-span-7">
          <h2 id="cum-o-folosesti" className={`${titleClass} max-w-[12em]`}>
            {howTo.title}
          </h2>
          <ol className="relative mt-8 space-y-7 md:mt-10">
            <span aria-hidden className="absolute top-3 bottom-3 left-[17px] w-px bg-line" />
            {howTo.steps.map((s, i) => (
              <li key={s.lead} className="relative flex gap-5">
                <span aria-hidden className="relative flex h-[35px] w-[35px] flex-none items-center justify-center rounded-full border border-cyan-100 bg-cyan-50 text-[15px] font-semibold text-cyan-700 tabular-nums">
                  {i + 1}
                </span>
                <div className="pt-[5px]">
                  <h3 className="text-[19px] leading-snug font-medium tracking-[-0.02em] text-ink">{s.lead}</h3>
                  <p className="mt-1.5 text-[16px] leading-relaxed text-text">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-9 flex items-start gap-3.5 rounded-[18px] bg-mist px-5 py-4 text-[15.5px] leading-relaxed text-text">
            <Battery className="mt-0.5 h-6 w-6 flex-none text-cyan-700" />
            {howTo.note}
          </p>
        </div>
      </div>
    </section>
  )
}

// ── 5 ──
function WhenToUse({ pairCta }: { pairCta?: ReactNode }) {
  const row = useRow()
  const f = whenToUse.family
  return (
    <section aria-labelledby="cand-o-folosesti" className="pt-12 md:pt-16">
      <Head id="cand-o-folosesti" title={whenToUse.title} intro={whenToUse.intro} row={row} />
      <Row row={row.row} className="mt-6 md:mt-8">
        {whenToUse.cards.map((c, i) => (
          <li key={c.title} className={rowCard}>
            <article className="flex h-full flex-col overflow-hidden rounded-[22px] bg-paper">
              <div className="relative aspect-[4/5] overflow-hidden bg-mist">
                <Image src={c.image} alt={c.alt} fill placeholder="blur" sizes="(min-width: 1024px) 360px, (min-width: 640px) 46vw, 80vw" className="object-cover" />
                <span className="absolute top-4 left-4 flex h-8 min-w-8 items-center justify-center rounded-full bg-white/90 px-2 text-[13px] font-semibold text-ink tabular-nums backdrop-blur">{i + 1}</span>
              </div>
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <h3 className="text-[19px] leading-snug font-medium tracking-[-0.02em] text-ink">{c.title}</h3>
                <p className="mt-2 text-[15.5px] leading-relaxed text-text">{c.text}</p>
              </div>
            </article>
          </li>
        ))}
        {/* 8. The family card: leads to the 2-piece order. */}
        <li className={rowCard}>
          <article className="flex h-full flex-col overflow-hidden rounded-[22px] bg-ink text-white">
            <div className="relative aspect-[4/5] overflow-hidden">
              <Image src={f.image} alt={f.alt} fill placeholder="blur" sizes="(min-width: 1024px) 360px, (min-width: 640px) 46vw, 80vw" className="object-cover" />
              <span className="absolute top-4 left-4 flex h-8 min-w-8 items-center justify-center rounded-full bg-white/90 px-2 text-[13px] font-semibold text-ink tabular-nums">8</span>
              <span className="absolute top-4 right-4 rounded-full bg-[#ef4444] px-3 py-1.5 text-[13px] font-semibold text-white">−10% la 2 bucăți</span>
            </div>
            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <h3 className="text-[19px] leading-snug font-medium tracking-[-0.02em] !text-white">{f.title}</h3>
              <p className="mt-2 text-[15.5px] leading-relaxed text-white/80">{f.text}</p>
              {pairCta && <div className="mt-auto pt-5">{pairCta}</div>}
            </div>
          </article>
        </li>
      </Row>
    </section>
  )
}

/** Sections 2–5 of the Romanian NEUROS Focus page, under the buy area. */
export function FocusStory({ pairCta }: { pairCta?: ReactNode }) {
  const [who, setWho] = useState<Audience>('copil')
  return (
    <>
      <Drift who={who} setWho={setWho} />
      <SameDay who={who} setWho={setWho} />
      <HowTo />
      <WhenToUse pairCta={pairCta} />
    </>
  )
}
