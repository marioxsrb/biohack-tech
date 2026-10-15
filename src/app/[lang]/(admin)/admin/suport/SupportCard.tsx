import Link from 'next/link'
import { SUPPORT_CATEGORIES, SUPPORT_STATUS, type SupportRequest, type SupportStatus } from '@/server/assistant/support'
import { supportAction } from '../actions'

export const dt = (d: Date) => d.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const TONE: Record<SupportStatus, string> = { open: 'bg-cyan-50 text-cyan-700', in_progress: 'bg-[#fff4e0] text-[#8a5300]', resolved: 'bg-mist text-muted' }

/** One support request: what was asked, how to reach the customer, the linked order, and the operator's controls. */
export function SupportCard({ r, detail = false }: { r: SupportRequest; detail?: boolean }) {
  return (
    <li className="rounded-[16px] bg-paper p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-[16px] font-semibold text-ink">
            {detail ? r.ref : <Link href={`/admin/suport/${r.id}`} className="underline-offset-4 hover:underline">{r.ref}</Link>}
            <span className="text-[14.5px] font-medium text-text">{SUPPORT_CATEGORIES[r.category]}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-[12.5px] font-medium ${TONE[r.status]}`}>{SUPPORT_STATUS[r.status]}</span>
            {r.urgent && <span className="rounded-full bg-[#fdecec] px-2.5 py-0.5 text-[12.5px] font-semibold text-red-deep">Urgent</span>}
          </p>
          <p className="mt-0.5 text-[14px] text-muted">
            {dt(r.createdAt)} · {r.source === 'assistant' ? 'asistentul site-ului' : r.source}
            {r.resolvedAt && ` · rezolvată ${dt(r.resolvedAt)}`}
          </p>
          <p className="mt-1 text-[14.5px]">
            {r.orderId && (
              <>
                <Link href={`/admin/orders/${r.orderId}`} className="font-medium underline underline-offset-4">
                  Comanda {r.orderNumber}
                </Link>{' '}
                <span className="text-muted">(email verificat cu cod)</span>
                {(r.email || r.phone || r.name) && ' · '}
              </>
            )}
            {r.name && <span>{r.name} · </span>}
            {r.email && (
              <a href={`mailto:${r.email}?subject=${encodeURIComponent(`Cererea ${r.ref}`)}`} className="underline underline-offset-4">
                {r.email}
              </a>
            )}
            {r.phone && (
              <>
                {r.email && ' · '}
                <a href={`tel:${r.phone.replace(/\s/g, '')}`} className="underline underline-offset-4">
                  {r.phone}
                </a>
              </>
            )}
          </p>
        </div>
        <form action={supportAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="id" value={r.id} />
          {(Object.keys(SUPPORT_STATUS) as SupportStatus[])
            .filter((s) => s !== r.status)
            .map((s) => (
              <button key={s} name="status" value={s} className="btn-secondary sm">
                {s === 'in_progress' ? 'Preia (în lucru)' : s === 'resolved' ? 'Rezolvată' : 'Redeschide'}
              </button>
            ))}
          <button name="urgent" value={r.urgent ? 'nu' : 'da'} className="btn-secondary sm">
            {r.urgent ? 'Nu e urgentă' : 'Marchează urgentă'}
          </button>
        </form>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap text-ink">{r.summary}</p>
      <form action={supportAction} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={r.id} />
        <label className="min-w-[240px] flex-1 text-[13px] text-muted">
          Note de rezolvare (interne)
          <textarea name="notes" defaultValue={r.resolutionNotes ?? ''} rows={2} maxLength={2000} className="mt-1 block w-full rounded-[10px] border border-line bg-white px-3 py-2 text-[14.5px] text-ink" />
        </label>
        <button className="btn-secondary sm">Salvează notele</button>
      </form>
    </li>
  )
}
