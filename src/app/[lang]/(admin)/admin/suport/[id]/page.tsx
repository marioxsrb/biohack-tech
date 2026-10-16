import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { getDb } from '@/server/db'
import { supportRequests } from '@/server/assistant/support'
import { orders } from '@/server/orders/repository'
import { replies } from '@/server/replies'
import { inbox } from '@/server/inbox'
import { Conversation } from '../../Conversation'
import { ReplyBox } from '../../ReplyBox'
import { dt, SupportCard } from '../SupportCard'

/** One support request (the link in the team's email), with the linked order's audit trail. */
export default async function SupportRequestPage({ params }: PageProps<'/[lang]/admin/suport/[id]'>) {
  await connection()
  const { id } = await params
  const db = await getDb()
  const r = await supportRequests.byId(db, id)
  if (!r) notFound()
  const events = r.orderId ? await orders.events(db, r.orderId) : []
  const [sentReplies, answers] = await Promise.all([replies.forThread(db, 'support', r.id), inbox.forThread(db, 'support', r.id)])
  await inbox.markRead(db, 'support', r.id)
  return (
    <>
      <Link href="/admin/suport" className="text-[14px] text-muted underline underline-offset-4">
        ← Toate cererile
      </Link>
      <h1 className="mt-2 text-[34px] tracking-[-0.03em]">Cererea {r.ref}</h1>
      <ul className="mt-6">
        <SupportCard r={r} detail>
          <section className="mt-4 rounded-[16px] bg-mist p-3">
            <Conversation first={{ name: r.name ?? r.email ?? 'Clientul', at: r.createdAt, text: r.summary, via: 'chatul de pe site (rezumat)' }} replies={sentReplies} inbound={answers} />
          </section>
          <ReplyBox kind="support" id={r.id} email={r.email} />
        </SupportCard>
      </ul>
      {r.orderId && (
        <section className="mt-6 rounded-[16px] bg-paper p-5">
          <h2 className="text-[17px] font-semibold text-ink">
            Istoricul comenzii{' '}
            <Link href={`/admin/orders/${r.orderId}`} className="underline underline-offset-4">
              {r.orderNumber}
            </Link>
          </h2>
          <ul className="mt-3 space-y-1.5 text-[14px]">
            {events.map((e, i) => (
              <li key={i} className="flex flex-wrap gap-x-3">
                <span className="text-muted tabular-nums">{dt(new Date(e.created_at))}</span>
                <span className="font-medium text-ink">{e.type}</span>
                <span className="text-muted">{e.source}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
