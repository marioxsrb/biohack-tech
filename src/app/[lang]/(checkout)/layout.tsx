import { Suspense } from 'react'
import { CheckoutFooter } from '@/components/checkout/CheckoutFooter'
import { CheckoutHeader } from '@/components/checkout/CheckoutHeader'
import { getUi } from '@/i18n/server'

/**
 * The checkout, for every visitor (main site or advertising landing): a focused header and a small
 * legal footer. No menu, no product lists, no "see the products": the page exists to finish the order.
 * The way back to the cart stays in the order summary ("Modifică").
 */
export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  const ui = await getUi()
  return (
    <>
      <a href="#main" className="sr-only z-[500] rounded-md bg-paper px-4 py-2 text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        {ui.skipToContent}
      </a>
      <Suspense fallback={<CheckoutHeader />}>
        <CheckoutHeader live />
      </Suspense>
      <main id="main">{children}</main>
      <CheckoutFooter />
    </>
  )
}
