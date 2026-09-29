import type { Metadata } from 'next'
import Link from 'next/link'
import { site, terms } from '@/config/site'
import { pageMetadata } from '@/lib/seo'
import { WithdrawalForm } from './WithdrawalForm'

export const metadata: Metadata = {
  ...pageMetadata({
    title: 'Retragere din contract',
    description: `Renunță online la o comandă Biohack Tech, în ${terms.returnDays} zile de la primire, fără să ne spui motivul.`,
    path: '/retragere',
  }),
  robots: { index: false, follow: true },
}

/** The online withdrawal function (OUG 34/2014 art. 11^1). Linked from the footer, the order page and the returns policy. */
export default function WithdrawalPage() {
  return (
    <section className="pt-[calc(var(--nav-h)+var(--sec))] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+32px)]">
      <div className="wrap grid gap-y-8 md:grid-cols-12 md:gap-x-6">
        <header className="md:col-span-5">
          <h1 className="text-[36px] leading-[1.06] tracking-[-0.035em] max-sm:text-[30px]">Retragere din contract</h1>
          <div className="mt-5 space-y-3 text-[16px] leading-relaxed text-text">
            <p>Ai cumpărat ca persoană fizică? Poți renunța la comandă în {terms.returnDays} zile de la primirea produselor, fără să ne spui motivul.</p>
            <p>Completează formularul și apasă „Confirmați retragerea”. Dacă numărul comenzii și emailul se potrivesc, primești pe email confirmarea, cu conținutul cererii, data și ora.</p>
            <p>
              Poți trimite și{' '}
              <Link href="/politica-retur#formular" className="font-medium text-ink underline underline-offset-4">
                formularul model
              </Link>{' '}
              sau orice declarație clară la{' '}
              <a href={`mailto:${site.email}`} className="font-medium text-ink underline underline-offset-4">
                {site.email}
              </a>
              .
            </p>
          </div>
        </header>
        <div className="md:col-span-6 md:col-start-7">
          <WithdrawalForm />
        </div>
      </div>
    </section>
  )
}
