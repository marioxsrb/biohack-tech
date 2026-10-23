import type { Metadata } from 'next'
import { connection } from 'next/server'
import Link from '@/components/ui/Link'
import { AD_CONSENT_TEXT, accountEmail, ownsOrder, reviewableOrders } from '@/server/account'
import { getDb } from '@/server/db'
import { videoStorage } from '@/server/integrations/video-storage'
import { ReviewUpload } from './ReviewUpload'

export const metadata: Metadata = { title: 'Review video', robots: { index: false, follow: false } }

/**
 * One review video per delivered order, for the address in the signed link only. The reward conditions come before the
 * upload: the reward needs the advertising licence and never depends on the rating or the opinion.
 */
export default async function ReviewPage({ params }: { params: Promise<{ token: string; orderId: string }> }) {
  await connection()
  const { token, orderId } = await params
  const email = accountEmail(decodeURIComponent(token))
  const db = await getDb()
  const order = email && (await ownsOrder(db, email, orderId)) ? (await reviewableOrders(db, email)).find((o) => o.id === orderId) : undefined
  const waiting = !!order && (!order.reviewStatus || order.reviewStatus === 'rejected')
  const open = waiting && videoStorage().kind !== 'none'
  return (
    <section className="pt-[calc(var(--nav-h)+56px)] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+28px)]">
      <div className="wrap max-w-[640px]">
        <Link href={`/cont/${encodeURIComponent(token)}`} className="tlink">
          Înapoi la contul tău
        </Link>
        <h1 className="mt-6 text-[clamp(28px,3.4vw,38px)] leading-tight tracking-[-0.035em]">Review video{order ? ` pentru comanda ${order.orderNumber}` : ''}</h1>
        {open ? (
          <>
            <p className="sub mt-4">Povestește cum folosești produsul și ce ți-a plăcut. Spune sincer ce crezi.</p>
            <div className="mt-6 rounded-[20px] bg-paper p-6">
              <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-ink">Cum primești recompensa</h2>
              <ul className="mt-3 grid gap-2 text-[15px] text-text">
                <li>1. Filmezi un video scurt cu produsul primit. Cel mult 300 MB.</li>
                <li>2. Bifezi acordul. Așa putem folosi video-ul pe site, pe rețelele sociale și în reclame.</li>
                <li>3. Verificăm video-ul și îți scriem când recompensa e gata.</li>
              </ul>
              <p className="mt-4 text-[14.5px] text-text">Recompensa este aceeași, oricare ar fi părerea ta. Acordul îl poți retrage oricând, din contul tău.</p>
              <p className="mt-2 text-[14.5px] text-text">
                Fără bifă, video-ul rămâne privat și fără recompensă. Detalii în{' '}
                <Link href="/conditii-review-video" className="font-medium text-ink underline underline-offset-4">
                  condițiile review-ului video
                </Link>
                .
              </p>
            </div>
            <ReviewUpload token={decodeURIComponent(token)} orderId={orderId} consentText={AD_CONSENT_TEXT} />
          </>
        ) : (
          <p className="sub mt-4">
            {!order ? 'Linkul a expirat. Folosește linkul din cel mai recent email de la noi.' : waiting ? 'Trimiterea video-urilor pornește în curând. Îți scriem când e gata.' : 'Am primit video-ul pentru această comandă. Starea lui apare în contul tău.'}
          </p>
        )}
      </div>
    </section>
  )
}
