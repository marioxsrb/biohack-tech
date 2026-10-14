import Link from 'next/link'
import { connection } from 'next/server'
import { formatLei } from '@/lib/money'
import { loadConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { jobs } from '@/server/jobs/outbox'
import { jobLabel } from '@/server/notifications'
import { customerName } from '@/server/orders/model'
import { isQueue, orders, QUEUES, type QueueKey } from '@/server/orders/repository'
import { withdrawals } from '@/server/orders/withdrawal'
import { enquiries } from '@/server/enquiries'
import { retryJobsAction } from './actions'
import { INVOICE_LABEL, ORDER_LABEL, PAYMENT_LABEL, tone } from './labels'

const dt = (d: Date) => d.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Every order at a glance, newest first, plus anything that needs a person. */
export default async function AdminPage({ searchParams }: PageProps<'/[lang]/admin'>) {
  await connection()
  const sp = await searchParams
  const q = String(sp.q ?? '').trim().slice(0, 80)
  const queueParam = String(sp.coada ?? '')
  const queue: QueueKey | undefined = isQueue(queueParam) ? queueParam : undefined
  const { issues } = loadConfig()
  const db = await getDb()
  const [list, problems, withdrawalList, messageCounts, followUps, counts] = await Promise.all([
    orders.list(db, { limit: 150, search: q || undefined, queue }),
    jobs.problems(db),
    withdrawals.recent(20),
    enquiries.counts(),
    orders.followUps(db),
    orders.queueCounts(db),
  ])
  const numberOf = new Map(list.map((o) => [o.id, o.orderNumber]))
  const errors = issues.filter((i) => i.level === 'error')

  return (
    <>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[34px] tracking-[-0.03em]">Comenzi</h1>
        <form className="flex gap-2">
          {queue && <input type="hidden" name="coada" value={queue} />}
          <input name="q" defaultValue={q} placeholder="Număr, email, nume, firmă" className="field !min-h-11 w-[280px] !py-2" aria-label="Caută comenzi" />
          <button className="btn-secondary sm !min-h-11">Caută</button>
        </form>
      </div>

      <nav aria-label="Cozi de lucru" className="mt-4 flex flex-wrap gap-2 text-[14px]">
        <Link href={q ? `/admin?q=${encodeURIComponent(q)}` : '/admin'} className={`rounded-full px-3.5 py-1.5 ${!queue ? 'bg-ink text-paper' : 'bg-paper text-ink'}`} aria-current={!queue ? 'page' : undefined}>
          Toate
        </Link>
        {(Object.keys(QUEUES) as QueueKey[]).map((k) => (
          <Link
            key={k}
            href={`/admin?coada=${k}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            aria-current={queue === k ? 'page' : undefined}
            className={`rounded-full px-3.5 py-1.5 tabular-nums ${queue === k ? 'bg-ink text-paper' : k === 'atentie' && counts[k] > 0 ? 'bg-[#fdecec] text-red-deep' : 'bg-paper text-ink'}`}
          >
            {QUEUES[k].label} · {counts[k]}
          </Link>
        ))}
      </nav>

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

      {(followUps.orders.length > 0 || followUps.payments.length > 0) && (
        <div className="mt-6 rounded-[14px] bg-paper p-5 shadow-[inset_0_0_0_1px_var(--color-red)]">
          <p className="font-semibold text-ink">Bani și facturi de rezolvat ({followUps.orders.length + followUps.payments.length})</p>
          <ul className="mt-3 divide-y divide-mist-2 text-[14px]">
            {followUps.orders.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span>
                  <span className="font-medium">#{f.orderNumber}</span>
                  {f.refund && <> · anulată, de rambursat {formatLei(f.outstandingMinor)}</>}
                  {f.storno && <> · factură emisă, fără storno</>}
                </span>
                <Link href={`/admin/orders/${f.id}`} className="underline underline-offset-4">
                  Vezi comanda
                </Link>
              </li>
            ))}
            {followUps.payments.map((p) => (
              <li key={p.eventId} className="py-2">
                <span className="font-medium">Plată Stripe neaplicată</span> · {p.type} · {p.reason} · {dt(p.receivedAt)} · <span className="text-muted">{p.eventId}</span>
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
                  <span className="font-medium">{jobLabel(j.kind, (j.payload.template ?? j.payload.event) as string | undefined)}</span> · {j.status === 'failed' ? 'oprit' : `reîncercare ${j.attempts}`} ·{' '}
                  <span className="text-muted">{j.lastError}</span>
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

      {/* Select orders, then print their documents (A4) in one go. */}
      <form action="/admin/print" method="get" target="_blank" className="mt-6">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[14px]">
        <span className="text-muted">Pentru comenzile bifate:</span>
        <button name="doc" value="pregatire" className="btn-secondary sm">Fișe de pregătire</button>
        <button name="doc" value="livrare" className="btn-secondary sm">Fișe de livrare</button>
        <button name="doc" value="eticheta" className="btn-secondary sm">Etichete colet (interne)</button>
        <button name="doc" value="detalii" className="btn-secondary sm">Detalii comenzi</button>
      </div>
      <div className="overflow-x-auto rounded-[16px] bg-paper">
        <table className="w-full min-w-[900px] text-left text-[14.5px]">
          <thead className="text-[13px] text-muted">
            <tr className="border-b border-mist-2">
              <th className="w-10 px-4 py-3 font-medium">
                <span className="sr-only">Selectează</span>
              </th>
              {['Comanda', 'Data', 'Client', 'Produse', 'Total', 'Plată', 'Stare plată', 'Stare comandă', 'Factură'].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id} className="border-b border-mist-2 last:border-0 hover:bg-mist/60">
                <td className="px-4 py-3">
                  <input type="checkbox" name="ids" value={o.id} aria-label={`Selectează ${o.orderNumber}`} className="h-4 w-4 accent-[var(--color-ink)]" />
                </td>
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
                <td className="px-4 py-3 text-[13px]">{o.items.map((i) => `${i.quantity} × ${i.productName.replace('NEUROS ', '')}${i.variantName ? ` (${i.variantName})` : ''}`).join(', ')}</td>
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
                <td colSpan={10} className="px-4 py-10 text-center text-muted">
                  {q || queue ? 'Nicio comandă găsită.' : 'Încă nu există comenzi.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </form>
    </>
  )
}
