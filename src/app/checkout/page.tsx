import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CheckoutView } from './CheckoutView'

export const metadata: Metadata = {
  title: 'Finalizează comanda',
  robots: { index: false, follow: false },
}

export default function CheckoutPage() {
  return (
    <section className="pt-[calc(var(--nav-h)+48px)] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+28px)]">
      <div className="wrap">
        <Suspense fallback={<div className="min-h-[60vh]" />}>
          <CheckoutView />
        </Suspense>
      </div>
    </section>
  )
}
