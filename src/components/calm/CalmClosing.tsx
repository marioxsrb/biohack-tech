/**
 * The end of the Romanian NEUROS Calm page, after the science: what's in the box (the flat-lay with
 * every object numbered) beside the specifications, the questions before ordering, and a closing
 * block that goes back to the evening scene with the price and the order button. Approved copy.
 */
import Image from 'next/image'

import { BuyNowButton } from '@/components/cart/BuyNowButton'
import { Price } from '@/components/cart/Price'
import { Faq } from '@/components/ui/Faq'
import { site, terms } from '@/config/site'
import { LOW_STOCK } from '@/content/catalog'
import type { ProductContent } from '@/content/product-content'
import continut from '@/assets/img/balance-wave/ce-e-in-cutie.webp'
import seara from '@/assets/img/balance-wave/lifestyle-canapea.webp'

const titleClass = 'text-[clamp(30px,3.2vw,46px)] leading-[1.05] tracking-[-0.04em] text-balance'

// ── 9. Ce găsești în cutie ─────────────────────────────────────────────────────

/** `at`: where the object sits on the flat-lay (percent of width, height); none when it isn't pictured. */
const BOX: { title: string; text: string; at?: [number, number] }[] = [
  { title: 'Dispozitivul NEUROS Calm', text: 'Aparatul care se așază la gât, cu 6 diode infraroșii pe partea stângă și lumină roșie pe restul gâtului.', at: [17, 74] },
  { title: 'Cordonul de prindere la nas', text: 'Cordonul care trimite lumina pulsatilă direct la terminația nervului vag.', at: [83, 64] },
  { title: 'Cablul de încărcare', text: 'Cablul cu care îl încarci, ca pe telefon.' },
  { title: 'Ghidul de folosire în română', text: 'Pașii de început, pe o singură pagină.', at: [52, 70] },
  { title: 'Cutia', text: 'O cutie îngrijită, bună și de dat cadou.', at: [26, 24] },
]

function InTheBox() {
  return (
    <section aria-labelledby="in-cutie" className="wrap pb-[var(--sec)]">
      <h2 id="in-cutie" className={titleClass}>
        Ce găsești în cutie
      </h2>
      <p className="mt-3 max-w-[30em] text-[17px] leading-relaxed text-muted md:text-[18px]">Deschizi cutia și îl pui la gât direct.</p>

      <div className="mt-8 grid overflow-hidden rounded-[28px] bg-paper md:mt-10 md:grid-cols-12">
        <figure className="relative md:col-span-7">
          <Image src={continut} alt="Conținutul cutiei NEUROS Calm, așezat pe o suprafață albă, văzut de sus" placeholder="blur" sizes="(min-width: 768px) 640px, 100vw" className="h-auto w-full" />
          {BOX.map((b, i) =>
            b.at ? (
              <span
                key={b.title}
                aria-hidden
                className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ink text-[14px] font-semibold text-white shadow-[0_0_0_4px_rgba(255,255,255,0.9),0_8px_20px_rgba(11,19,22,0.25)] tabular-nums"
                style={{ left: `${b.at[0]}%`, top: `${b.at[1]}%` }}
              >
                {i + 1}
              </span>
            ) : null,
          )}
        </figure>
        <ol className="divide-y divide-mist-2 p-[clamp(20px,3.5vw,44px)] md:col-span-5">
          {BOX.map((b, i) => (
            <li key={b.title} className="flex gap-4 py-4 first:pt-0 last:pb-0">
              <span className={`mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full text-[14px] font-semibold tabular-nums ${b.at ? 'bg-ink text-white' : 'bg-mist text-muted'}`}>{i + 1}</span>
              <div>
                <h3 className="text-[17px] leading-snug font-medium tracking-[-0.015em] text-ink">{b.title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-text">{b.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Specs({ specs }: { specs: ProductContent['specs'] }) {
  return (
    <section aria-labelledby="detalii" className="wrap pb-[var(--sec)]">
      <div className="grid gap-8 rounded-[28px] bg-paper p-[clamp(24px,4.5vw,56px)] md:grid-cols-12">
        <h2 id="detalii" className="text-[26px] tracking-[-0.03em] md:col-span-4">
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
  )
}

// ── 10. Întrebări înainte de comandă ───────────────────────────────────────────

const FAQ: { q: string; a: string }[] = [
  { q: 'În cât timp simt o schimbare?', a: 'Unii oameni simt o stare mai așezată din primele seri. Pentru somn, îți recomandăm să îl folosești zilnic câteva săptămâni, ca să vezi cum răspunde corpul tău.' },
  { q: 'Cum știu că funcționează la mine?', a: 'Metoda se numește fotobiomodulare și e studiată din 1967. Cel mai bun test rămâne seara ta. Dacă porți un inel sau un ceas de somn, urmărește datele câteva săptămâni.' },
  { q: 'Cât durează o ședință?', a: 'Câteva minute. Aparatul se oprește singur, așa că poți închide ochii liniștit.' },
  { q: 'Îl pot folosi în fiecare seară?', a: 'Da. E gândit pentru o ședință scurtă pe zi, ca parte din rutina de seară.' },
  { q: 'Pot să lucrez în timp ce îl port?', a: 'Da. Poți citi, medita sau lucra ușor cât timp e pornit.' },
  { q: 'Cum e față de stimulatorii cu electrozi?', a: 'NEUROS Calm lucrează cu lumină. Îl pui la gât, apeși un buton, iar pielea rămâne curată. Stimulatorii cu electrozi trimit curent prin piele și au nevoie de gel.' },
  { q: 'Merge împreună cu Oura, Whoop sau Garmin?', a: 'Da. Porți inelul sau ceasul ca de obicei și urmărești somnul în aplicația ta.' },
  { q: 'Cine ar trebui să întrebe întâi medicul?', a: 'Dacă ești însărcinată, ai o afecțiune a tiroidei, porți un implant sau iei medicamente care te fac sensibil la lumină, vorbește întâi cu medicul tău. La fel pentru orice afecțiune.' },
  { q: 'Cum plătesc?', a: 'La livrare, cu cardul sau prin transfer bancar. Livrarea e gratuită în toată țara.' },
  { q: 'Ce garanție are?', a: `${terms.warrantyYears} ani. Dacă ai o întrebare, ne scrii sau ne suni și îți răspundem în cel mult 24 de ore.` },
  { q: 'Pot comanda pentru firmă?', a: 'Da. De la 25 de bucăți de NEUROS Calm și Focus primești 40% reducere și factură pe firmă.' },
  // From the earlier FAQ, kept.
  { q: 'Cum încep?', a: 'Îl încarci, îl așezi la gât și apeși butonul. Câteva minute de liniște, apoi se oprește singur. Dacă vrei să știi cum ți se potrivește, ne scrii sau ne suni.' },
  { q: 'Ce fel de produs este?', a: 'Un produs de wellness, pentru calm în fiecare zi. Susține relaxarea. Pentru o afecțiune, vorbește întâi cu medicul tău.' },
]

function Questions() {
  return (
    <section aria-labelledby="intrebari" className="wrap pb-[var(--sec)]">
      <div className="grid gap-8 md:grid-cols-12">
        <div className="md:col-span-4">
          <h2 id="intrebari" className={`${titleClass} md:sticky md:top-[calc(var(--nav-h)+32px)]`}>
            Întrebări înainte de comandă
          </h2>
        </div>
        <div className="md:col-span-8">
          <Faq items={FAQ} />
        </div>
      </div>
    </section>
  )
}

// ── 11. Blocul de final ────────────────────────────────────────────────────────

function Closing({ productId }: { productId: Parameters<typeof BuyNowButton>[0]['productId'] }) {
  return (
    <section aria-labelledby="final" className="wrap pb-10">
      <div className="relative isolate overflow-hidden rounded-[32px] bg-dark text-white">
        <Image src={seara} alt="" fill placeholder="blur" sizes="(min-width: 1152px) 1104px, 100vw" className="-z-10 object-cover object-[70%_center]" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(11,19,22,0.88)_0%,rgba(11,19,22,0.72)_45%,rgba(11,19,22,0.25)_100%)] max-md:bg-[linear-gradient(180deg,rgba(11,19,22,0.55)_0%,rgba(11,19,22,0.9)_60%)]" />
        <div className="max-w-[34em] px-[clamp(24px,5vw,72px)] py-[clamp(56px,8vw,112px)] max-md:pt-[44vw]">
          <h2 id="final" className="text-[clamp(32px,3.8vw,54px)] leading-[1.04] tracking-[-0.04em] !text-white text-balance">
            Seara ta liniștită începe cu un singur buton.
          </h2>
          <p className="mt-5 text-[18px] leading-relaxed text-white/85">Câteva minute cu NEUROS Calm la gât, apoi lași ziua în urmă și adormi mai ușor.</p>
          {LOW_STOCK.includes(productId) && (
            <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.15)]">
              <span aria-hidden className="h-2 w-2 rounded-full bg-[#f5b544]" />
              Doar câteva bucăți rămase
            </p>
          )}
          <p className="mt-4 text-[28px] font-medium tracking-[-0.02em]">
            <Price productId={productId} />
            <span className="ml-3 align-middle text-[14px] font-normal tracking-normal text-white/70">TVA inclus</span>
          </p>
          <div className="mt-5">
            <BuyNowButton productId={productId} pay="online" title="Vreau serile mai liniștite" className="max-sm:!w-full" />
          </div>
          <p className="mt-4 text-[14px] text-white/75">Plată la livrare · Livrare gratuită · Garanție {terms.warrantyYears} ani</p>
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
      <p className="py-8 text-[13px] leading-relaxed text-muted">NEUROS Calm este un produs de wellness. Pentru o afecțiune, cere întâi sfatul medicului. Rezultatele diferă de la o persoană la alta.</p>
    </section>
  )
}

/** Sections 9–11 of the Romanian NEUROS Calm page. */
export function CalmClosing({ productId, specs }: { productId: Parameters<typeof BuyNowButton>[0]['productId']; specs: ProductContent['specs'] }) {
  return (
    <>
      <InTheBox />
      <Specs specs={specs} />
      <Questions />
      <Closing productId={productId} />
    </>
  )
}
