/**
 * The evening story on NEUROS Calm: the night as it is, then the same night with the device.
 * Used on the product page (under the trust row) and on the calm landing / presentation.
 * Copy is the approved Romanian text. Photographs are existing product assets; the morning
 * frame is a placeholder until a real photo exists.
 */
import Image, { type StaticImageData } from 'next/image'
import type { ReactNode } from 'react'

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

function Photo({ moment }: { moment: Moment }) {
  if (moment.image) {
    return (
      <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] bg-paper">
        <Image src={moment.image} alt={moment.alt ?? ''} fill placeholder="blur" sizes="(min-width: 768px) 480px, 100vw" className="object-cover" />
      </div>
    )
  }
  if (!moment.placeholder) return null
  const { label, todo } = moment.placeholder
  return (
    <div
      role="img"
      aria-label={label}
      data-photo-todo={todo}
      className="relative aspect-[4/3] overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,#f6e6d0_0%,#f4efe6_46%,#e4eef1_100%)]"
    >
      {/* TODO: morning-getting-up — real photograph of a calm morning (soft daylight, rising from bed). No stock hotlink. */}
      <div aria-hidden className="absolute top-[16%] left-1/2 h-28 w-28 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,#f3d2a4_0%,rgba(243,210,164,0)_72%)]" />
      <p className="absolute inset-x-5 bottom-5 text-[13px] leading-snug text-muted">{label}</p>
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
  return (
    <div className={frame === 'landing' ? 'bg-[var(--lp-bg)]' : undefined}>
      <section aria-labelledby="seara-ta" className={`${wrap} ${frame === 'landing' ? 'pt-[clamp(64px,8vw,104px)]' : 'pt-10 md:pt-14'}`}>
        <h2 id="seara-ta" className={`${titleClass} max-w-[14em]`}>
          Seara ta, așa cum e acum
        </h2>
        <p className="mt-3 max-w-[28em] text-[17px] leading-relaxed text-muted md:text-[18px]">Ziua s-a terminat de câteva ore, iar corpul tău încă ține ritmul ei.</p>
        <ul className="mt-8 grid gap-3 sm:gap-4 md:mt-10 md:grid-cols-2 xl:grid-cols-6">
          {CARDS.map((c, i) => (
            <li key={c.n} className={`flex flex-col rounded-[22px] bg-paper p-5 sm:p-6 ${i < 3 ? 'xl:col-span-2' : 'xl:col-span-3'} ${i === 4 ? 'md:col-span-2 xl:col-span-3' : ''}`}>
              <span className="text-[13px] font-semibold tabular-nums text-cyan-700">{c.n}</span>
              <h3 className="mt-3 text-[18px] leading-snug font-medium tracking-[-0.02em] text-ink">{c.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-text">{c.text}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-[40em] text-[15px] leading-relaxed text-muted md:mt-8">1 din 3 români doarme prost, iar 7 din 10 dintre ei spun că stresul le strică somnul.</p>
      </section>

      <section aria-labelledby="aceeasi-seara" className={`${wrap} pt-14 pb-4 md:pt-20 md:pb-6`}>
        <h2 id="aceeasi-seara" className={`${titleClass} max-w-[16em]`}>
          Aceeași seară, cu NEUROS Calm
        </h2>
        <p className="mt-3 max-w-[26em] text-[17px] leading-relaxed text-muted md:text-[18px]">Ziua e la fel de plină. Se schimbă felul în care se termină.</p>
        <ol className="relative mt-10 border-l border-line md:mt-14">
          {MOMENTS.map((m) => {
            const visual = m.image || m.placeholder
            return (
              <li key={m.moment} className="relative pb-10 last:pb-0 md:pb-14">
                <span aria-hidden className="absolute top-[7px] -left-[5px] h-[9px] w-[9px] rounded-full bg-cyan-700" />
                <div className={`grid gap-5 pl-6 md:pl-10 ${visual ? 'md:grid-cols-12 md:items-center md:gap-10' : ''}`}>
                  <div className={visual ? 'md:col-span-6' : 'max-w-[40em]'}>
                    <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-cyan-700">{m.moment}</h3>
                    <p className="mt-2 text-[17px] leading-relaxed text-text md:text-[18px]">{m.text}</p>
                  </div>
                  {visual && (
                    <div className="md:col-span-6">
                      <Photo moment={m} />
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
        <p className="mt-8 max-w-[40em] pl-6 text-[15px] leading-relaxed text-muted md:mt-10 md:pl-10">
          Fiecare om răspunde în ritmul lui, așa că îți recomandăm să îl folosești în fiecare seară, câteva săptămâni la rând.
        </p>
        {cta && (
          <div className="mt-8 flex flex-col items-start gap-3 pl-6 md:pl-10">
            {cta}
            {note}
          </div>
        )}
      </section>
    </div>
  )
}
