import { VisitBeacon } from '@/components/gate/VisitBeacon'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { getLocale } from '@/i18n/server'
import { getConfig, paymentMethods } from '@/server/config'
import { CheckoutView } from './CheckoutView'
import { settingsForRender } from '@/server/store-settings'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: (await getLocale()) === 'en' ? 'Check out' : 'Finalizează comanda',
    robots: { index: false, follow: false },
  }
}

export default async function CheckoutPage() {
  await settingsForRender()
  // Payment methods depend on runtime configuration (keys, bank details, database), not on the build.
  await connection()
  const c = getConfig()
  return (
    <section className="pt-10 pb-[var(--sec)] max-sm:pt-6">
      <div className="wrap">
        <VisitBeacon page="checkout" />
        <Suspense fallback={<div className="min-h-[60vh]" />}>
          <CheckoutView methods={paymentMethods(c)} stripeKey={c.stripe?.publishableKey ?? null} />
        </Suspense>
      </div>
    </section>
  )
}
