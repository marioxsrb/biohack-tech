import type { Metadata } from 'next'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { availablePaymentMethods } from '@/lib/payments'
import { CheckoutView } from './CheckoutView'

export const metadata: Metadata = {
  title: 'Finalizează comanda',
  robots: { index: false, follow: false },
}

export default async function CheckoutPage() {
  // Payment methods depend on runtime configuration (keys, bank details), not on the build.
  await connection()
  const methods = availablePaymentMethods()
  return (
    <section className="pt-[calc(var(--nav-h)+40px)] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+24px)]">
      <div className="wrap">
        <Suspense fallback={<div className="min-h-[60vh]" />}>
          <CheckoutView methods={methods} />
        </Suspense>
      </div>
    </section>
  )
}
