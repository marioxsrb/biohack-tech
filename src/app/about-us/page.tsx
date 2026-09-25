import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Arrow } from '@/components/ui/icons'
import { pageMetadata } from '@/lib/seo'
import cover from '@/assets/img/brainlink/lifestyle-barbat.webp'

export const metadata: Metadata = pageMetadata({
  title: 'Despre noi',
  description: 'Biohack Tech face tehnologia despre creier și corp ușor de folosit acasă. Cum alegem produsele și cum te ajutăm să începi.',
  path: '/about-us',
})

// From the source "Despre noi" page, rewritten short.
const values = [
  { title: 'Simplu de folosit', text: 'Dacă un produs e complicat, nu ajunge să fie folosit. Le alegem pe cele pe care le folosești câteva minute pe zi.' },
  { title: 'Bazat pe cercetare', text: 'Fiecare produs pornește de la studii despre creier și corp. Îți spunem deschis ce știm și ce nu.' },
  { title: 'Adaptat ție', text: 'Un specialist te ajută să începi și îți potrivește programul după ce vrei să obții.' },
]

export default function AboutPage() {
  return (
    <>
      <section data-theme="dark" className="relative isolate flex h-[78svh] min-h-[520px] items-end overflow-hidden bg-dark text-white">
        <Image src={cover} alt="Bărbat relaxat, cu ochii închiși, purtând casca BrainLink Pro" fill priority placeholder="blur" sizes="100vw" className="-z-10 object-cover object-[60%_center]" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(8,17,19,.7)_0%,rgba(8,17,19,0)_55%)]" />
        <div className="wrap w-full pb-[clamp(48px,9vh,96px)]">
          <h1 className="hero-rise max-w-[11em] text-[clamp(40px,5.4vw,78px)] leading-[0.98] tracking-[-0.045em] !text-white">
            Tehnologie pe care o folosești acasă.
          </h1>
        </div>
      </section>

      <section className="py-[var(--sec)]">
        <div className="wrap grid grid-cols-1 gap-y-12 md:grid-cols-12 md:gap-x-6">
          <p className="text-[clamp(22px,2.2vw,30px)] leading-snug tracking-[-0.02em] text-ink md:col-span-6">
            Biohack Tech aduce acasă idei din neuroștiință. Le transformăm în obiecte simple, pe care oricine le poate folosi ca să se simtă mai bine.
          </p>
          <ul className="space-y-10 md:col-span-5 md:col-start-8">
            {values.map((v) => (
              <li key={v.title} >
                <h2 className="text-[22px] tracking-[-0.025em]">{v.title}</h2>
                <p className="mt-2 text-[17px] leading-relaxed text-text">{v.text}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="wrap mt-16 flex flex-wrap gap-x-8 gap-y-2">
          <Link href="/products" className="tlink">
            Vezi produsele <Arrow />
          </Link>
          <Link href="/contact-us" className="tlink">
            Scrie-ne <Arrow />
          </Link>
        </div>
      </section>
    </>
  )
}
