import Link from 'next/link'
import { connection } from 'next/server'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { blockFor, bookOrders } from '@/server/digital/delivery'
import { customerName, PAYMENT_METHOD_LABEL } from '@/server/orders/model'
import { JOB_STATUS, ORDER_LABEL, PAYMENT_LABEL, tone } from '../labels'
import { dt, EMAIL_LABEL } from './format'


/**
 * Admin → Livrare digitală: every order with Diana L. Palotaș's book, and where its PDF stands (access, email,
 * downloads). Card attempts never paid are left out (they are not orders yet). Actions are on each order's page.
 */
export default async function DigitalDeliveryPage() {
  await connection()
  const c = getConfig()
  const db = await getDb()
  const list = await bookOrders(db)
  const failed = list.filter((x) => x.lastJob && (x.lastJob.status === 'failed' || x.lastJob.status === 'retry'))
  const sent = list.filter((x) => x.entitlement?.emailStatus === 'sent').length
  const waiting = list.filter((x) => !x.entitlement && !blockFor(x.order, null, c)).length

  return (
    <>
      <h1 className="mt-2 text-[34px] tracking-[-0.03em]">Livrare digitală</h1>
      <p className="mt-1 max-w-[760px] text-[15px] text-muted">
        Cartea Dianei L. Palotaș: accesul la PDF și emailurile. Cardul primește PDF-ul imediat după confirmarea Stripe, transferul după ce confirmi plata, rambursul după ce comanda este marcată Livrată. PDF-ul nu este stocat aici: fiecare descărcare autorizată îl aduce de la NEUROS.
      </p>
      {!c.digital && (
        <p className="mt-4 rounded-[12px] bg-[#fdecec] px-4 py-3 text-[14.5px] text-red-deep">
          Sursa PDF nu este configurată (NEUROS_BOOK_PDF_URL, NEUROS_BOOK_PDF_SECRET, DIGITAL_LINK_SECRET). Cartea nu apare în magazin și nu se pot trimite linkuri.
        </p>
      )}

      <dl className="mt-6 grid gap-3 sm:grid-cols-4">
        {(
          [
            ['Comenzi cu cartea', list.length],
            ['Email trimis', sent],
            ['Cu acces, fără email', list.filter((x) => x.entitlement && x.entitlement.emailStatus !== 'sent').length + waiting],
            ['Joburi email eșuate', failed.length],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="rounded-[16px] bg-paper p-4">
            <dt className="text-[13px] text-muted">{k}</dt>
            <dd className={`mt-1 text-[26px] font-medium tracking-[-0.02em] ${k === 'Joburi email eșuate' && v ? 'text-red-deep' : 'text-ink'}`}>{v}</dd>
          </div>
        ))}
      </dl>

      {failed.length > 0 && (
        <section className="mt-6 rounded-[16px] bg-[#fdecec] p-5">
          <h2 className="text-[16px] font-semibold text-red-deep">Emailuri cu PDF-ul care nu au plecat</h2>
          <ul className="mt-2 space-y-1 text-[14px] text-ink">
            {failed.map((x) => (
              <li key={x.order.id}>
                <Link href={`/admin/livrare-digitala/${x.order.id}`} className="font-medium underline underline-offset-4">
                  {x.order.orderNumber}
                </Link>{' '}
                · {JOB_STATUS[x.lastJob!.status] ?? x.lastJob!.status} · {x.lastJob!.lastError ?? '—'}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 overflow-x-auto rounded-[16px] bg-paper">
        <table className="w-full min-w-[1100px] text-left text-[14px]">
          <thead className="text-[12.5px] text-muted">
            <tr className="border-b border-mist-2">
              {['Comanda', 'Client', 'Email', 'Plată', 'Status plată', 'Livrare fizică', 'Acces PDF', 'Email PDF', 'Descărcări', 'Ultima încercare'].map((h) => (
                <th key={h} className="px-3 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map(({ order: o, entitlement: e, lastJob }) => {
              const block = blockFor(o, e, c)
              const access = e?.status === 'active' && !block ? 'Activ' : e?.status === 'revoked' ? 'Revocat' : block ? 'Blocat' : 'Se acordă'
              return (
                <tr key={o.id} className="border-b border-mist-2 last:border-0 align-top">
                  <td className="px-3 py-3">
                    <Link href={`/admin/livrare-digitala/${o.id}`} className="font-medium text-ink underline underline-offset-4">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-ink">{customerName(o.customer)}</td>
                  <td className="px-3 py-3 text-text">{o.email}</td>
                  <td className="px-3 py-3 text-text">{PAYMENT_METHOD_LABEL[o.paymentMethod]}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[12.5px] font-medium ${tone(o.paymentStatus)}`}>{PAYMENT_LABEL[o.paymentStatus]}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[12.5px] font-medium ${tone(o.status)}`}>{ORDER_LABEL[o.status]}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[12.5px] font-medium ${access === 'Activ' ? 'bg-cyan-50 text-cyan-700' : access === 'Blocat' || access === 'Revocat' ? 'bg-[#fdecec] text-red-deep' : 'bg-mist text-ink'}`}>{access}</span>
                    {block && <span className="mt-1 block max-w-[220px] text-[12.5px] leading-snug text-muted">{block.text}</span>}
                  </td>
                  <td className="px-3 py-3 text-text">
                    {e ? EMAIL_LABEL[e.emailStatus] : '—'}
                    {e && e.emailsSent > 1 && <span className="text-muted"> ({e.emailsSent}×)</span>}
                  </td>
                  <td className="px-3 py-3 text-text tabular-nums">{e ? `${e.downloads}${e.lastDownloadAt ? ` · ${dt(e.lastDownloadAt)}` : ''}` : '—'}</td>
                  <td className="px-3 py-3 text-text">
                    {dt(e?.lastAttemptAt ?? lastJob?.at ?? null)}
                    {lastJob && lastJob.status !== 'done' && <span className="block text-[12.5px] text-muted">job: {JOB_STATUS[lastJob.status] ?? lastJob.status}</span>}
                  </td>
                </tr>
              )
            })}
            {!list.length && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-muted">
                  Nicio comandă cu cartea încă.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
