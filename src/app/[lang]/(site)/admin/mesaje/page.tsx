import Link from 'next/link'
import { connection } from 'next/server'
import { ENQUIRY_TOPICS } from '@/lib/enquiry'
import { ENQUIRY_STATUS, enquiries, type EnquiryStatus } from '@/server/enquiries'
import { enquiryStatusAction } from '../actions'

const dt = (d: Date) => d.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const TONE: Record<EnquiryStatus, string> = { new: 'bg-cyan-50 text-cyan-700', in_progress: 'bg-[#fff4e0] text-[#8a5300]', resolved: 'bg-mist text-muted' }

/** Contact-form messages: newest first, filter by status, move them along. Not a CRM: replies go by email/phone. */
export default async function MessagesPage({ searchParams }: PageProps<'/[lang]/admin/mesaje'>) {
  await connection()
  const raw = String((await searchParams).status ?? '')
  const status = raw in ENQUIRY_STATUS ? (raw as EnquiryStatus) : undefined
  const [list, counts] = await Promise.all([enquiries.list(status), enquiries.counts()])

  return (
    <>
      <h1 className="mt-2 text-[34px] tracking-[-0.03em]">Mesaje</h1>
      <nav aria-label="Filtru după stare" className="mt-4 flex flex-wrap gap-2 text-[14px]">
        <Link href="/admin/mesaje" aria-current={!status ? 'page' : undefined} className={`rounded-full px-3.5 py-1.5 ${!status ? 'bg-ink text-white' : 'bg-paper text-ink'}`}>
          Toate
        </Link>
        {(Object.keys(ENQUIRY_STATUS) as EnquiryStatus[]).map((s) => (
          <Link key={s} href={`/admin/mesaje?status=${s}`} aria-current={status === s ? 'page' : undefined} className={`rounded-full px-3.5 py-1.5 ${status === s ? 'bg-ink text-white' : 'bg-paper text-ink'}`}>
            {ENQUIRY_STATUS[s]} ({counts[s] ?? 0})
          </Link>
        ))}
      </nav>

      <ul className="mt-6 space-y-4">
        {list.map((e) => (
          <li key={e.id} className="rounded-[16px] bg-paper p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex flex-wrap items-center gap-2 text-[16px] font-semibold text-ink">
                  {e.name}
                  <span className={`rounded-full px-2.5 py-0.5 text-[12.5px] font-medium ${TONE[e.status]}`}>{ENQUIRY_STATUS[e.status]}</span>
                </p>
                <p className="mt-0.5 text-[14px] text-muted">
                  {e.reference} · {dt(e.createdAt)} · {ENQUIRY_TOPICS[e.topic]}
                  {e.sourcePage && ` · din ${e.sourcePage}`}
                  {e.attribution?.landing && ` · landing ${e.attribution.landing}`}
                </p>
                <p className="mt-1 text-[14.5px]">
                  <a href={`mailto:${e.email}?subject=${encodeURIComponent(`Re: ${ENQUIRY_TOPICS[e.topic]} (${e.reference})`)}`} className="underline underline-offset-4">
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
                  <span className="text-muted"> · GHL: {e.ghlContactId ? 'sincronizat' : 'în așteptare'}</span>
                </p>
              </div>
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
            </div>
            <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap text-ink">{e.message}</p>
          </li>
        ))}
        {!list.length && <li className="rounded-[16px] bg-paper px-5 py-10 text-center text-muted">Niciun mesaj{status ? ` cu starea „${ENQUIRY_STATUS[status]}”` : ''}.</li>}
      </ul>
    </>
  )
}
