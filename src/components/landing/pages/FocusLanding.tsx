import Image from 'next/image'
import { Arrow } from '@/components/ui/icons'
import { getProduct } from '@/content/catalog'
import type { Landing } from '@/content/landings'
import { terms } from '@/config/site'
import { formatLei } from '@/lib/money'
import { HeroCta } from '../HeroCta'
import { LandingOffer } from '../LandingOffer'
import { FinalCta, Help, Kicker, LandingFaq, LandingShell, Testimonials, Title } from '../kit'

import studio from '@/assets/img/brainlink/casca-studio.webp'
import tableta from '@/assets/img/brainlink/pillar-games.webp'
import componente from '@/assets/img/brainlink/componente.webp'
import birou from '@/assets/img/brainlink/result-focus.webp'
import meditatie from '@/assets/img/brainlink/result-meditation.webp'

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
              <Image src={studio} alt="NEUROS Focus, casca, fotografiată în studio" fill preload placeholder="blur" sizes="(min-width: 1152px) 660px, 100vw" className="object-cover" />
            </div>
            <div className="absolute -bottom-10 -left-6 w-[44%] overflow-hidden rounded-[22px] shadow-[0_30px_60px_-30px_rgba(8,17,19,.55)] ring-4 ring-[var(--lp-bg)] max-sm:left-3 max-sm:-bottom-8 max-sm:w-[46%]">
              <div className="relative aspect-[4/3]">
                <Image src={tableta} alt="Tânăr pe canapea, purtând NEUROS Focus și jucând pe tabletă" fill placeholder="blur" sizes="300px" className="object-cover object-[65%_50%]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works: signal, app, game. */}
      <section id="cum" aria-labelledby="cum-title" className="lp-wrap scroll-mt-10 pt-[calc(var(--sec)*0.6)]">
        <Kicker>Cum funcționează</Kicker>
        <Title id="cum-title" className="mt-3 max-w-[14em]">
          Casca citește atenția. Aplicația o transformă în joc.
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

      <LandingOffer
        slug={landing.slug}
        productId={p.id}
        cta={CTA}
        title="NEUROS Focus, gata de joc."
        text="Casca ajunge la tine acasă. Aplicația Neuros Game o instalezi pe tableta ta."
        details={[
          ['Senzori', '3 senzori EEG'],
          ['Aplicație', 'Neuros Game: peste 10 jocuri și meditații ghidate'],
          ['Ai nevoie de', 'O tabletă, conectată prin Bluetooth'],
          ['Baterie', 'Până la 4 ore, după o oră de încărcare'],
          ['Certificări', 'CE, FCC'],
          ['Model hardware', 'BrainLink Pro'],
          ['Ghidaj', 'Un specialist îți recomandă jocurile și programul'],
        ]}
      />
      <Testimonials productId={p.id} />
      <LandingFaq items={landing.faqs} />
      <Help title="Nu știi dacă ți se potrivește?" text="Spune-ne pentru ce vrei să o folosești: muncă, studiu sau relaxare. Îți recomandăm cum să începi." />
      <FinalCta title="Pui casca. Deschizi primul joc." cta={CTA} />
    </LandingShell>
  )
}
