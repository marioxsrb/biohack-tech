import Link from 'next/link'
import { connection } from 'next/server'
import { ENQUIRY_TOPICS } from '@/lib/enquiry'
import { getDb } from '@/server/db'
import { ENQUIRY_STATUS, enquiries, type EnquiryFilter, type EnquiryStatus } from '@/server/enquiries'
import { inbox } from '@/server/inbox'
import { replies } from '@/server/replies'
import { InboxStatus } from '../InboxStatus'
import { TONE } from './tone'

const dt = (d: Date) => d.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const FILTERS: { key: EnquiryFilter | 'all'; label: string }[] = [
  { key: 'all', label: 'Toate' },
  { key: 'unread', label: 'Necitite' },
  { key: 'urgent', label: 'Urgente' },
  ...(Object.keys(ENQUIRY_STATUS) as EnquiryStatus[]).map((k) => ({ key: k, label: ENQUIRY_STATUS[k] })),
]

/** The contact-form inbox: one line per conversation, newest activity first; open one to read and reply. */
export default async function MessagesPage({ searchParams }: PageProps<'/[lang]/admin/mesaje'>) {
  await connection()
  const raw = String((await searchParams).status ?? '')
  const filter = FILTERS.some((f) => f.key === raw && raw !== 'all') ? (raw as EnquiryFilter) : undefined
  const db = await getDb()
  const [list, counts, unread] = await Promise.all([enquiries.list(filter), enquiries.counts(), inbox.unreadThreads(db, 'enquiry')])
  const ids = list.map((e) => e.id)
  const [answers, sentReplies] = await Promise.all([inbox.forThreads(db, 'enquiry', ids), replies.forThreads(db, 'enquiry', ids)])
  const badge: Partial<Record<string, number>> = { ...counts, unread: unread.size }

  return (
    <>
      <h1 className="mt-2 text-[34px] tracking-[-0.03em]">Mesaje</h1>
      <p className="mt-1 text-[15px] text-muted">Mesajele din formularul de contact și răspunsurile clienților pe email. Deschide o conversație ca să o citești și să răspunzi.</p>
      <InboxStatus />
      <nav aria-label="Filtru" className="mt-4 flex flex-wrap gap-2 text-[14px]">
        {FILTERS.map((f) => {
          const on = (f.key === 'all' && !filter) || f.key === filter
          return (
            <Link key={f.key} href={f.key === 'all' ? '/admin/mesaje' : `/admin/mesaje?status=${f.key}`} aria-current={on ? 'page' : undefined} className={`rounded-full px-3.5 py-1.5 ${on ? 'bg-ink text-white' : 'bg-paper text-ink'}`}>
              {f.label}
              {f.key !== 'all' && f.key !== 'urgent' && ` (${badge[f.key] ?? 0})`}
            </Link>
          )
        })}
      </nav>

      <ul className="mt-6 divide-y divide-line overflow-hidden rounded-[16px] bg-paper">
        {list.map((e) => {
          const last = [...(answers.get(e.id) ?? []).map((m) => ({ at: m.receivedAt, who: e.name.split(' ')[0], text: m.body })), ...(sentReplies.get(e.id) ?? []).map((r) => ({ at: r.createdAt, who: 'Echipa', text: r.body }))].sort((a, b) => b.at.getTime() - a.at.getTime())[0]
          const isNew = unread.has(e.id) || e.status === 'new'
          return (
            <li key={e.id}>
              <Link href={`/admin/mesaje/${e.id}`} className="flex items-start gap-3 px-5 py-4 hover:bg-mist">
                <span aria-hidden className={`mt-2 h-2.5 w-2.5 flex-none rounded-full ${isNew ? 'bg-red' : 'bg-transparent'}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`text-[15.5px] text-ink ${isNew ? 'font-semibold' : 'font-medium'}`}>{e.name}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${TONE[e.status]}`}>{ENQUIRY_STATUS[e.status]}</span>
                    {e.urgent && <span className="rounded-full bg-[#fdecec] px-2.5 py-0.5 text-[12px] font-semibold text-red-deep">Urgent</span>}
                    {unread.has(e.id) && <span className="rounded-full bg-red px-2 py-0.5 text-[11.5px] font-semibold text-white">răspuns nou</span>}
                  </span>
                  <span className="mt-0.5 block text-[13.5px] text-muted">
                    {ENQUIRY_TOPICS[e.topic]} · {e.reference} · {e.email}
                  </span>
                  <span className="mt-1 block truncate text-[14.5px] text-text">{last ? `${last.who}: ${last.text}` : e.message}</span>
                </span>
                <span className="flex-none text-[13px] text-muted tabular-nums">{dt(last?.at ?? e.createdAt)}</span>
              </Link>
            </li>
          )
        })}
        {!list.length && <li className="px-5 py-10 text-center text-muted">Niciun mesaj aici.</li>}
      </ul>
    </>
  )
}
