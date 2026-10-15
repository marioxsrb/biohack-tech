import type { Metadata } from 'next'
import { getLocale } from '@/i18n/server'
import { CartView } from './CartView'
import { settingsForRender } from '@/server/store-settings'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLocale()) === 'en' ? 'Your cart' : 'Coșul tău', robots: { index: false, follow: false } }
}

export default async function CartPage() {
  await settingsForRender()
  return (
    <section className="min-h-[100svh] pt-[calc(var(--nav-h)+40px)] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+24px)]">
      <div className="wrap">
        <CartView />
      </div>
    </section>
  )
}
