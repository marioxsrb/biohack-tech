import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { Arrow } from '@/components/ui/icons'
import type { CartLine } from '@/components/cart/cart-store'
import { recoveryCart } from '@/server/marketing/recovery'
import { RestoreCart } from './RestoreCart'

export const metadata: Metadata = { title: 'Reia comanda', robots: { index: false, follow: false } }

/**
 * Checkout recovery link. The token is opaque, expires, and only restores the products of an unpaid
 * card order to the cart: it shows no name, address or order detail, and it never pays or confirms
 * anything. The customer fills in the checkout again, as a new order.
 */
export default async function ResumePage({ params }: PageProps<'/reluare/[token]'>) {
  await connection()
  const { token } = await params
  let lines: CartLine[] | null = null
  try {
    lines = (await recoveryCart(token)) as CartLine[] | null
  } catch {}

  return (
    <section className="pt-[calc(var(--nav-h)+56px)] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+28px)]">
      <div className="wrap max-w-[640px]">
        {lines ? (
          <>
            <h1 className="text-[clamp(28px,3.4vw,38px)] leading-tight tracking-[-0.035em]">Reluăm comanda.</h1>
            <RestoreCart lines={lines} />
          </>
        ) : (
          <>
            <h1 className="text-[clamp(28px,3.4vw,38px)] leading-tight tracking-[-0.035em]">Linkul nu mai este valid.</h1>
            <p className="sub mt-4">Comanda a fost deja finalizată sau linkul a expirat. Poți alege produsele din nou oricând.</p>
            <Link href="/products" className="cta mt-8">
              Vezi produsele <Arrow />
            </Link>
          </>
        )}
      </div>
    </section>
  )
}
