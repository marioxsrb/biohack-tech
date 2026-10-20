'use client'

/**
 * Under the evening story on the NEUROS Calm product page: how it's used (one button, three scenes)
 * and when people wear it (a row of photo cards, swiped on the phone). The last card is the
 * two-device case and carries the 2-piece order. Copy is the approved Romanian text.
 * Photographs are existing product assets; cards 3–5 describe a man's day and show the
 * existing model until there is a matching photo.
 */
import Image, { type StaticImageData } from 'next/image'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { Arrow, Battery } from '@/components/ui/icons'
import activ from '@/assets/img/balance-wave/dispozitiv-activ.webp'
import birou from '@/assets/img/balance-wave/lifestyle-birou.webp'
import canapea from '@/assets/img/balance-wave/result-calm.webp'
import ceafa from '@/assets/img/balance-wave/pillar-calm.webp'
import hotel from '@/assets/img/balance-wave/result-echilibru.webp'
import inainte from '@/assets/img/balance-wave/audience-birou.webp'
import pat from '@/assets/img/balance-wave/result-somn.webp'

const titleClass = 'text-[clamp(30px,3.2vw,46px)] leading-[1.05] tracking-[-0.04em] text-balance'

// ── 4. Îl folosești cu un singur buton ─────────────────────────────────────────

const STEPS = [
  { lead: 'Îl așezi la gât, ca pe un colier.', text: 'Stă comod pe canapea, în fotoliu sau la birou.' },
  { lead: 'Apeși butonul o dată.', text: 'Lumina roșie se aprinde și începe să pulseze.' },
  { lead: 'Citești, meditezi sau stai cu ochii închiși.', text: 'După câteva minute, aparatul se oprește singur.' },
]

function OneButton() {
  return (
    <section aria-labelledby="un-singur-buton" className="pt-16 md:pt-24">
      <div className="grid overflow-hidden rounded-[28px] bg-paper md:grid-cols-12">
        {/* The device, lit: the red light the second step talks about. */}
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[radial-gradient(60%_55%_at_50%_55%,#fde3e1_0%,#fbf3f1_55%,#ffffff_100%)] md:col-span-5 md:aspect-auto md:min-h-[460px]">
          <div aria-hidden className="calm-pulse absolute top-1/2 left-1/2 h-[46%] w-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ef4444]/25 blur-3xl" />
          <Image src={activ} alt="NEUROS Calm pornit, cu lumina roșie aprinsă" placeholder="blur" sizes="(min-width: 768px) 420px, 80vw" className="relative w-[70%] max-w-[380px] drop-shadow-[0_24px_40px_rgba(11,19,22,0.18)]" />
          <span className="absolute top-5 left-5 rounded-full bg-white/85 px-3 py-1.5 text-[13px] font-semibold text-ink shadow-[0_4px_14px_rgba(11,19,22,0.08)] backdrop-blur">Un singur buton</span>
        </div>

        <div className="p-[clamp(24px,4.5vw,56px)] md:col-span-7">
          <h2 id="un-singur-buton" className={`${titleClass} max-w-[12em]`}>
            Îl folosești cu un singur buton
          </h2>
          <ol className="relative mt-8 space-y-7 md:mt-10">
            <span aria-hidden className="absolute top-3 bottom-3 left-[17px] w-px bg-line" />
            {STEPS.map((s, i) => (
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
            Îl ții încărcat, ca pe telefon, și îl lași pe noptieră sau lângă canapea, ca să fie la îndemână seara.
          </p>
        </div>
      </div>
    </section>
  )
}

// ── 5. Când îl porți ───────────────────────────────────────────────────────────

type Card = { title: string; text: string; image: StaticImageData; alt: string; position?: string }

const CARDS: Card[] = [
  {
    title: 'După muncă, pe canapea',
    text: 'Ai ajuns acasă și vrei să lași ziua la ușă. Câteva minute cu NEUROS Calm, apoi cina în familie.',
    image: canapea,
    alt: 'Femeie relaxată pe canapea, purtând NEUROS Calm la gât',
  },
  {
    title: 'Înainte de somn',
    text: 'Îl porți în pat, cu o carte în mână. Când se stinge, stingi și tu lumina.',
    image: pat,
    alt: 'Femeie în pat, seara, în lumina veiozei, purtând NEUROS Calm',
  },
  {
    title: 'Între două ședințe',
    text: 'Ai zece minute libere la prânz. Îl pui la gât la birou și răspunzi la câteva emailuri ușoare.',
    image: birou,
    alt: 'Persoană la birou, cu ochii închiși, purtând NEUROS Calm',
    position: '72% 50%',
  },
  {
    title: 'Înainte de un moment important',
    text: 'O prezentare, o negociere sau o discuție grea. Îți faci o ședință înainte și intri în cameră mai așezat.',
    image: inainte,
    alt: 'Persoană la birou, înainte de o întâlnire, cu NEUROS Calm pe masă',
    position: '50% 35%',
  },
  {
    title: 'După o zi de drum',
    text: 'Ai condus șase ore sau ai stat într-un aeroport. Seara, la hotel, îl scoți din geantă.',
    image: hotel,
    alt: 'Persoană relaxată într-o cameră liniștită, purtând NEUROS Calm',
  },
  {
    title: 'După antrenamentul de seară',
    text: 'Corpul e încă turat după sală sau alergare. O ședință te ajută să treci spre odihnă.',
    image: ceafa,
    alt: 'Gât și umeri în lumină roșie caldă, după efort',
    position: '35% 50%',
  },
]

const PAIR = {
  title: 'În doi',
  text: 'Fiecare cu aparatul lui, pe aceeași canapea. Seara devine un mic ritual pe care îl faceți împreună.',
}

/** Arrow buttons for the row (desktop); on the phone the row is swiped. */
function useRow() {
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

function WhenYouWear({ pairCta }: { pairCta?: ReactNode }) {
  const { row, edge, step } = useRow()
  const card = 'w-[80%] flex-none snap-start sm:w-[calc((100%-16px)/2.15)] lg:w-[calc((100%-32px)/3.15)]'
  return (
    <section aria-labelledby="cand-il-porti" className="pt-16 md:pt-24">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h2 id="cand-il-porti" className={`${titleClass} max-w-[14em]`}>
            Când îl porți
          </h2>
          <p className="mt-3 max-w-[28em] text-[17px] leading-relaxed text-muted md:text-[18px]">Locul lui de bază e seara. Îl poți lua cu tine și peste zi.</p>
        </div>
        <div className="flex flex-none gap-2 max-md:hidden">
          <button type="button" onClick={() => step(-1)} disabled={edge.start} aria-label="Înapoi" className={arrowBtn}>
            <Arrow className="h-5 w-5 rotate-180" />
          </button>
          <button type="button" onClick={() => step(1)} disabled={edge.end} aria-label="Mai departe" className={arrowBtn}>
            <Arrow className="h-5 w-5" />
          </button>
        </div>
      </div>

      <ul
        ref={row}
        className="-mx-[var(--gut)] mt-8 flex snap-x snap-mandatory scroll-px-[var(--gut)] gap-4 overflow-x-auto px-[var(--gut)] pb-2 [scrollbar-width:none] md:mt-10 [&::-webkit-scrollbar]:hidden"
      >
        {CARDS.map((c, i) => (
          <li key={c.title} className={card}>
            <article className="flex h-full flex-col overflow-hidden rounded-[22px] bg-paper">
              <div className="relative aspect-[4/5] overflow-hidden bg-mist">
                <Image src={c.image} alt={c.alt} fill placeholder="blur" sizes="(min-width: 1024px) 360px, (min-width: 640px) 46vw, 80vw" className="object-cover" style={c.position ? { objectPosition: c.position } : undefined} />
                <span className="absolute top-4 left-4 flex h-8 min-w-8 items-center justify-center rounded-full bg-white/90 px-2 text-[13px] font-semibold text-ink tabular-nums backdrop-blur">{i + 1}</span>
              </div>
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <h3 className="text-[19px] leading-snug font-medium tracking-[-0.02em] text-ink">{c.title}</h3>
                <p className="mt-2 text-[15.5px] leading-relaxed text-text">{c.text}</p>
              </div>
            </article>
          </li>
        ))}

        {/* 7. Two devices: the card that leads to the 2-piece order. */}
        <li className={card}>
          <article className="flex h-full flex-col overflow-hidden rounded-[22px] bg-ink text-white">
            <div className="relative aspect-[4/5] overflow-hidden bg-[radial-gradient(70%_60%_at_50%_60%,#3b1d1f_0%,#0b1316_75%)]">
              <div aria-hidden className="calm-pulse absolute top-[58%] left-1/2 h-1/2 w-3/4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ef4444]/30 blur-3xl" />
              <Image src={activ} alt="" sizes="200px" className="absolute top-[30%] left-[6%] w-[58%] -rotate-[10deg] drop-shadow-[0_24px_40px_rgba(0,0,0,0.5)]" />
              <Image src={activ} alt="" sizes="200px" className="absolute top-[47%] right-[4%] w-[58%] rotate-[8deg] drop-shadow-[0_24px_40px_rgba(0,0,0,0.5)]" />
              <span className="absolute top-4 left-4 flex h-8 min-w-8 items-center justify-center rounded-full bg-white/90 px-2 text-[13px] font-semibold text-ink tabular-nums">7</span>
              <span className="absolute top-4 right-4 rounded-full bg-[#ef4444] px-3 py-1.5 text-[13px] font-semibold text-white">−10% la 2 bucăți</span>
            </div>
            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <h3 className="text-[19px] leading-snug font-medium tracking-[-0.02em] !text-white">{PAIR.title}</h3>
              <p className="mt-2 text-[15.5px] leading-relaxed text-white/80">{PAIR.text}</p>
              {pairCta && <div className="mt-auto pt-5">{pairCta}</div>}
            </div>
          </article>
        </li>
      </ul>
    </section>
  )
}

/** Sections 4 and 5 of the Calm product page, right under "Aceeași seară, cu NEUROS Calm". */
export function CalmUse({ pairCta }: { pairCta?: ReactNode }) {
  return (
    <>
      <OneButton />
      <WhenYouWear pairCta={pairCta} />
    </>
  )
}
