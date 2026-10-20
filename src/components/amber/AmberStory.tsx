'use client'

/**
 * NEUROS Amber product page (Romanian), under the buy area: the evening with the yellow lens, the collection (the
 * five frames, like a catalogue), and when to wear them. Copy in content/amber-story.ts.
 */
import Image from 'next/image'

import { Price } from '@/components/cart/Price'
import { Row, RowArrows, rowCard, useRow } from '@/components/calm/carousel'
import { amberRoutine, amberWhen } from '@/content/amber-story'
import type { ProductId } from '@/content/catalog'
import seara from '@/assets/img/glasses/subtire-birou.webp'
import canapea from '@/assets/img/glasses/subtire-canapea.webp'
import catNegru from '@/assets/img/glasses/cat-eye-negru-1.webp'
import catBej from '@/assets/img/glasses/cat-eye-bej-1.webp'
import sqNegru from '@/assets/img/glasses/patrat-negru-1.webp'
import sqMaro from '@/assets/img/glasses/patrat-maro-1.webp'
import subNegru from '@/assets/img/glasses/subtire-negru-1.webp'

const titleClass = 'text-[clamp(30px,3.2vw,46px)] leading-[1.05] tracking-[-0.04em] text-balance'
const YELLOW = '#F2C21B'

function LensDot({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return <span aria-hidden className={`inline-block flex-none rounded-full ${className}`} style={{ background: YELLOW }} />
}

// ── Seara, cu NEUROS Amber ──
function Routine() {
  const step = amberRoutine.steps[0]
  return (
    <section aria-labelledby="seara-amber" className="pt-10 md:pt-14">
      <h2 id="seara-amber" className={`${titleClass} max-w-[15em]`}>
        {amberRoutine.title}
      </h2>
      <p className="mt-3 max-w-[34em] text-[17px] leading-relaxed text-muted md:text-[18px]">{amberRoutine.intro}</p>
      <div className="mt-8 grid overflow-hidden rounded-[24px] bg-paper md:mt-10 md:grid-cols-2">
        <div className="relative aspect-[4/3] overflow-hidden bg-mist md:aspect-auto md:min-h-[380px]">
          <Image src={seara} alt="Femeie la laptop, seara, purtând NEUROS Amber" fill placeholder="blur" sizes="(min-width: 768px) 540px, 100vw" className="object-cover" />
          <span className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-white/92 px-3 py-1.5 text-[13.5px] font-semibold text-ink backdrop-blur">
            <LensDot />
            {step.when}
          </span>
        </div>
        <div className="flex flex-col justify-center p-6 sm:p-8">
          <h3 className="text-[22px] leading-snug font-medium tracking-[-0.02em] text-ink">{step.title}</h3>
          <p className="mt-2 text-[16px] leading-relaxed text-text">{step.text}</p>
          <ul className="mt-4 space-y-2">
            {step.bullets.map((b) => (
              <li key={b} className="flex gap-2.5 text-[15px] leading-snug text-text">
                <LensDot className="mt-[5px] h-2.5 w-2.5" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

// ── Colecția: cele cinci rame ──
const SETS = [
  { id: 'cat-eye-negru', name: 'Cat eye negru', img: catNegru },
  { id: 'cat-eye-bej', name: 'Cat eye bej', img: catBej },
  { id: 'patrat-negru', name: 'Unisex pătrat negru', img: sqNegru },
  { id: 'patrat-maro', name: 'Unisex pătrat maro', img: sqMaro },
  { id: 'subtire-negru', name: 'Ramă subțire neagră', img: subNegru, isNew: true },
]

function Collection({ productId, onPick }: { productId: ProductId; onPick: (variantId: string) => void }) {
  return (
    <section aria-labelledby="colectia" className="pt-12 md:pt-16">
      <h2 id="colectia" className={`${titleClass} max-w-[15em]`}>
        Alege rama care ți se potrivește.
      </h2>
      <p className="mt-3 max-w-[34em] text-[17px] leading-relaxed text-muted md:text-[18px]">Cinci rame, toate cu lentile galbene. La 3 perechi, una este gratuită, și poți combina ramele.</p>
      <ul className="mt-8 grid grid-cols-2 gap-3 md:mt-10 md:grid-cols-3 md:gap-4">
        <li className="relative col-span-2 min-h-[260px] overflow-hidden rounded-[20px] md:col-span-1 md:row-span-1">
          <Image src={canapea} alt="Bărbat pe canapea, seara, purtând NEUROS Amber cu ramă subțire" fill placeholder="blur" sizes="(min-width: 768px) 360px, 100vw" className="object-cover" />
          <p className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(11,19,22,.75),rgba(11,19,22,0))] p-5 pt-12 text-[16px] leading-snug font-medium text-white">Seara, cu lumina mai blândă.</p>
        </li>
        {SETS.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => onPick(s.id)} className="group flex h-full w-full flex-col overflow-hidden rounded-[20px] bg-white text-left shadow-[0_1px_0_rgba(11,19,22,.04)] transition hover:shadow-[0_10px_30px_rgba(11,19,22,.10)]">
              <span className="relative flex aspect-[5/4] items-center justify-center px-[10%]">
                <Image src={s.img} alt={`NEUROS Amber ${s.name}`} sizes="(min-width: 768px) 300px, 45vw" className="h-auto w-full transition duration-300 group-hover:scale-[1.03]" />
                {s.isNew && <span className="absolute top-3 left-3 rounded-full bg-ink px-2.5 py-1 text-[12px] font-semibold text-white">Nou</span>}
              </span>
              <span className="mt-auto px-4 pb-4 sm:px-5 sm:pb-5">
                <span className="block text-[16.5px] leading-snug font-medium tracking-[-0.015em] text-ink">{s.name}</span>
                <span className="mt-1 block text-[14px] text-muted">
                  <Price productId={productId} variantId={s.id} />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── Când le porți ──
function When() {
  const row = useRow()
  return (
    <section aria-labelledby="cand-le-porti" className="pt-12 md:pt-16">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h2 id="cand-le-porti" className={titleClass}>
            {amberWhen.title}
          </h2>
          <p className="mt-3 max-w-[30em] text-[17px] leading-relaxed text-muted md:text-[18px]">{amberWhen.intro}</p>
        </div>
        <RowArrows edge={row.edge} step={row.step} />
      </div>
      <Row row={row.row} className="mt-6 md:mt-8">
        {amberWhen.cards.map((c, i) => (
          <li key={c.title} className={rowCard}>
            <article className="flex h-full flex-col rounded-[22px] bg-paper p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <LensDot />
                <span className="text-[12px] font-semibold text-muted/70 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <h3 className="mt-4 text-[18px] leading-snug font-medium tracking-[-0.02em] text-ink">{c.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-text">{c.text}</p>
            </article>
          </li>
        ))}
      </Row>
    </section>
  )
}

/** Sections 2–5 of the Romanian NEUROS Amber page, under the buy area. `onPick` selects a variant in the buy area. */
export function AmberStory({ productId, onPick }: { productId: ProductId; onPick: (variantId: string) => void }) {
  return (
    <>
      <Routine />
      <Collection productId={productId} onPick={onPick} />
      <When />
    </>
  )
}
