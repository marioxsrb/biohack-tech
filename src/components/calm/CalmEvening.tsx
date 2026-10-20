'use client'

/**
 * The evening story on NEUROS Calm: the night as it is, then the same night with the device.
 * Used on the product page (under the trust row) and on the calm landing / presentation.
 * Both are rows of cards (swiped on the phone) to keep the page short. Copy is the approved Romanian
 * text. Photographs are existing product assets; the morning frame is a placeholder until a real photo exists.
 */
import Image, { type StaticImageData } from 'next/image'
import type { ReactNode } from 'react'

import { Row, RowArrows, rowCard, useRow } from '@/components/calm/carousel'

import canapea from '@/assets/img/balance-wave/lifestyle-canapea.webp'
import lampa from '@/assets/img/balance-wave/pillar-calm.webp'
import dormitor from '@/assets/img/balance-wave/audience-somn.webp'

const CARDS: { n: string; title: string; text: string }[] = [
  {
    n: '1',
    title: 'Mintea rămâne la birou',
    text: 'E 21:30 și refaci în cap discuția cu clientul. Speli vasele, pui copiii la culcare, iar lista de mâine se scrie singură în gând.',
  },
  {
    n: '2',
    title: 'Adormi greu',
    text: 'Te întinzi la 23:00, cu ochii închiși și inima încă pe fugă. Pe la miezul nopții iei telefonul, ca să treacă timpul.',
  },
  {
    n: '3',
    title: 'Te trezești la 3',
    text: 'Ceasul arată 3:12, iar creierul pornește direct pe ședința de la 9. Adormi la loc spre dimineață, cu o oră înainte de alarmă.',
  },
  {
    n: '4',
    title: 'Scorul de somn coboară',
    text: 'Dimineața deschizi aplicația și vezi aceeași cifră mică, a patra noapte la rând. Ai luat magneziu, ai făcut duș rece și exerciții de respirație.',
  },
  {
    n: '5',
    title: 'Ai încercat aproape tot',
    text: 'Ai o aplicație de meditație deschisă de trei ori. În sertar ai melatonină, pe noptieră o carte despre somn citită pe jumătate.',
  },
]

type Moment = {
  moment: string
  text: string
  image?: StaticImageData
  alt?: string
  /** Shown instead of a photograph. The matching TODO lives on the placeholder. */
  placeholder?: { label: string; todo: string }
}

const MOMENTS: Moment[] = [
  {
    moment: '20:30',
    text: 'Închizi laptopul, te așezi pe canapea și pui NEUROS Calm la gât. Apeși butonul, iar lumina roșie se aprinde.',
    image: canapea,
    alt: 'Femeie pe canapea, seara, purtând NEUROS Calm la gât',
  },
  {
    moment: 'În timpul ședinței',
    text: 'Citești câteva pagini sau stai cu ochii închiși. Umerii coboară, iar lista de mâine trece pe planul doi.',
    image: lampa,
    alt: 'Femeie cu ochii închiși, în lumină caldă, purtând NEUROS Calm',
  },
  {
    moment: 'Câteva minute mai târziu',
    text: 'Aparatul se stinge singur. Tu rămâi în starea aceea așezată și pornești spre dormitor.',
  },
  {
    moment: '22:45',
    text: 'Te pui în pat cu mintea mai liniștită. Telefonul rămâne pe noptieră.',
    image: dormitor,
    alt: 'Femeie în pat, seara, cu ochii închiși, purtând NEUROS Calm',
  },
  {
    moment: '7:00',
    text: 'Alarma sună, iar tu te ridici din pat odihnit. Ai chef de ziua care vine.',
    placeholder: {
      label: 'Fotografie de dimineață, în pregătire',
      // TODO: replace with a real morning photograph (soft daylight, getting out of bed). Do not use a stock hotlink.
      todo: 'morning-getting-up',
    },
  },
  {
    moment: 'Dimineața, în aplicație',
    text: 'Deschizi Oura sau Garmin și urmărești cum arată somnul tău de la o săptămână la alta.',
  },
  {
    moment: 'După câteva săptămâni',
    text: 'Ședința de seară a devenit un obicei, la fel de firesc ca spălatul pe dinți. Partenerul tău observă că ești mai prezent la cină.',
  },
]

const titleClass = 'text-[clamp(30px,3.2vw,46px)] leading-[1.05] tracking-[-0.04em] text-balance'

/** Top of a moment's card: its photo, or for moments without one a small drawing in the colours of that hour. */
function Visual({ m }: { m: Moment }) {
  if (m.image) {
    return (
      <div className="relative aspect-[4/3] overflow-hidden bg-mist">
        <Image src={m.image} alt={m.alt ?? ''} fill placeholder="blur" sizes="(min-width: 1024px) 360px, (min-width: 640px) 46vw, 80vw" className="object-cover" />
      </div>
    )
  }
  const kind = m.placeholder || m.moment === '7:00' ? 'morning' : m.moment.startsWith('După câteva') ? 'weeks' : m.moment.startsWith('Dimineața') ? 'score' : 'off'
  const bg = {
    morning: 'bg-[linear-gradient(180deg,#f6e6d0_0%,#f4efe6_46%,#e4eef1_100%)]',
    weeks: 'bg-[linear-gradient(160deg,#ecf8fa_0%,#ffffff_75%)]',
    score: 'bg-[linear-gradient(170deg,#0b1a2e_0%,#1f2f4d_100%)]',
    off: 'bg-[linear-gradient(170deg,#1a1416_0%,#2a1c20_100%)]',
  }[kind]
  return (
    <div role={m.placeholder ? 'img' : undefined} aria-label={m.placeholder?.label} data-photo-todo={m.placeholder?.todo} className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden ${bg}`}>
      {/* TODO (morning-getting-up): a real photograph of a calm morning; no stock hotlink. */}
      {kind === 'morning' && <span aria-hidden className="h-28 w-28 rounded-full bg-[radial-gradient(circle,#f3d2a4_0%,rgba(243,210,164,0)_72%)]" />}
      {kind === 'weeks' && (
        <span aria-hidden className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 21 }).map((_, i) => (
            <span key={i} className={`h-3.5 w-3.5 rounded-[4px] ${i < 17 ? 'bg-cyan-700/70' : 'bg-line'}`} />
          ))}
        </span>
      )}
      {kind === 'score' && (
        <svg aria-hidden viewBox="0 0 200 80" className="w-[70%] text-[#7fdcec]">
          {/* sleep score climbing over the week */}
          <path d="M5 66 L40 58 L75 60 L110 44 L145 36 L195 18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {[66, 58, 60, 44, 36, 18].map((y, i) => (
            <circle key={i} cx={[5, 40, 75, 110, 145, 195][i]} cy={y} r="4" fill="currentColor" />
          ))}
        </svg>
      )}
      {/* the device switching itself off: the red light fading */}
      {kind === 'off' && <span aria-hidden className="h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(239,68,68,0.45)_0%,rgba(239,68,68,0)_70%)]" />}
    </div>
  )
}

/**
 * `frame: 'product'` sits inside the product page wrap. `frame: 'landing'` brings its own page padding.
 * `cta` is the existing purchase control (or, on the presentation page, a contact link). `note` is the
 * short trust line under that button, omitted where there is no purchase.
 */
export function CalmEvening({ frame = 'product', cta, note }: { frame?: 'product' | 'landing'; cta?: ReactNode; note?: ReactNode }) {
  const wrap = frame === 'landing' ? 'lp-wrap' : ''
  const now = useRow()
  const after = useRow()
  return (
    <div className={frame === 'landing' ? 'bg-[var(--lp-bg)]' : undefined}>
      <section aria-labelledby="seara-ta" className={`${wrap} ${frame === 'landing' ? 'pt-[clamp(64px,8vw,104px)]' : 'pt-10 md:pt-14'}`}>
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 id="seara-ta" className={`${titleClass} max-w-[14em]`}>
              Seara ta, așa cum e acum
            </h2>
            <p className="mt-3 max-w-[28em] text-[17px] leading-relaxed text-muted md:text-[18px]">Ziua s-a terminat de câteva ore, iar corpul tău încă ține ritmul ei.</p>
          </div>
          <RowArrows edge={now.edge} step={now.step} />
        </div>
        <Row row={now.row} className="mt-7 md:mt-8">
          {CARDS.map((c) => (
            <li key={c.n} className={rowCard}>
              <article className="flex h-full flex-col rounded-[22px] bg-paper p-5 sm:p-6">
                <span className="text-[13px] font-semibold tabular-nums text-cyan-700">{c.n}</span>
                <h3 className="mt-2 text-[18px] leading-snug font-medium tracking-[-0.02em] text-ink">{c.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-text">{c.text}</p>
              </article>
            </li>
          ))}
        </Row>
        <p className="mt-5 max-w-[40em] text-[15px] leading-relaxed text-muted">1 din 3 români doarme prost, iar 7 din 10 dintre ei spun că stresul le strică somnul.</p>
      </section>

      <section aria-labelledby="aceeasi-seara" className={`${wrap} pt-12 pb-4 md:pt-16 md:pb-6`}>
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 id="aceeasi-seara" className={`${titleClass} max-w-[16em]`}>
              Aceeași seară, cu NEUROS Calm
            </h2>
            <p className="mt-3 max-w-[26em] text-[17px] leading-relaxed text-muted md:text-[18px]">Ziua e la fel de plină. Se schimbă felul în care se termină.</p>
          </div>
          <RowArrows edge={after.edge} step={after.step} />
        </div>
        {/* The evening as a timeline: one card per moment, left to right. */}
        <Row row={after.row} className="mt-7 md:mt-8">
          {MOMENTS.map((m, i) => (
            <li key={m.moment} className={rowCard}>
              <article className="flex h-full flex-col overflow-hidden rounded-[22px] bg-paper">
                <Visual m={m} />
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <p className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.01em] text-cyan-700">
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-cyan-50 px-1.5 text-[12px] tabular-nums">{i + 1}</span>
                    {m.moment}
                  </p>
                  <p className="mt-2 text-[15.5px] leading-relaxed text-text">{m.text}</p>
                </div>
              </article>
            </li>
          ))}
        </Row>
        <p className="mt-5 max-w-[40em] text-[15px] leading-relaxed text-muted">
          Fiecare om răspunde în ritmul lui, așa că îți recomandăm să îl folosești în fiecare seară, câteva săptămâni la rând.
        </p>
        {cta && (
          <div className="mt-6 flex flex-col items-start gap-3">
            {cta}
            {note}
          </div>
        )}
      </section>
    </div>
  )
}
