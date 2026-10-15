/**
 * The presentation page of each product: the landing's story and its price, without the purchase. Same sections and
 * copy as the landing (components/landing/stories), then the facts, the questions and a contact. The
 * technical rows come from the product page (product-content.ts), so they are written once.
 */
import Image from 'next/image'
import { getProduct, unitPrice, variantLabel, type Product } from '@/content/catalog'
import { formatLei } from '@/lib/money'
import type { Landing } from '@/content/landings'
import { getProductContent } from '@/content/product-content'
import { Kicker, Title } from '@/components/landing/parts'
import { CalmHero, CalmHow, CalmMoments, CalmUse } from '@/components/landing/stories/calm'
import { FocusHero, FocusHow, FocusVideo, FocusWhere } from '@/components/landing/stories/focus'
import { AmberHero, AmberHow, AmberWhen } from '@/components/landing/stories/amber'
import { Contact, Facts, HeroPrice, PresentationShell, Questions } from './kit'

const rows = (p: Product, extra: [string, string][] = []): [string, string][] => [...getProductContent(p.id).specs.map((s): [string, string] => [s.label, s.value]), ...extra]

export function PresentationPage({ landing }: { landing: Landing }) {
  const p = getProduct(landing.productId)!
  switch (landing.slug) {
    case 'calm':
      return (
        <PresentationShell landing={landing} heroTone="light">
          <CalmHero name={p.name} buy={<HeroPrice amount={p.price} light />} />
          <CalmHow />
          <CalmUse />
          <CalmMoments />
          <Facts image={p.cutout} rows={rows(p, [])} />
          <Questions landing={landing} />
          <Contact text="Spune-ne cum arată seara ta. Îți explicăm cum se folosește NEUROS Calm și dacă ți se potrivește." />
        </PresentationShell>
      )
    case 'focus':
      return (
        <PresentationShell landing={landing} heroTone="dark">
          <FocusHero name={p.name} buy={<HeroPrice amount={p.price} />} />
          <FocusVideo />
          <FocusHow />
          <Studies p={p} />
          <FocusWhere />
          <Facts image={p.cutout} rows={rows(p, [])} />
          <Questions landing={landing} />
          <Contact text="Spune-ne pentru ce o folosești: muncă, studiu sau relaxare. Îți explicăm cum începi." />
        </PresentationShell>
      )
    case 'amber':
      return (
        <PresentationShell landing={landing} heroTone="dark">
          <AmberHero name={p.name} buy={<HeroPrice amount={p.price} />} />
          <AmberHow />
          <Frames p={p} />
          <AmberWhen />
          <Facts image={p.cutout} rows={rows(p)} />
          <Questions landing={landing} />
          <Contact text="Scrie-ne ce formă porți de obicei. Îți recomandăm rama potrivită." />
        </PresentationShell>
      )
  }
}

/** NEUROS Focus: the published research behind the method, with what it covers said plainly. */
function Studies({ p }: { p: Product }) {
  const studies = getProductContent(p.id).explain?.studies ?? []
  if (!studies.length) return null
  return (
    <section aria-labelledby="studii" className="lp-wrap pt-[calc(var(--sec)*0.6)]">
      <div className="rounded-[24px] bg-[var(--lp-panel)] p-[clamp(20px,3vw,36px)]">
        <h2 id="studii" className="text-[20px] font-medium tracking-[-0.015em]">
          Studii despre biofeedback
        </h2>
        <p className="mt-1 text-[15px] text-[var(--lp-muted)]">Studiile privesc biofeedbackul ca metodă, în general.</p>
        <ul className="mt-4 grid gap-x-8 gap-y-1 md:grid-cols-2">
          {studies.map((s) => (
            <li key={s.href}>
              <a href={s.href} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center text-[15.5px] underline decoration-[var(--lp-line)] underline-offset-4 hover:decoration-current">
                {s.label}
                <span className="sr-only"> (se deschide într-o filă nouă)</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** NEUROS Amber: the four frames, side by side, with their names. */
function Frames({ p }: { p: Product }) {
  const lookbook = getProductContent(p.id).lookbook
  return (
    <section aria-labelledby="rame" className="lp-wrap py-[var(--sec)]">
      <Kicker>Ramele</Kicker>
      <Title id="rame" className="mt-3">
        {lookbook?.title ?? 'Patru rame. Același filtru.'}
      </Title>
      {lookbook && <p className="mt-3 max-w-[34em] text-[17px] leading-relaxed text-[var(--lp-muted)]">{lookbook.text}</p>}
      <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {(p.variants ?? []).map((v) => {
          const img = v.images.find((i) => i.kind === 'cutout') ?? p.cutout
          const price = unitPrice(p, v)
          return (
            <li key={v.id} className="rounded-[20px] bg-paper p-3 sm:p-4">
              <div className="relative aspect-[16/10] rounded-[14px] bg-[var(--lp-bg)]">
                <Image src={img.src} alt={img.alt} fill sizes="(min-width: 1024px) 260px, 45vw" className="object-contain p-[10%]" />
              </div>
              <p className="mt-3 text-[16px] leading-snug font-medium sm:text-[17px]">{variantLabel(p, v)}</p>
              {price !== null && <p className="mt-0.5 text-[17px] font-semibold tracking-[-0.01em] tabular-nums">{formatLei(price)}</p>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
