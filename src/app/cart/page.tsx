import type { Metadata } from 'next'
import { CartView } from './CartView'

export const metadata: Metadata = {
  title: 'Coșul tău',
  robots: { index: false, follow: false },
}

export default function CartPage() {
  return (
    <section className="pt-[calc(var(--nav-h)+40px)] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+24px)]">
      <div className="wrap">
        <CartView />
      </div>
    </section>
  )
}
