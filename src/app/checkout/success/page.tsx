import type { Metadata } from 'next'
import Link from 'next/link'
import { Arrow, Check } from '@/components/ui/icons'
import { site, terms } from '@/config/site'
import { formatMoney } from '@/lib/money'
import { getPaymentProvider } from '@/lib/payments'
import { ClearPaidLines } from './ClearPaidLines'

export const metadata: Metadata = {
  title: 'Confirmare comandă',
  robots: { index: false, follow: false },
}

/**
 * Confirms only what the payment provider confirms. Without a paid session this page
 * says so, instead of showing a thank-you for an order that doesn't exist.
 */
export default async function SuccessPage({ searchParams }: PageProps<'/checkout/success'>) {
  const { ref } = await searchParams
  const provider = getPaymentProvider()
  const result = provider && typeof ref === 'string' ? await provider.getCheckout(ref) : null
  const paid = result?.status === 'paid'

  return (
    <section className="pt-[calc(var(--nav-h)+64px)] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+32px)]">
      <div className="wrap max-w-[760px]">
        {paid ? (
          <>
            <ClearPaidLines keys={result.lineKeys} />
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
              <Check className="h-6 w-6" />
            </span>
            <h1 className="mt-6 text-[36px] leading-tight tracking-[-0.035em] max-sm:text-[30px]">Mulțumim, comanda e confirmată.</h1>
            <p className="sub mt-4">
              {result.total && <>Am primit plata de {formatMoney(result.total)}. </>}
              Confirmarea a plecat pe {result.email ?? 'email'}.
            </p>
            <ol className="mt-10 border-t border-mist-2">
              {[
                ['Pregătim comanda', `În ${terms.processingDays}.`],
                ['O predăm curierului', `Primești AWB-ul pe email. Livrarea durează ${terms.transitDays}.`],
                ['Te contactăm', 'Pentru Balance Wave și BrainLink Pro, programăm consultația inițială cu un specialist.'],
              ].map(([t, d], i) => (
                <li key={t} className="grid grid-cols-[48px_1fr] gap-4 border-b border-mist-2 py-4">
                  <span className="pt-0.5 font-mono text-[12px] text-cyan-700">0{i + 1}</span>
                  <div>
                    <p className="font-medium text-ink">{t}</p>
                    <p className="text-[15px] text-muted">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/" className="tlink mt-8">
              Înapoi la magazin <Arrow />
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-[36px] leading-tight tracking-[-0.035em] max-sm:text-[30px]">Plata nu a fost finalizată.</h1>
            <p className="sub mt-4">
              Nu am primit confirmarea plății pentru această comandă. Produsele sunt tot în coș. Dacă ți s-au retras bani, scrie-ne la{' '}
              <a href={`mailto:${site.email}`} className="font-medium text-ink underline underline-offset-4">
                {site.email}
              </a>
              .
            </p>
            <Link href="/checkout" className="cta mt-8">
              Înapoi la comandă <Arrow />
            </Link>
          </>
        )}
      </div>
    </section>
  )
}
