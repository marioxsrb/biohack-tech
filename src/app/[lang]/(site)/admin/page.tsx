import Link from 'next/link'
import { connection } from 'next/server'
import { formatLei } from '@/lib/money'
import { loadConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { jobs } from '@/server/jobs/outbox'
import { customerName } from '@/server/orders/model'
import { orders } from '@/server/orders/repository'
import { withdrawals } from '@/server/orders/withdrawal'
import { enquiries } from '@/server/enquiries'
import { retryJobsAction } from './actions'
import { INVOICE_LABEL, ORDER_LABEL, PAYMENT_LABEL, tone } from './labels'

const dt = (d: Date) => d.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Every order at a glance, newest first, plus anything that needs a person. */
export default async function AdminPage({ searchParams }: PageProps<'/[lang]/admin'>) {
  await connection()
  const q = String((await searchParams).q ?? '').trim().slice(0, 80)
  const { issues } = loadConfig()
  const db = await getDb()
  const [list, problems, withdrawalList, messageCounts] = await Promise.all([
    orders.list(db, { limit: 150, search: q || undefined }),
    jobs.problems(db),
    withdrawals.recent(20),
    enquiries.counts(),
  ])
  const numberOf = new Map(list.map((o) => [o.id, o.orderNumber]))
  const errors = issues.filter((i) => i.level === 'error')

  return (
    <>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[34px] tracking-[-0.03em]">Comenzi</h1>
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Număr, email, nume, firmă" className="field !min-h-11 w-[280px] !py-2" aria-label="Caută comenzi" />
          <button className="btn-secondary sm !min-h-11">Caută</button>
        </form>
      </div>

      {errors.length > 0 && (
        <div className="mt-6 rounded-[14px] bg-[#fdecec] px-5 py-4 text-[14.5px] text-ink">
          <p className="font-semibold">Configurare incompletă</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((e) => (
              <li key={e.message}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}

      {(messageCounts.new ?? 0) > 0 && (
        <p className="mt-6 rounded-[14px] bg-cyan-50 px-5 py-3 text-[14.5px] text-cyan-700">
          {messageCounts.new === 1 ? 'Un mesaj nou' : `${messageCounts.new} mesaje noi`} din formularul de contact.{' '}
          <Link href="/admin/mesaje" className="font-medium underline underline-offset-4">
            Deschide mesajele
          </Link>
        </p>
      )}

      {withdrawalList.length > 0 && (
        <div className="mt-6 rounded-[14px] bg-paper p-5">
          <p className="font-semibold text-ink">Cereri de retragere ({withdrawalList.length} recente)</p>
          <ul className="mt-3 divide-y divide-mist-2 text-[14px]">
            {withdrawalList.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span>
                  <span className="font-medium">{w.reference}</span> · {dt(w.createdAt)} · {w.orderNumber} · {w.name} · {w.email}
                  {!w.orderId && <span className="text-red-deep"> · comanda nu a fost găsită, verifică manual</span>}
                </span>
                {w.orderId && (
                  <Link href={`/admin/orders/${w.orderId}`} className="underline underline-offset-4">
                    Deschide
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {problems.length > 0 && (
        <div className="mt-6 rounded-[14px] bg-paper p-5 shadow-[inset_0_0_0_1px_var(--color-red)]">
          <div className="flex items-center justify-between gap-4">
            <p className="font-semibold text-ink">Sincronizări care au nevoie de atenție ({problems.length})</p>
            <form action={retryJobsAction}>
              <input type="hidden" name="id" value="" />
              <button className="btn-secondary sm">Reîncearcă tot</button>
            </form>
          </div>
          <ul className="mt-3 divide-y divide-mist-2 text-[14px]">
            {problems.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span>
                  <span className="font-medium">{j.kind}</span> · {j.status === 'failed' ? 'oprit' : `reîncercare ${j.attempts}`} · <span className="text-muted">{j.lastError}</span>
                </span>
                {j.orderId && (
                  <Link href={`/admin/orders/${j.orderId}`} className="underline underline-offset-4">
                    Vezi comanda
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-[16px] bg-paper">
        <table className="w-full min-w-[900px] text-left text-[14.5px]">
          <thead className="text-[13px] text-muted">
            <tr className="border-b border-mist-2">
              {['Comanda', 'Data', 'Client', 'Total', 'Plată', 'Stare plată', 'Stare comandă', 'Factură'].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id} className="border-b border-mist-2 last:border-0 hover:bg-mist/60">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/admin/orders/${o.id}`} className="underline underline-offset-4">
                    {o.orderNumber}
                  </Link>
                  {o.kind === 'upsell' && (
                    <span className="block text-[12.5px] font-normal text-muted">↳ adăugată la {o.parentOrderId ? (numberOf.get(o.parentOrderId) ?? 'comanda inițială') : ''}</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">{dt(o.createdAt)}</td>
                <td className="px-4 py-3">
                  {o.customer.buyerType === 'pj' ? o.customer.company : customerName(o.customer)}
                  <span className="block text-[13px] text-muted">{o.email}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                  {formatLei(o.totalMinor)}
                  {o.discountMinor > 0 && <span className="block text-[12.5px] text-cyan-700">reducere {formatLei(o.discountMinor)}</span>}
                </td>
                <td className="px-4 py-3">{o.paymentMethod === 'card' ? 'Card' : o.paymentMethod === 'cash_on_delivery' ? 'Ramburs' : 'Transfer'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-[13px] font-medium ${tone(o.paymentStatus)}`}>{PAYMENT_LABEL[o.paymentStatus]}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-[13px] font-medium ${tone(o.status)}`}>{ORDER_LABEL[o.status]}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-[13px] font-medium ${tone(o.invoiceStatus)}`}>{INVOICE_LABEL[o.invoiceStatus]}</span>
                </td>
              </tr>
            ))}
            {!list.length && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted">
                  {q ? 'Nicio comandă găsită.' : 'Încă nu există comenzi.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
