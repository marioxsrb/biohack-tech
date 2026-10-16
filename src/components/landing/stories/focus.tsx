/**
 * NEUROS Focus, told once: the hero, the video, how the headset works, where it is used. Used by the
 * landing (with price and purchase) and by the presentation page (information only).
 */
import Image from 'next/image'
import type { ReactNode } from 'react'
import { Arrow } from '@/components/ui/icons'
import { PresentationVideo } from '../PresentationVideo'
import { Kicker, Title } from '../parts'

import studio from '@/assets/img/brainlink/casca-studio.webp'
import tableta from '@/assets/img/brainlink/pillar-games.webp'
import componente from '@/assets/img/brainlink/componente.webp'
import birou from '@/assets/img/brainlink/result-focus.webp'
import meditatie from '@/assets/img/brainlink/result-meditation.webp'

/** Hero: text left; the headset in the studio, the person with the tablet overlapping. */
export function FocusHero({ name, buy, cta }: { name: string; buy?: ReactNode; cta?: ReactNode }) {
  return (
    <section id="lp-hero" aria-labelledby="lp-title" className="lp-wrap pt-28 pb-[var(--sec)] max-sm:pt-24">
      <div className="grid items-center gap-y-12 lg:grid-cols-12 lg:gap-x-12">
        <div className="lg:col-span-5">
          <Kicker>{name} · pentru concentrare</Kicker>
          <h1 id="lp-title" className="mt-4 text-[clamp(40px,5vw,72px)] leading-[0.98] tracking-[-0.045em]">
            Mai mult focus. Mai puțină risipire.
          </h1>
          <p className="mt-5 max-w-[28em] text-[clamp(17px,1.3vw,19px)] leading-snug text-[var(--lp-muted)]">
            Te ajută să-ți aduni atenția, printr-un joc scurt. Mulți utilizatori simt mai mult focus și mai multă energie, la muncă și la studiu.
          </p>
          {buy}
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            {cta}
            <a href="#cum" className="tlink">
              Cum te ajută <Arrow />
            </a>
          </div>
        </div>
        <div className="relative lg:col-span-7">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[32px] bg-white">
            <Image
              src={studio}
              alt="NEUROS Focus, casca, fotografiată în studio"
              fill
              preload
              fetchPriority="high"
              quality={85}
              placeholder="blur"
              sizes="(min-width: 1152px) 660px, calc(100vw - 40px)"
              className="object-cover"
            />
          </div>
          <div className="absolute -bottom-10 -left-6 w-[44%] overflow-hidden rounded-[22px] shadow-[0_30px_60px_-30px_rgba(8,17,19,.55)] ring-4 ring-[var(--lp-bg)] max-sm:left-3 max-sm:-bottom-8 max-sm:w-[46%]">
            <div className="relative aspect-[4/3]">
              <Image src={tableta} alt="Tânăr pe canapea, purtând NEUROS Focus și jucând pe tabletă" fill fetchPriority="low" placeholder="blur" sizes="(max-width: 640px) 46vw, 300px" className="object-cover object-[65%_50%]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Presentation video: the headset in use, in 20 seconds. */
export function FocusVideo() {
  return (
    <section aria-labelledby="video-title" className="lp-wrap pt-[calc(var(--sec)*0.5)]">
      <div className="grid items-center gap-y-10 lg:grid-cols-12 lg:gap-x-12">
        <div className="lg:col-span-5">
          <Kicker>Vezi cum arată</Kicker>
          <Title id="video-title" className="mt-3 max-w-[12em]">
            Focusul, în 20 de secunde.
          </Title>
          <p className="mt-5 max-w-[28em] text-[17px] leading-relaxed text-[var(--lp-muted)]">
            Pui casca, ții tableta. Jocul merge mai departe cât timp ești atent. Așa se simte concentrarea.
          </p>
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <PresentationVideo src="/video/neuros-focus-720.mp4" poster="/video/neuros-focus-poster.webp" label="Video de prezentare NEUROS Focus" />
        </div>
      </div>
    </section>
  )
}

/** How it works: signal, app, game. */
export function FocusHow() {
  return (
    <section id="cum" aria-labelledby="cum-title" className="lp-wrap scroll-mt-10 pt-[calc(var(--sec)*0.6)]">
      <Kicker>Cum te ajută</Kicker>
      <Title id="cum-title" className="mt-3 max-w-[14em]">
        Casca simte atenția. Jocul te ajută s-o ții.
      </Title>
      <div className="mt-10 grid items-center gap-y-10 lg:grid-cols-12 lg:gap-x-12">
        <div className="relative aspect-[16/9] overflow-hidden rounded-[28px] bg-[#f6f6f6] lg:col-span-7">
          <Image src={componente} alt="NEUROS Focus în interior: carcasa, placa electronică, bateria și difuzorul" fill fetchPriority="low" sizes="(min-width: 1152px) 660px, 100vw" className="object-contain p-[4%]" />
        </div>
        <ol className="space-y-6 lg:col-span-5">
          {[
            ['Semnalul', 'Creierul produce semnale electrice foarte slabe. Cei trei senzori EEG ai căștii le citesc și le trimit prin Bluetooth.'],
            ['Aplicația', 'Neuros Game transformă semnalul într-un joc, pe loc. Sunt peste 10 jocuri și meditații ghidate.'],
            ['Jocul', 'Când ești atent, jocul înaintează. Pas cu pas, înveți să revii mai ușor la ce faci.'],
          ].map(([t, d], i) => (
            <li key={t} className="grid grid-cols-[44px_1fr] gap-x-4">
              <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--lp-accent)] text-[15px] font-semibold text-white tabular-nums">
                {i + 1}
              </span>
              <span>
                <span className="block text-[20px] font-medium tracking-[-0.015em]">{t}</span>
                <span className="mt-1 block text-[16px] leading-relaxed text-[var(--lp-muted)]">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-6 max-w-[48em] text-[15px] leading-relaxed text-[var(--lp-muted)]">
        Casca recunoaște stări precum concentrarea și relaxarea. Gândurile rămân ale tale. Metoda vine din cercetarea despre biofeedback.
      </p>
    </section>
  )
}

/** Where it is used. */
export function FocusWhere() {
  return (
    <section aria-labelledby="unde" className="mt-[var(--sec)] bg-[var(--lp-ink)] py-[var(--sec)] text-white">
      <div className="lp-wrap grid gap-y-10 lg:grid-cols-12 lg:gap-x-12">
        <div className="lg:col-span-7">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[28px]">
            <Image src={birou} alt="Bărbat la birou, concentrat, purtând NEUROS Focus" fill fetchPriority="low" placeholder="blur" sizes="(min-width: 1152px) 660px, 100vw" className="object-cover" />
          </div>
        </div>
        <div className="on-dark flex flex-col lg:col-span-5">
          <p className="text-[13px] font-semibold tracking-[0.14em] text-cyan uppercase">Unde o folosești</p>
          <h2 id="unde" className="mt-3 text-[clamp(32px,3.6vw,48px)] leading-[1.02] tracking-[-0.04em] !text-white">
            La muncă, la studiu, înainte de o sarcină grea.
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-white/80">O sesiune scurtă te ajută să intri mai ușor în concentrare. Mulți utilizatori simt mai multă claritate.</p>
          <div className="mt-auto pt-10">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[20px]">
              <Image src={meditatie} alt="Femeie meditând în grădină, purtând NEUROS Focus" fill fetchPriority="low" placeholder="blur" sizes="(min-width: 1152px) 440px, 100vw" className="object-cover" />
            </div>
            <p className="mt-3 text-[15.5px] text-white/75">Și la meditație. Vezi pe loc cât de relaxat ești, și te ajută să rămâi acolo.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
