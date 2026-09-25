import type { Metadata } from 'next'
import Link from 'next/link'
import { Idx } from '@/components/ui/Idx'
import { Arrow, Mail, Phone } from '@/components/ui/icons'
import { productHref, products } from '@/content/catalog'
import { site, terms } from '@/config/site'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Contact',
  description:
    'Contactează echipa Biohack Tech pentru recomandări de produse, întrebări despre comenzi și suport după achiziție. Răspundem în cel mult 24 de ore.',
  path: '/contact-us',
})

const topics = [
  { title: 'Ce produs ți se potrivește', text: 'Spune-ne ce vrei să îmbunătățești: somn, focus sau relaxare. Îți recomandăm produsul și protocolul.' },
  { title: 'Comenzi și livrare', text: 'Întrebări despre plată, livrare, retur sau factură.' },
  { title: 'Suport după achiziție', text: 'Ai deja un dispozitiv și ai nevoie de ajutor sau de detalii tehnice.' },
]

export default function ContactPage() {
  return (
    <section className="pt-[calc(var(--nav-h)+64px)] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+32px)]">
      <div className="wrap grid gap-y-12 md:grid-cols-12 md:gap-x-6">
        <div className="md:col-span-6">
          <Idx n="Contact">Biohack Tech</Idx>
          <h1 className="h1">Hai să stăm de vorbă.</h1>
          <p className="sub mt-5">
            Fie că ești client, specialist sau doar curios despre neurotehnologie, îți răspundem {terms.responseTime}.
          </p>

          <ul className="mt-10 space-y-3">
            <li>
              <a href={`mailto:${site.email}`} className="group flex items-center gap-5 rounded-[16px] bg-mist p-5 transition-colors hover:bg-mist-2">
                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-paper text-cyan-700">
                  <Mail className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="mono block !text-[11px]">Email</span>
                  <span className="block truncate text-[19px] font-medium tracking-[-0.015em] text-ink">{site.email}</span>
                </span>
                <Arrow className="h-5 w-5 flex-none text-faint transition-transform group-hover:translate-x-1 group-hover:text-ink" />
              </a>
            </li>
            <li>
              <a href={site.phoneHref} className="group flex items-center gap-5 rounded-[16px] bg-mist p-5 transition-colors hover:bg-mist-2">
                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-paper text-cyan-700">
                  <Phone className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="mono block !text-[11px]">Telefon</span>
                  <span className="block text-[19px] font-medium tracking-[-0.015em] text-ink">{site.phone}</span>
                </span>
                <Arrow className="h-5 w-5 flex-none text-faint transition-transform group-hover:translate-x-1 group-hover:text-ink" />
              </a>
            </li>
          </ul>
        </div>

        <div className="md:col-span-5 md:col-start-8">
          <h2 className="h3 md:mt-[46px]">Cu ce te putem ajuta</h2>
          <ul className="mt-4 border-t border-mist-2">
            {topics.map((t) => (
              <li key={t.title} className="border-b border-mist-2 py-5">
                <h3 className="font-medium text-ink">{t.title}</h3>
                <p className="mt-1 text-[15.5px] text-muted">{t.text}</p>
              </li>
            ))}
          </ul>
          <p className="mono mt-10 !text-[11px]">Produse</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {products.map((p) => (
              <li key={p.id}>
                <Link href={productHref(p)} className="btn2 sm">
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
