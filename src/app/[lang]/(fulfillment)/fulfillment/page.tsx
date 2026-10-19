import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { isBulk } from '@/config/promotions'
import { formatLei } from '@/lib/money'
import { getDb } from '@/server/db'
import { shipmentFor } from '@/server/fulfillment/courier'
import { isPortalQueue, PORTAL_QUEUES, portalOrders, type PortalQueue } from '@/server/fulfillment/portal'
import { customerName, PAYMENT_METHOD_LABEL, type Order } from '@/server/orders/model'

export const metadata: Metadata = { title: 'Comenzi' }

const dt = (d: Date) => d.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** One order as the warehouse needs it: who, where, what, how it is paid at the door, courier. */
function OrderCard({ o }: { o: Order }) {
  const s = shipmentFor(o)
  return (
    <li>
      <Link href={`/fulfillment/${o.id}`} className="block rounded-[18px] bg-paper p-4 shadow-[0_0_0_1px_var(--color-line)] transition-shadow hover:shadow-[0_0_0_1.5px_var(--color-ink)] sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[17px] font-semibold text-ink">{o.orderNumber}</span>
          <span className="text-[13px] text-muted tabular-nums">{dt(o.createdAt)}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5 text-[12px]">
          {isBulk(o.promotions) && <span className="rounded-full bg-ink px-2 py-0.5 font-semibold text-white">Companie</span>}
          {o.kind === 'upsell' && <span className="rounded-full bg-mist px-2 py-0.5">Adăugată după plată</span>}
          {o.fulfillmentIssue && <span className="rounded-full bg-[#fdecec] px-2 py-0.5 font-semibold text-red-deep">Problemă</span>}
        </div>
        <p className="mt-2 text-[15px] font-medium text-ink">{s.recipient}</p>
        <p className="text-[14px] text-text">
          {o.shippingAddress.city}, jud. {o.shippingAddress.county} · <span className="tabular-nums">{o.phone}</span>
        </p>
        <ul className="mt-2 text-[14.5px] text-ink">
          {o.items.map((i) => (
            <li key={i.position}>
              <b className="tabular-nums">{i.quantity} ×</b> {i.productName}
              {i.variantName ? <span className="text-muted"> · {i.variantName}</span> : null}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-mist-2 pt-2.5 text-[13.5px]">
          <span className="text-muted">{PAYMENT_METHOD_LABEL[o.paymentMethod]}</span>
          {s.cashOnDeliveryMinor > 0 ? <span className="font-semibold text-ink">Ramburs {formatLei(s.cashOnDeliveryMinor)}</span> : <span className="text-muted">Nimic de încasat</span>}
        </div>
        {(o.trackingNumber || o.notes) && (
          <p className="mt-1.5 text-[13px] text-muted">
            {o.trackingNumber ? `${o.courier ?? 'Curier'} · AWB ${o.trackingNumber}` : ''}
            {o.trackingNumber && o.notes ? ' · ' : ''}
            {o.notes ? `Observații: ${o.notes}` : ''}
          </p>
        )}
      </Link>
    </li>
  )
}

/**
 * The warehouse's queues, oldest first where there is work to do. A business order paid at the door or by transfer
 * shows as "Așteaptă confirmarea echipei" and cannot be prepared until the team confirms it in /admin.
 */
export default async function FulfillmentHome({ searchParams }: PageProps<'/[lang]/fulfillment'>) {
  await connection()
  const sp = await searchParams
  const tab: PortalQueue = isPortalQueue(String(sp.coada ?? '')) ? (String(sp.coada) as PortalQueue) : 'noi'
  const { byQueue, awaiting } = await portalOrders(await getDb())
  const list = byQueue[tab]
  const ids = list.map((o) => o.id).join(',')

  return (
    <>
      <nav aria-label="Cozi" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
        {(Object.keys(PORTAL_QUEUES) as PortalQueue[]).map((k) => (
          <Link
            key={k}
            href={`/fulfillment?coada=${k}`}
            aria-current={tab === k ? 'page' : undefined}
            className={`flex min-h-11 flex-none items-center gap-2 rounded-full px-4 text-[14.5px] font-medium whitespace-nowrap ${tab === k ? 'bg-ink text-white' : 'bg-paper text-ink shadow-[0_0_0_1px_var(--color-line)]'} ${k === 'probleme' && byQueue.probleme.length ? '!text-red-deep' : ''}`}
          >
            {PORTAL_QUEUES[k]}
            <span className={`rounded-full px-1.5 text-[12.5px] tabular-nums ${tab === k ? 'bg-white/20' : 'bg-mist'}`}>{byQueue[k].length}</span>
          </Link>
        ))}
      </nav>

      {awaiting.length > 0 && (
        <section aria-label="Așteaptă confirmarea echipei" className="mt-4 rounded-[18px] bg-[#fff4d6] p-4 text-[14.5px] text-[#5c3f00]">
          <p className="font-semibold">Așteaptă confirmarea echipei · {awaiting.length}</p>
          <p className="mt-0.5">Comenzi de companie (ramburs sau transfer) pe care echipa le confirmă telefonic. Nu se pregătesc până la confirmare.</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {awaiting.map((o) => (
              <li key={o.id} className="rounded-full bg-white/70 px-3 py-1 tabular-nums">
                {o.orderNumber} · {o.customer.buyerType === 'pj' ? o.customer.company : customerName(o.customer)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[24px] tracking-[-0.02em]">
          {PORTAL_QUEUES[tab]} <span className="text-muted">· {list.length}</span>
        </h1>
        {list.length > 0 && (tab === 'noi' || tab === 'pregatire' || tab === 'pregatite' || tab === 'expediere') && (
          <span className="flex flex-wrap gap-2 text-[14px]">
            <a href={`/fulfillment/print?doc=pregatire&ids=${ids}`} target="_blank" className="btn-secondary sm">
              Fișe de pregătire
            </a>
            <a href={`/fulfillment/print?doc=eticheta&ids=${ids}`} target="_blank" className="btn-secondary sm">
              Etichete interne
            </a>
          </span>
        )}
      </div>

      {list.length === 0 ? (
        <p className="mt-4 rounded-[18px] bg-paper p-6 text-[15px] text-muted">Nimic aici acum.</p>
      ) : (
        <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((o) => (
            <OrderCard key={o.id} o={o} />
          ))}
        </ul>
      )}
    </>
  )
}
