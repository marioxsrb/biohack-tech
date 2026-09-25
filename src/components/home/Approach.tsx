import Image from 'next/image'
import Link from 'next/link'
import { Idx } from '@/components/ui/Idx'
import { Arrow } from '@/components/ui/icons'
import barbat from '@/assets/img/brainlink/lifestyle-barbat.webp'

const points = [
  { title: 'Extern și non-invaziv', text: 'Toate produsele se folosesc la suprafață, fără proceduri. Sunt gândite pentru utilizare repetată acasă.' },
  { title: 'Progres pe care îl vezi', text: 'Cu BrainLink Pro, fiecare sesiune produce date în Neuros Game, ca să îți urmărești evoluția în timp.' },
  { title: 'Recomandare pe obiectivul tău', text: 'Somn, focus sau relaxare: îți spunem ce produs și ce protocol se potrivesc.' },
]

/** Editorial split: the figure sits on an offset mist block that bleeds off the page edge. */
export function Approach() {
  return (
    <section className="sec overflow-hidden" aria-labelledby="approach-title">
      <div className="wrap grid grid-cols-1 items-center gap-y-12 md:grid-cols-12 md:gap-x-6">
        <figure className="rev relative md:col-span-6">
          <div
            aria-hidden
            className="absolute inset-y-0 right-6 -left-[50vw] -z-10 rounded-r-[24px] bg-mist max-sm:right-0 max-sm:rounded-none"
          />
          <div className="py-10 pr-10 max-sm:py-6 max-sm:pr-0">
            <Image
              src={barbat}
              alt="Bărbat relaxat, cu ochii închiși, purtând casca EEG BrainLink Pro"
              sizes="(min-width: 1152px) 540px, (min-width: 768px) 48vw, 100vw"
              placeholder="blur"
              className="w-full rounded-[16px]"
            />
          </div>
          <figcaption className="mono mt-3 max-w-[40ch] !text-[11px] leading-relaxed">
            BrainLink Pro, sesiune de relaxare
          </figcaption>
        </figure>

        <div className="md:col-span-6 md:col-start-7 lg:col-span-5 lg:col-start-8">
          <Idx n="04">Abordare</Idx>
          <h2 id="approach-title" className="h2 rev">
            Neuroștiință aplicată, pentru acasă.
          </h2>
          <p className="sub rev mt-4">
            Produsele pornesc de la cercetarea în neuroștiință și photobiomodulare. Rezultatele variază de la o persoană la alta.
          </p>
          <ul className="rev mt-8 border-t border-mist-2">
            {points.map((p) => (
              <li key={p.title} className="border-b border-mist-2 py-4">
                <h3 className="h3">{p.title}</h3>
                <p className="mt-1 text-[15.5px] text-muted">{p.text}</p>
              </li>
            ))}
          </ul>
          <Link href="/products/brainlink#studii" className="tlink rev mt-4">
            Ce spune literatura științifică <Arrow />
          </Link>
        </div>
      </div>
    </section>
  )
}
