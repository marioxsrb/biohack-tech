/**
 * The end of the Romanian NEUROS Amber page: the details, the questions before ordering, and a closing block on the
 * evening scene with both pairs that sends the visitor back to the buy area.
 */
import Image from 'next/image'

import { Faq } from '@/components/ui/Faq'
import { site, terms } from '@/config/site'
import { amberFaq } from '@/content/amber-story'
import type { ProductContent } from '@/content/product-content'
import perechi from '@/assets/img/glasses/subtire-noptiera-set.webp'

const titleClass = 'text-[clamp(30px,3.2vw,46px)] leading-[1.05] tracking-[-0.04em] text-balance'

export function AmberClosing({ specs }: { specs: ProductContent['specs'] }) {
  return (
    <>
      <section aria-labelledby="detalii-amber" className="wrap pb-[var(--sec)]">
        <div className="grid gap-8 rounded-[28px] bg-paper p-[clamp(24px,4.5vw,56px)] md:grid-cols-12">
          <h2 id="detalii-amber" className="text-[26px] tracking-[-0.03em] md:col-span-4">
            Detalii
          </h2>
          <dl className="md:col-span-8">
            {specs.map((s) => (
              <div key={s.label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 border-t border-mist-2 py-3.5 text-[15.5px] last:border-b">
                <dt className="text-muted">{s.label}</dt>
                <dd className="text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section aria-labelledby="intrebari-amber" className="wrap pb-[var(--sec)]">
        <div className="grid gap-8 md:grid-cols-12">
          <div className="md:col-span-4">
            <h2 id="intrebari-amber" className={`${titleClass} md:sticky md:top-[calc(var(--nav-h)+32px)]`}>
              Întrebări înainte de comandă
            </h2>
          </div>
          <div className="md:col-span-8">
            <Faq items={amberFaq} />
          </div>
        </div>
      </section>

      <section id="buy-again" aria-labelledby="final-amber" className="wrap pb-10">
        <div className="relative isolate overflow-hidden rounded-[32px] bg-dark text-white">
          <Image src={perechi} alt="" fill placeholder="blur" sizes="(min-width: 1152px) 1104px, 100vw" className="-z-10 object-cover object-[50%_78%]" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(11,19,22,0.88)_0%,rgba(11,19,22,0.7)_45%,rgba(11,19,22,0.2)_100%)] max-md:bg-[linear-gradient(180deg,rgba(11,19,22,0.45)_0%,rgba(11,19,22,0.9)_60%)]" />
          <div className="max-w-[34em] px-[clamp(24px,5vw,72px)] py-[clamp(56px,8vw,112px)] max-md:pt-[44vw]">
            <h2 id="final-amber" className="text-[clamp(32px,3.8vw,54px)] leading-[1.04] tracking-[-0.04em] !text-white text-balance">
              Galben de la apus. Roșu în ultima oră.
            </h2>
            <p className="mt-5 text-[18px] leading-relaxed text-white/85">Alegi rama, apoi lentilele: una dintre ele sau pachetul cu amândouă, pentru toată seara.</p>
            <a href="#cumpara" className="cta mt-8 max-sm:!w-full">
              Alege-ți perechea
            </a>
            <p className="mt-4 text-[14px] text-white/75">Plată la livrare · Livrare gratuită · Garanție {terms.warrantyYears} ani · Retur în {terms.returnDays} zile</p>
            <p className="mt-8 border-t border-white/15 pt-6 text-[15px] leading-relaxed text-white/80">
              Ai o întrebare înainte de comandă? Scrie-ne la{' '}
              <a href={`mailto:${site.email}`} className="font-semibold text-white underline decoration-white/40 underline-offset-2 hover:decoration-white">
                {site.email}
              </a>{' '}
              sau sună la{' '}
              <a href={site.phoneHref} className="font-semibold whitespace-nowrap text-white underline decoration-white/40 underline-offset-2 hover:decoration-white">
                {site.phone}
              </a>
              .
            </p>
          </div>
        </div>
        <p className="py-8 text-[13px] leading-relaxed text-muted">NEUROS Amber este un produs de wellness. Nu îl folosi la volan noaptea. Pentru o afecțiune, cere întâi sfatul medicului. Rezultatele diferă de la o persoană la alta.</p>
      </section>
    </>
  )
}
