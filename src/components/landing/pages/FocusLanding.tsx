import Image from 'next/image'
import { Arrow } from '@/components/ui/icons'
import { getProduct } from '@/content/catalog'
import type { Landing } from '@/content/landings'
import { terms } from '@/config/site'
import { formatLei } from '@/lib/money'
import { HeroCta } from '../HeroCta'
import { LandingOffer } from '../LandingOffer'
import { FinalCta, Help, Kicker, LandingFaq, LandingShell, Lead, Specs, Steps, Testimonials, Title } from '../kit'

import studio from '@/assets/img/brainlink/casca-studio.webp'
import tableta from '@/assets/img/brainlink/pillar-games.webp'
import componente from '@/assets/img/brainlink/componente.webp'
import birou from '@/assets/img/brainlink/result-focus.webp'
import meditatie from '@/assets/img/brainlink/result-meditation.webp'
import lateral from '@/assets/img/brainlink/casca-lateral.webp'

const CTA = 'Comandă NEUROS Focus'

/**
 * NEUROS Focus: a precise, bright page. From the idea (attention you can train, as a game) to what the
 * headset reads, how the app turns it into play, where it is used, the facts, and the purchase.
 */
export function FocusLanding({ landing }: { landing: Landing }) {
  const p = getProduct(landing.productId)!
  return (
    <LandingShell landing={landing} heroTone="dark" cta="Comandă">
      {/* Hero: text left; the headset in the studio, the person with the tablet overlapping. */}
      <section id="lp-hero" aria-labelledby="lp-title" className="lp-wrap pt-28 pb-[var(--sec)] max-sm:pt-24">
        <div className="grid items-center gap-y-12 lg:grid-cols-12 lg:gap-x-12">
          <div className="lg:col-span-5">
            <Kicker>{p.name} · pentru atenție</Kicker>
            <h1 id="lp-title" className="mt-4 text-[clamp(40px,5vw,72px)] leading-[0.98] tracking-[-0.045em]">
              Atenția ta, antrenată prin joc.
            </h1>
            <p className="mt-5 max-w-[28em] text-[clamp(17px,1.3vw,19px)] leading-snug text-[var(--lp-muted)]">
              Pui casca și deschizi un joc pe tabletă. Jocul înaintează doar cât timp ești atent.
            </p>
            <p className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-[30px] font-medium tracking-[-0.03em] tabular-nums">{p.price !== null && formatLei(p.price)}</span>
              <span className="text-[14px] text-[var(--lp-muted)]">{terms.vat} · livrare gratuită</span>
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <HeroCta slug={landing.slug} productId={p.id} label={CTA} />
              <a href="#cum" className="tlink">
                Cum funcționează <Arrow />
              </a>
            </div>
          </div>
          <div className="relative lg:col-span-7">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[32px] bg-white">
              <Image src={studio} alt="NEUROS Focus, casca, fotografiată în studio" fill priority placeholder="blur" sizes="(min-width: 1152px) 660px, 100vw" className="object-cover" />
            </div>
            <div className="absolute -bottom-10 -left-6 w-[44%] overflow-hidden rounded-[22px] shadow-[0_30px_60px_-30px_rgba(8,17,19,.55)] ring-4 ring-[var(--lp-bg)] max-sm:-left-2 max-sm:w-[50%]">
              <div className="relative aspect-[4/3]">
                <Image src={tableta} alt="Tânăr pe canapea, purtând NEUROS Focus și jucând pe tabletă" fill placeholder="blur" sizes="300px" className="object-cover object-[65%_50%]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What it does, in three numbers. */}
      <section aria-labelledby="ce-face" className="border-y border-[var(--lp-line)] bg-white">
        <h2 id="ce-face" className="sr-only">
          Ce face
        </h2>
        <dl className="lp-wrap grid gap-y-8 py-12 sm:grid-cols-3 sm:gap-x-10">
          {[
            ['3', 'senzori EEG', 'Citesc semnalele electrice foarte slabe ale creierului.'],
            ['10+', 'jocuri și meditații', 'În aplicația Neuros Game, pe tabletă.'],
            ['4 h', 'de baterie', 'După o oră de încărcare. Se conectează prin Bluetooth.'],
          ].map(([big, label, text]) => (
            <div key={label}>
              <dt className="flex items-baseline gap-3">
                <span className="text-[56px] leading-none font-medium tracking-[-0.05em] text-[var(--lp-accent)] tabular-nums">{big}</span>
                <span className="text-[18px] font-medium">{label}</span>
              </dt>
              <dd className="mt-2 max-w-[22em] text-[15.5px] leading-relaxed text-[var(--lp-muted)]">{text}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* How it works: signal, app, game. */}
      <section id="cum" aria-labelledby="cum-title" className="lp-wrap scroll-mt-10 pt-[var(--sec)]">
        <Kicker>Cum funcționează</Kicker>
        <Title id="cum-title" className="mt-3 max-w-[14em]">
          Casca citește atenția. Aplicația o face joc.
        </Title>
        <div className="mt-10 grid items-center gap-y-10 lg:grid-cols-12 lg:gap-x-12">
          <div className="relative aspect-[16/9] overflow-hidden rounded-[28px] bg-[#f6f6f6] lg:col-span-7">
            <Image src={componente} alt="NEUROS Focus în interior: carcasa, placa electronică, bateria și difuzorul" fill sizes="(min-width: 1152px) 660px, 100vw" className="object-contain p-[4%]" />
          </div>
          <ol className="space-y-6 lg:col-span-5">
            {[
              ['Semnalul', 'Creierul produce semnale electrice foarte slabe. Cei trei senzori ai căștii le citesc.'],
              ['Aplicația', 'Neuros Game transformă semnalul în joc, în timp real.'],
              ['Jocul', 'Când ești atent, jocul înaintează. Așa înveți treptat să ajungi mai ușor în starea potrivită.'],
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
          Casca recunoaște stări, precum concentrarea și relaxarea. Gândurile rămân ale tale. Metoda vine din cercetarea despre biofeedback.
        </p>
      </section>

      {/* Where it is used. */}
      <section aria-labelledby="unde" className="mt-[var(--sec)] bg-[var(--lp-ink)] py-[var(--sec)] text-white">
        <div className="lp-wrap grid gap-y-10 lg:grid-cols-12 lg:gap-x-12">
          <div className="lg:col-span-7">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[28px]">
              <Image src={birou} alt="Bărbat la birou, concentrat, purtând NEUROS Focus" fill placeholder="blur" sizes="(min-width: 1152px) 660px, 100vw" className="object-cover" />
            </div>
          </div>
          <div className="on-dark flex flex-col lg:col-span-5">
            <p className="text-[13px] font-semibold tracking-[0.14em] text-cyan uppercase">Unde o folosești</p>
            <h2 id="unde" className="mt-3 text-[clamp(32px,3.6vw,48px)] leading-[1.02] tracking-[-0.04em] !text-white">
              La muncă, la studiu, înainte de o sarcină grea.
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed text-white/80">O sesiune scurtă te poate ajuta să intri mai repede în concentrare.</p>
            <div className="mt-auto pt-10">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[20px]">
                <Image src={meditatie} alt="Femeie meditând în grădină, purtând NEUROS Focus" fill placeholder="blur" sizes="(min-width: 1152px) 440px, 100vw" className="object-cover" />
              </div>
              <p className="mt-3 text-[15.5px] text-white/75">Și pentru meditație: vezi în timp real cât de relaxat ești.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How to use it + the facts. */}
      <section aria-labelledby="folosire" className="lp-wrap pt-[var(--sec)]">
        <Kicker>Cum o folosești</Kicker>
        <Title id="folosire" className="mt-3">
          Trei pași.
        </Title>
        <Steps
          className="mt-10"
          items={[
            { title: 'Pui casca și o pornești.' },
            { title: 'O conectezi la tabletă.', text: 'Prin Bluetooth, din aplicația Neuros Game.' },
            { title: 'Alegi un joc sau o meditație.', text: 'Fiecare sesiune rămâne salvată.' },
          ]}
        />
      </section>

      <section aria-labelledby="detalii" className="lp-wrap pt-[var(--sec)]">
        <div className="grid items-start gap-y-10 lg:grid-cols-12 lg:gap-x-12">
          <div className="lg:col-span-5">
            <Kicker>Detalii</Kicker>
            <Title id="detalii" className="mt-3">
              Ce primești.
            </Title>
            <Lead className="mt-3 max-w-[24em] text-[var(--lp-muted)]">Casca NEUROS Focus. Aplicația Neuros Game o instalezi pe tableta ta.</Lead>
            <div className="relative mt-8 aspect-[16/9] rounded-[24px] bg-white">
              <Image src={lateral} alt="NEUROS Focus văzută din lateral, cu senzorul de ureche" fill sizes="440px" className="object-contain p-[10%]" />
            </div>
          </div>
          <Specs
            className="lg:col-span-7"
            rows={[
              ['Senzori', '3 senzori EEG'],
              ['Aplicație', 'Neuros Game: peste 10 jocuri și meditații ghidate'],
              ['Conectare', 'Bluetooth, la tabletă'],
              ['Ai nevoie de', 'O tabletă'],
              ['Baterie', 'Până la 4 ore, după o oră de încărcare'],
              ['Certificări', 'CE, FCC'],
              ['Model hardware', 'BrainLink Pro'],
              ['Ghidaj', 'Un specialist îți recomandă jocurile și programul'],
              ['Garanție', `${terms.warrantyYears} ani`],
            ]}
          />
        </div>
      </section>

      <LandingOffer slug={landing.slug} productId={p.id} cta={CTA} title="NEUROS Focus, gata de joc." text="Casca vine acasă, cu livrare gratuită. Aplicația o descarci pe tabletă." />
      <Testimonials productId={p.id} />
      <LandingFaq items={landing.faqs} />
      <Help title="Nu știi dacă ți se potrivește?" text="Spune-ne pentru ce vrei să o folosești: muncă, studiu sau relaxare. Îți recomandăm cum să începi." />
      <FinalCta productId={p.id} line="Trei senzori, o tabletă și jocuri care înaintează când ești atent." cta={CTA} />
    </LandingShell>
  )
}
