import type { Metadata } from 'next'
import Image from 'next/image'
import Link from '@/components/ui/Link'
import { Arrow } from '@/components/ui/icons'
import { getLocale } from '@/i18n/server'
import { pageMetadata } from '@/lib/seo'
import cover from '@/assets/img/brainlink/lifestyle-barbat.webp'

// From the source "Despre noi" page, rewritten short.
const COPY = {
  ro: {
    title: 'Despre noi',
    description: 'Biohack Tech vinde dispozitivele NEUROS pentru relaxare, concentrare și ecrane. Cum alegem produsele și cum te ajutăm să începi.',
    alt: 'Bărbat relaxat, cu ochii închiși, purtând casca NEUROS Focus',
    heading: 'Despre Biohack Tech',
    lead: 'Biohack Tech vinde dispozitivele NEUROS, pentru relaxare, concentrare și ecrane. Le folosești acasă, câteva minute pe zi.',
    values: [
      { title: 'Simplu de folosit', text: 'Un produs simplu ajunge să fie folosit zilnic. De aceea alegem produse care îți cer câteva minute pe zi.' },
      { title: 'Bazat pe cercetare', text: 'Pornim de la studii despre metodele folosite de produse. Îți spunem deschis ce arată cercetarea și unde se oprește.' },
      { title: 'Adaptat ție', text: 'Un specialist te ajută să începi și îți potrivește programul după ce vrei să obții.' },
    ],
    products: 'Vezi produsele',
    write: 'Scrie-ne',
  },
  en: {
    title: 'About us',
    description: 'Biohack Tech sells NEUROS devices for relaxation, focus and screens. How we choose our products and how we help you start.',
    alt: 'Relaxed man with his eyes closed, wearing the NEUROS Focus headband',
    heading: 'About Biohack Tech',
    lead: 'Biohack Tech sells NEUROS devices for relaxation, focus and screens. You use them at home, a few minutes a day.',
    values: [
      { title: 'Easy to use', text: 'A simple product is one you use every day. That is why we choose products that ask for a few minutes a day.' },
      { title: 'Based on research', text: 'We start from studies on the methods our products use. We tell you openly what the research shows and where it stops.' },
      { title: 'Made for you', text: 'A specialist helps you start and fits the programme to what you want to achieve.' },
    ],
    products: 'See the products',
    write: 'Write to us',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const { title, description } = COPY[locale]
  return pageMetadata({ title, description, path: '/about-us', locale })
}

export default async function AboutPage() {
  const t = COPY[await getLocale()]
  return (
    <>
      <section data-theme="dark" className="relative isolate flex h-[78svh] min-h-[520px] items-end overflow-hidden bg-dark text-white">
        <Image src={cover} alt={t.alt} fill loading="eager" fetchPriority="high" placeholder="blur" sizes="100vw" className="-z-10 object-cover object-[60%_center]" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(8,17,19,.7)_0%,rgba(8,17,19,0)_55%)]" />
        <div className="wrap w-full pb-[clamp(48px,9vh,96px)]">
          <h1 className="max-w-[11em] text-[clamp(40px,5.4vw,78px)] leading-[0.98] tracking-[-0.045em] !text-white">
            {t.heading}
          </h1>
        </div>
      </section>

      <section className="py-[var(--sec)]">
        <div className="wrap grid grid-cols-1 gap-y-12 md:grid-cols-12 md:gap-x-6">
          <p className="text-[clamp(22px,2.2vw,30px)] leading-snug tracking-[-0.02em] text-ink md:col-span-6">
            {t.lead}
          </p>
          <ul className="space-y-10 md:col-span-5 md:col-start-8">
            {t.values.map((v) => (
              <li key={v.title} >
                <h2 className="text-[22px] tracking-[-0.025em]">{v.title}</h2>
                <p className="mt-2 text-[17px] leading-relaxed text-text">{v.text}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="wrap mt-16 flex flex-wrap gap-x-8 gap-y-2">
          <Link href="/products" className="tlink">
            {t.products} <Arrow />
          </Link>
          <Link href="/contact-us" className="tlink">
            {t.write} <Arrow />
          </Link>
        </div>
      </section>
    </>
  )
}
