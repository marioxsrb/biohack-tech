import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { ENQUIRY_TOPICS } from '@/lib/enquiry'
import { getDb } from '@/server/db'
import { ENQUIRY_STATUS, enquiries, type EnquiryStatus } from '@/server/enquiries'
import { inbox } from '@/server/inbox'
import { replies } from '@/server/replies'
import { enquiryStatusAction, enquiryUrgentAction } from '../../actions'
import { Conversation } from '../../Conversation'
import { ReplyBox } from '../../ReplyBox'
import { TONE } from '../tone'

/** One contact-form conversation: the timeline, the controls, the customer's orders, the reply box. Opening it reads it. */
export default async function MessagePage({ params }: PageProps<'/[lang]/admin/mesaje/[id]'>) {
  await connection()
  const { id } = await params
  const e = await enquiries.byId(id)
  if (!e) notFound()
  const db = await getDb()
  const [sentReplies, answers, orderRows] = await Promise.all([
    replies.forThread(db, 'enquiry', e.id),
    inbox.forThread(db, 'enquiry', e.id),
    db.query<{ id: string; order_number: string; status: string }>('select id, order_number, status from orders where email = $1 order by created_at desc limit 3', [e.email.trim().toLowerCase()]),
  ])
  await inbox.markRead(db, 'enquiry', e.id)

  return (
    <>
      <Link href="/admin/mesaje" className="text-[14px] text-muted underline underline-offset-4">
        ← Toate mesajele
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[30px] tracking-[-0.03em]">{e.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[14px] text-muted">
            <span className={`rounded-full px-2.5 py-0.5 text-[12.5px] font-medium ${TONE[e.status]}`}>{ENQUIRY_STATUS[e.status]}</span>
            {e.urgent && <span className="rounded-full bg-[#fdecec] px-2.5 py-0.5 text-[12.5px] font-semibold text-red-deep">Urgent</span>}
            {ENQUIRY_TOPICS[e.topic]} · {e.reference}
            {e.sourcePage && ` · din ${e.sourcePage}`}
          </p>
          <p className="mt-1 text-[14.5px]">
            <a href={`mailto:${e.email}`} className="underline underline-offset-4">
              {e.email}
            </a>
            {e.phone && (
              <>
                {' · '}
                <a href={`tel:${e.phone.replace(/\s/g, '')}`} className="underline underline-offset-4">
                  {e.phone}
                </a>
              </>
            )}
            {orderRows.rows.map((o) => (
              <span key={o.id}>
                {' · '}
                <Link href={`/admin/orders/${o.id}`} className="font-medium underline underline-offset-4">
                  Comanda {o.order_number}
                </Link>
              </span>
            ))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={enquiryStatusAction} className="flex gap-2">
            <input type="hidden" name="id" value={e.id} />
            {(Object.keys(ENQUIRY_STATUS) as EnquiryStatus[])
              .filter((s) => s !== e.status)
              .map((s) => (
                <button key={s} name="status" value={s} className="btn-secondary sm">
                  {ENQUIRY_STATUS[s]}
                </button>
              ))}
          </form>
          <form action={enquiryUrgentAction}>
            <input type="hidden" name="id" value={e.id} />
            <button name="urgent" value={e.urgent ? 'nu' : 'da'} className="btn-secondary sm">
              {e.urgent ? 'Nu e urgent' : 'Marchează urgent'}
            </button>
          </form>
        </div>
      </div>

      <section className="mt-6 rounded-[16px] bg-paper p-4">
        <Conversation first={{ name: e.name, at: e.createdAt, text: e.message, via: 'formularul de contact' }} replies={sentReplies} inbound={answers} />
      </section>
      <ReplyBox kind="enquiry" id={e.id} email={e.email} />
    </>
  )
}
