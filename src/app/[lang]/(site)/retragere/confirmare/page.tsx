import type { Metadata } from 'next'
import Link from '@/components/ui/Link'
import { connection } from 'next/server'
import { Check } from '@/components/ui/icons'
import { site } from '@/config/site'
import { withdrawals } from '@/server/orders/withdrawal'

export const metadata: Metadata = { title: 'Cererea de retragere a fost înregistrată', robots: { index: false, follow: false } }

const when = (d: Date) => d.toLocaleString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' })

/** Shows the recorded statement by its reference: no name or email, only what identifies the request. */
export default async function WithdrawalDone({ searchParams }: PageProps<'/[lang]/retragere/confirmare'>) {
  await connection()
  const ref = String((await searchParams).ref ?? '')
  const w = /^RET-[0-9A-F]{8,16}$/.test(ref) ? await withdrawals.byReference(ref).catch(() => null) : null

  return (
    <section className="pt-[calc(var(--nav-h)+56px)] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+28px)]">
      <div className="wrap max-w-[680px]">
        {w ? (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
              <Check className="h-6 w-6" />
            </span>
            <h1 className="mt-6 text-[clamp(28px,3.4vw,38px)] leading-tight tracking-[-0.035em]">Am înregistrat cererea de retragere.</h1>
            <dl className="mt-6 divide-y divide-mist-2 rounded-[20px] bg-paper px-6 text-[15.5px] max-sm:px-5">
              {(
                [
                  ['Referință', w.reference],
                  ['Primită la', when(w.createdAt)],
                  ['Comanda', w.orderNumber],
                  ['Produse', w.items],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[120px_1fr] gap-3 py-3 max-sm:grid-cols-1 max-sm:gap-0.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-medium break-words text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="sub mt-6">
              {w.orderId
                ? 'Ți-am trimis confirmarea pe email. Îți scriem adresa de retur și pașii.'
                : `Nu am găsit comanda după număr și email, dar cererea este înregistrată. Te contactăm pe email. Pentru orice întrebare: ${site.email}.`}
            </p>
            <p className="mt-3 text-[15px] text-muted">Păstrează referința {w.reference}. O poți salva și ca imagine a acestei pagini.</p>
          </>
        ) : (
          <>
            <h1 className="text-[clamp(28px,3.4vw,38px)] leading-tight tracking-[-0.035em]">Nu găsim această cerere.</h1>
            <p className="sub mt-4">
              Dacă ai trimis-o deja, verifică emailul. Altfel, poți{' '}
              <Link href="/retragere" className="font-medium text-ink underline underline-offset-4">
                completa formularul
              </Link>{' '}
              sau ne poți scrie la {site.email}.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
