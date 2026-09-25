import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ContactBlock } from '@/components/site/ContactBlock'
import { Idx } from '@/components/ui/Idx'
import { Arrow } from '@/components/ui/icons'
import { pageMetadata } from '@/lib/seo'
import cover from '@/assets/img/balance-wave/lifestyle-birou.webp'

export const metadata: Metadata = pageMetadata({
  title: 'Despre noi',
  description:
    'Biohack Tech aduce acasă tehnologii din neuroștiință: neuromodulare EEG, photobiomodulare și stimularea nervului vag. Valorile după care alegem produsele.',
  path: '/about-us',
})

// Edited from the source "Despre noi" page (typos and a missing negation fixed).
const values = [
  { title: 'Abordare umană', text: 'Tehnologia este doar un instrument. Scopul nostru este să te simți mai bine, pe termen lung.' },
  { title: 'Inovație demonstrată', text: 'Nu urmărim tendințe trecătoare. Inovăm doar acolo unde rezultatele pot fi măsurate.' },
  { title: 'Știință aplicată', text: 'Fiecare produs și fiecare program de utilizare pornește de la cercetarea în neuroștiință.' },
  { title: 'Transparență', text: 'Îți explicăm clar cum funcționează tehnologia și îți dăm acces la datele tale.' },
  { title: 'Adaptare pe profilul tău', text: 'Fiecare creier e diferit. Modul în care folosești dispozitivele se potrivește obiectivelor tale.' },
]

export default function AboutPage() {
  return (
    <>
      <section className="on-dark bg-dark pt-[calc(var(--nav-h)+64px)] text-white max-sm:pt-[calc(var(--nav-h)+32px)]">
        <div className="wrap grid items-end gap-y-6 md:grid-cols-12 md:gap-x-6">
          <div className="md:col-span-7">
            <Idx n="Despre noi">Biohack Tech</Idx>
            <h1 className="h1 !text-white">
              Tehnologie pentru sănătatea creierului, <em className="not-italic text-cyan">direct acasă</em>.
            </h1>
          </div>
          <p className="text-[17px] text-dark-muted md:col-span-5 md:col-start-8 lg:col-span-4 lg:col-start-9">
            Transformăm protocoale complexe în instrumente practice, pe care oricine le poate folosi ca să trăiască mai bine.
          </p>
        </div>
        <div className="mt-14 bg-[linear-gradient(var(--color-dark)_0_50%,var(--color-paper)_50%)] max-sm:mt-10">
          <div className="wrap">
            <div className="relative aspect-[16/7] overflow-hidden rounded-[24px] max-sm:aspect-[4/3] max-sm:rounded-[16px]">
              <Image src={cover} alt="Femeie la birou, purtând Balance Wave în timpul unei pauze" fill priority placeholder="blur" sizes="(min-width: 1152px) 1104px, 100vw" className="object-cover object-[center_35%]" />
            </div>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap grid gap-y-10 md:grid-cols-12 md:gap-x-6">
          <div className="md:col-span-4">
            <Idx n="01">Valori</Idx>
            <h2 className="h2 rev">Principiile după care lucrăm</h2>
            <p className="sub rev mt-4">Cum alegem tehnologia, cum construim protocoalele și cum facem fiecare recomandare.</p>
          </div>
          <ol className="rev md:col-span-7 md:col-start-6">
            {values.map((v, i) => (
              <li key={v.title} className="grid grid-cols-[48px_1fr] gap-4 border-t border-mist-2 py-5 last:border-b">
                <span className="pt-1 font-mono text-[12px] tracking-[0.08em] text-cyan-700">0{i + 1}</span>
                <div>
                  <h3 className="h3">{v.title}</h3>
                  <p className="mt-1 text-muted">{v.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="pb-[var(--sec)]">
        <div className="wrap">
          <div className="rev flex flex-wrap items-end justify-between gap-6 border-t border-mist-2 pt-10">
            <div>
              <h2 className="text-[26px] tracking-[-0.03em] max-sm:text-[22px]">Începe să îți înțelegi creierul</h2>
              <p className="mt-2 max-w-[34em] text-muted">BrainLink Pro îți arată în timp real cum se schimbă focusul și relaxarea.</p>
            </div>
            <Link href="/products/brainlink" className="tlink">
              Vezi BrainLink Pro <Arrow />
            </Link>
          </div>
          <div className="mt-16">
            <ContactBlock />
          </div>
        </div>
      </section>
    </>
  )
}
