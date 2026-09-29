import { Suspense } from 'react'
import { CheckoutFooter } from '@/components/checkout/CheckoutFooter'
import { CheckoutHeader } from '@/components/checkout/CheckoutHeader'

/**
 * The checkout, for every visitor (main site or advertising landing): a focused header and a small
 * legal footer. No menu, no product lists, no "see the products": the page exists to finish the order.
 * The way back to the cart stays in the order summary ("Modifică").
 */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<CheckoutHeader />}>
        <CheckoutHeader live />
      </Suspense>
      <main id="main">{children}</main>
      <CheckoutFooter />
    </>
  )
}
