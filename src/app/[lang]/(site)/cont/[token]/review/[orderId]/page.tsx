import type { Metadata } from 'next'
import { connection } from 'next/server'
import Link from '@/components/ui/Link'
import { accountEmail, ownsOrder, reviewableOrders } from '@/server/account'
import { getDb } from '@/server/db'
import { videoStorage } from '@/server/integrations/video-storage'
import { ReviewUpload } from './ReviewUpload'

export const metadata: Metadata = { title: 'Review video', robots: { index: false, follow: false } }

/** One review video per delivered order, for the address in the signed link only. The reward does not depend on the rating. */
export default async function ReviewPage({ params }: { params: Promise<{ token: string; orderId: string }> }) {
  await connection()
  const { token, orderId } = await params
  const email = accountEmail(decodeURIComponent(token))
  const db = await getDb()
  const order = email && (await ownsOrder(db, email, orderId)) ? (await reviewableOrders(db, email)).find((o) => o.id === orderId) : undefined
  const open = !!order && (!order.reviewStatus || order.reviewStatus === 'rejected') && videoStorage().kind !== 'none'
  return (
    <section className="pt-[calc(var(--nav-h)+56px)] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+28px)]">
      <div className="wrap max-w-[640px]">
        <Link href={`/cont/${encodeURIComponent(token)}`} className="tlink">
          Înapoi la contul tău
        </Link>
        <h1 className="mt-6 text-[clamp(28px,3.4vw,38px)] leading-tight tracking-[-0.035em]">Review video{order ? ` pentru comanda ${order.orderNumber}` : ''}</h1>
        {open ? (
          <>
            <p className="sub mt-4">Povestește cum folosești produsul, ce ți-a plăcut și ce ai schimba. Recompensa nu depinde de cât de bun este review-ul.</p>
            <ReviewUpload token={decodeURIComponent(token)} orderId={orderId} />
          </>
        ) : (
          <p className="sub mt-4">{order ? 'Pentru această comandă nu putem primi un video acum.' : 'Linkul nu mai este valid.'}</p>
        )}
      </div>
    </section>
  )
}
