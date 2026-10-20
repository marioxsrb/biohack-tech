'use client'

/**
 * NEUROS Amber product page (Romanian), under the buy area, built around one idea: the same frame with two lenses,
 * yellow for the evening and red for the last hour before sleep. The two-step evening, the collection (every frame
 * as a pair, yellow above red, like a catalogue card), yellow or red side by side, and when to wear them.
 * Copy in content/amber-story.ts.
 */
import Image from 'next/image'

import { Price } from '@/components/cart/Price'
import { useUnitDeal } from '@/components/product/BuyBox'
import { Row, RowArrows, rowCard, useRow } from '@/components/calm/carousel'
import { amberCompare, amberRoutine, amberWhen, type AmberLens } from '@/content/amber-story'
import type { ProductId } from '@/content/catalog'
import seara from '@/assets/img/glasses/subtire-birou.webp'
import somn from '@/assets/img/glasses/subtire-pat-rosu.webp'
import perechi from '@/assets/img/glasses/subtire-noptiera-set.webp'
import setCatNegru from '@/assets/img/glasses/set-cat-eye-negru.webp'
import setCatBej from '@/assets/img/glasses/set-cat-eye-bej.webp'
import setSqNegru from '@/assets/img/glasses/set-patrat-negru.webp'
import setSqMaro from '@/assets/img/glasses/set-patrat-maro.webp'
import setSubNegru from '@/assets/img/glasses/set-subtire-negru.webp'

const titleClass = 'text-[clamp(30px,3.2vw,46px)] leading-[1.05] tracking-[-0.04em] text-balance'
export const LENS_COLOR = { galben: '#F2C21B', rosu: '#E2492B' } as const

function LensDot({ lens, className = 'h-3.5 w-3.5' }: { lens: AmberLens | 'ambele'; className?: string }) {
  const bg = lens === 'ambele' ? `linear-gradient(135deg,${LENS_COLOR.galben} 50%,${LENS_COLOR.rosu} 50%)` : LENS_COLOR[lens]
  return <span aria-hidden className={`inline-block flex-none rounded-full ${className}`} style={{ background: bg }} />
}

// ── Seara în doi pași ──
function Routine() {
  const photos = { galben: { src: seara, alt: 'Femeie la laptop, seara, purtând NEUROS Amber cu lentile galbene' }, rosu: { src: somn, alt: 'Bărbat în pat, înainte de somn, purtând NEUROS Amber cu lentile roșii' } }
  return (
    <section aria-labelledby="doi-pasi" className="pt-10 md:pt-14">
      <h2 id="doi-pasi" className={`${titleClass} max-w-[15em]`}>
        {amberRoutine.title}
      </h2>
      <p className="mt-3 max-w-[34em] text-[17px] leading-relaxed text-muted md:text-[18px]">{amberRoutine.intro}</p>
      <ol className="mt-8 grid gap-4 md:mt-10 md:grid-cols-2 md:gap-5">
        {amberRoutine.steps.map((s, i) => (
          <li key={s.lens} className="flex flex-col overflow-hidden rounded-[24px] bg-paper">
            <div className="relative aspect-[4/3] overflow-hidden bg-mist">
              <Image src={photos[s.lens].src} alt={photos[s.lens].alt} fill placeholder="blur" sizes="(min-width: 768px) 540px, 100vw" className="object-cover" />
              <span className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-white/92 px-3 py-1.5 text-[13.5px] font-semibold text-ink backdrop-blur">
                <LensDot lens={s.lens} />
                Pasul {i + 1} · {s.when}
              </span>
            </div>
            <div className="flex flex-1 flex-col p-6 sm:p-7">
              <h3 className="text-[21px] leading-snug font-medium tracking-[-0.02em] text-ink">{s.title}</h3>
              <p className="mt-2 text-[16px] leading-relaxed text-text">{s.text}</p>
              <ul className="mt-4 space-y-2">
                {s.bullets.map((b) => (
                  <li key={b} className="flex gap-2.5 text-[15px] leading-snug text-text">
                    <LensDot lens={s.lens} className="mt-[5px] h-2.5 w-2.5" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

// ── Colecția: fiecare ramă, galben deasupra, roșu dedesubt ──
const SETS = [
  { id: 'cat-eye-negru', name: 'Cat eye negru', img: setCatNegru },
  { id: 'cat-eye-bej', name: 'Cat eye bej', img: setCatBej },
  { id: 'patrat-negru', name: 'Unisex pătrat negru', img: setSqNegru },
  { id: 'patrat-maro', name: 'Unisex pătrat maro', img: setSqMaro },
  { id: 'subtire-negru', name: 'Ramă subțire neagră', img: setSubNegru, isNew: true },
]

/** The pachet's price after its 20%, then a single pair's. No struck-through price (store rule, see BuyBox). */
function SetPrice({ productId, frame }: { productId: ProductId; frame: string }) {
  const deal = useUnitDeal(productId, `${frame}-pachet`)
  return (
    <span className="mt-1 block text-[14px] text-muted">
      {deal && (
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[16px] font-semibold text-ink tabular-nums">Pachet {deal.price}</span>
          <span className="font-semibold text-[#d93636]">−{deal.percent}%</span>
        </span>
      )}
      <span className="block">
        sau <Price productId={productId} variantId={frame} /> o pereche
      </span>
    </span>
  )
}

function Collection({ productId, onPick }: { productId: ProductId; onPick: (variantId: string) => void }) {
  return (
    <section aria-labelledby="colectia" className="pt-12 md:pt-16">
      <h2 id="colectia" className={`${titleClass} max-w-[15em]`}>
        Alege rama. Lentilele vin în două culori.
      </h2>
      <p className="mt-3 max-w-[34em] text-[17px] leading-relaxed text-muted md:text-[18px]">Fiecare ramă există cu lentile galbene și cu lentile roșii. Pachetul cu amândouă are 20% reducere, sau iei doar una dintre ele.</p>
      <ul className="mt-8 grid grid-cols-2 gap-3 md:mt-10 md:grid-cols-3 md:gap-4">
        <li className="relative col-span-2 min-h-[260px] overflow-hidden rounded-[20px] md:col-span-1 md:row-span-1">
          <Image src={perechi} alt="Cele două perechi NEUROS Amber cu ramă subțire, galbenă și roșie, pe noptieră" fill placeholder="blur" sizes="(min-width: 768px) 360px, 100vw" className="object-cover" />
          <p className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(11,19,22,.75),rgba(11,19,22,0))] p-5 pt-12 text-[16px] leading-snug font-medium text-white">Galbene de la apus. Roșii în ultima oră.</p>
        </li>
        {SETS.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => onPick(`${s.id}-pachet`)} className="group flex h-full w-full flex-col overflow-hidden rounded-[20px] bg-white text-left shadow-[0_1px_0_rgba(11,19,22,.04)] transition hover:shadow-[0_10px_30px_rgba(11,19,22,.10)]">
              <span className="relative flex aspect-[5/4] items-center justify-center px-[10%]">
                <Image src={s.img} alt={`NEUROS Amber ${s.name}, cu lentile galbene și cu lentile roșii`} sizes="(min-width: 768px) 300px, 45vw" className="h-auto w-full transition duration-300 group-hover:scale-[1.03]" />
                {s.isNew && <span className="absolute top-3 left-3 rounded-full bg-ink px-2.5 py-1 text-[12px] font-semibold text-white">Nou</span>}
              </span>
              <span className="mt-auto px-4 pb-4 sm:px-5 sm:pb-5">
                <span className="block text-[16.5px] leading-snug font-medium tracking-[-0.015em] text-ink">{s.name}</span>
                <SetPrice productId={productId} frame={s.id} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── Galben sau roșu? ──
function Compare() {
  return (
    <section aria-labelledby="galben-sau-rosu" className="pt-12 md:pt-16">
      <h2 id="galben-sau-rosu" className={titleClass}>
        {amberCompare.title}
      </h2>
      <p className="mt-3 max-w-[34em] text-[17px] leading-relaxed text-muted md:text-[18px]">{amberCompare.intro}</p>
      <div className="mt-8 overflow-hidden rounded-[24px] bg-paper md:mt-10">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] border-b border-mist-2 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <span className="hidden md:block" />
          {(['galben', 'rosu'] as const).map((l) => (
            <p key={l} className="flex items-center gap-2.5 px-5 py-4 text-[16px] font-semibold text-ink sm:px-6">
              <LensDot lens={l} className="h-5 w-5" />
              {l === 'galben' ? 'Lentile galbene' : 'Lentile roșii'}
            </p>
          ))}
        </div>
        <dl>
          {amberCompare.rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] border-b border-mist-2 last:border-b-0 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <dt className="col-span-2 px-5 pt-4 text-[13px] font-semibold tracking-[0.02em] text-muted uppercase sm:px-6 md:col-span-1 md:py-4 md:text-[15px] md:font-medium md:tracking-normal md:text-ink md:normal-case">{r.label}</dt>
              <dd className="px-5 pt-1.5 pb-4 text-[15px] leading-snug text-text sm:px-6 md:py-4">{r.galben}</dd>
              <dd className="px-5 pt-1.5 pb-4 text-[15px] leading-snug text-text sm:px-6 md:py-4">{r.rosu}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

// ── Când le porți ──
function When() {
  const row = useRow()
  const tag = { galben: 'Lentile galbene', rosu: 'Lentile roșii', ambele: 'Amândouă' }
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
                <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                  <LensDot lens={c.lens} />
                  {tag[c.lens]}
                </span>
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
      <Compare />
      <When />
    </>
  )
}
