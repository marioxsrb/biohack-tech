import type { Metadata } from 'next'
import { site, terms } from '@/config/site'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Contact',
  description: 'Scrie-ne sau sună-ne pentru o recomandare, o întrebare despre comandă sau ajutor după achiziție. Răspundem în cel mult 24 de ore.',
  path: '/contact-us',
})

export default function ContactPage() {
  return (
    <section className="pt-[calc(var(--nav-h)+var(--sec))] pb-[var(--sec)]">
      <div className="wrap">
        <h1 className="max-w-[10em] text-[clamp(40px,5.4vw,78px)] leading-[0.98] tracking-[-0.045em]">Hai să vorbim.</h1>
        <p className="mt-6 max-w-[30em] text-[19px] leading-relaxed text-text">
          Vrei o recomandare, ai o întrebare despre comandă sau ai nevoie de ajutor după ce ai primit produsul? Îți răspundem {terms.responseTime}.
        </p>
        <div className="mt-14 grid gap-10 border-t border-mist-2 pt-10 sm:grid-cols-2">
          <a href={`mailto:${site.email}`} className="group block">
            <span className="block text-[15px] text-muted">Email</span>
            <span className="mt-1 block text-[clamp(24px,2.6vw,36px)] leading-tight tracking-[-0.03em] text-ink break-all group-hover:text-cyan-700">
              {site.email}
            </span>
          </a>
          <a href={site.phoneHref} className="group block">
            <span className="block text-[15px] text-muted">Telefon</span>
            <span className="mt-1 block text-[clamp(24px,2.6vw,36px)] leading-tight tracking-[-0.03em] text-ink group-hover:text-cyan-700">{site.phone}</span>
          </a>
        </div>
      </div>
    </section>
  )
}
