import type { Metadata } from 'next'
import { ContactForm } from '@/components/contact/ContactForm'
import { site, terms } from '@/config/site'
import { getLocale } from '@/i18n/server'
import { pageMetadata } from '@/lib/seo'

const COPY = {
  ro: {
    title: 'Contact',
    description: 'Scrie-ne sau sună-ne. Te ajutăm să alegi dispozitivul potrivit, răspundem la întrebări despre comandă și te sprijinim după livrare.',
    heading: 'Scrie-ne sau sună-ne.',
    lead: `Vrei o recomandare, ai o întrebare despre comandă sau ai nevoie de ajutor după ce ai primit produsul? Îți răspundem ${terms.responseTime}.`,
    phone: 'Telefon',
    form: 'Sau scrie-ne aici',
  },
  en: {
    title: 'Contact',
    description: 'Write to us or call us. We help you choose the right device, answer questions about your order and support you after delivery.',
    heading: 'Write to us or call us.',
    lead: 'Want a recommendation, have a question about your order or need help with your device? We reply within 24 hours.',
    phone: 'Phone',
    form: 'Or write to us here',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const { title, description } = COPY[locale]
  return pageMetadata({ title, description, path: '/contact-us', locale })
}

export default async function ContactPage() {
  const t = COPY[await getLocale()]
  return (
    <section className="pt-[calc(var(--nav-h)+var(--sec))] pb-[var(--sec)]">
      <div className="wrap">
        <h1 className="max-w-[10em] text-[clamp(40px,5.4vw,78px)] leading-[0.98] tracking-[-0.045em]">{t.heading}</h1>
        <p className="mt-6 max-w-[30em] text-[19px] leading-relaxed text-text">
          {t.lead}
        </p>
        <div className="mt-14 grid gap-10 border-t border-mist-2 pt-10 sm:grid-cols-2">
          <a href={`mailto:${site.email}`} className="group block">
            <span className="block text-[15px] text-muted">Email</span>
            <span className="mt-1 block text-[clamp(24px,2.6vw,36px)] leading-tight tracking-[-0.03em] text-ink break-all group-hover:text-cyan-700">
              {site.email}
            </span>
          </a>
          <a href={site.phoneHref} className="group block">
            <span className="block text-[15px] text-muted">{t.phone}</span>
            <span className="mt-1 block text-[clamp(24px,2.6vw,36px)] leading-tight tracking-[-0.03em] text-ink group-hover:text-cyan-700">{site.phone}</span>
          </a>
        </div>
        <div className="mt-14 rounded-[28px] bg-paper p-[clamp(24px,4.4vw,56px)]">
          <h2 className="text-[26px] tracking-[-0.025em]">{t.form}</h2>
          <div className="mt-6 max-w-[760px]">
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  )
}
