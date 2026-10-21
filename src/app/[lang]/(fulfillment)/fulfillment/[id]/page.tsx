import { isGiftLine } from '@/lib/orders/gifts'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { isBulk } from '@/config/promotions'
import { formatLei } from '@/lib/money'
import { getDb } from '@/server/db'
import { shipmentFor } from '@/server/fulfillment/courier'
import { awaitingTeam, PORTAL_QUEUES, queueOf } from '@/server/fulfillment/portal'
import { customerName, PAYMENT_METHOD_LABEL } from '@/server/orders/model'
import { orders } from '@/server/orders/repository'
import { canFulfil, canMoveOrder } from '@/server/orders/state'
import { ORDER_LABEL } from '../../../(admin)/admin/labels'
import { issueAction, noteAwbAction, preparedAction, shippedAction, startPreparingAction } from '../actions'

export const metadata: Metadata = { title: 'Comandă' }

const dt = (d: Date | null) => (d ? d.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '–')
const COURIERS = ['Fan Courier', 'Sameday', 'Cargus', 'DPD', 'GLS', 'Poșta Română']

/** One order for the warehouse: what to pack, where it goes, the next step, the documents to print. */
export default async function FulfillmentOrder({ params }: PageProps<'/[lang]/fulfillment/[id]'>) {
  await connection()
  const { id } = await params
  const o = await orders.byId(await getDb(), id)
  if (!o) notFound()
  const s = shipmentFor(o)
  const queue = queueOf(o)
  const waiting = awaitingTeam(o)
  const workable = canFulfil(o) && o.status !== 'cancelled'
  const print = (doc: string) => `/fulfillment/print?doc=${doc}&ids=${o.id}`

  return (
    <div className="mx-auto max-w-[860px]">
      <Link href={queue ? `/fulfillment?coada=${queue}` : '/fulfillment'} className="text-[14px] text-muted underline underline-offset-4">
        ← {queue ? PORTAL_QUEUES[queue] : 'Comenzi'}
      </Link>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[28px] tracking-[-0.02em]">{o.orderNumber}</h1>
        <span className="flex flex-wrap gap-1.5 text-[12.5px]">
          <span className="rounded-full bg-paper px-2.5 py-1 shadow-[0_0_0_1px_var(--color-line)]">{ORDER_LABEL[o.status]}</span>
          {o.preparedAt && o.status === 'processing' && <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-cyan-700">Pregătită {dt(o.preparedAt)}</span>}
          {isBulk(o.promotions) && <span className="rounded-full bg-ink px-2.5 py-1 font-semibold text-white">Companie</span>}
        </span>
      </div>
      <p className="text-[13.5px] text-muted">Plasată {dt(o.createdAt)}</p>

      {waiting && (
        <p role="status" className="mt-4 rounded-[14px] bg-[#fff4d6] p-4 text-[15px] font-medium text-[#5c3f00]">
          Așteaptă confirmarea echipei. Comanda de companie se pregătește doar după ce echipa o confirmă telefonic (în /admin).
        </p>
      )}
      {o.fulfillmentIssue && (
        <div role="alert" className="mt-4 rounded-[14px] bg-[#fdecec] p-4 text-[15px] text-red-deep">
          <p className="font-semibold">Problemă raportată {dt(o.fulfillmentIssueAt)}</p>
          <p className="mt-0.5">{o.fulfillmentIssue}</p>
          <form action={issueAction} className="mt-2">
            <input type="hidden" name="id" value={o.id} />
            <input type="hidden" name="clear" value="1" />
            <button className="text-[14px] underline underline-offset-4">Problema e rezolvată</button>
          </form>
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <section className="rounded-[18px] bg-paper p-5">
          <h2 className="text-[13px] font-semibold tracking-[0.1em] text-muted uppercase">De pus în colet</h2>
          <ul className="mt-2 divide-y divide-mist-2">
            {o.items.map((i) => (
              <li key={i.position} className="flex items-baseline justify-between gap-3 py-2.5">
                <span>
                  <span className="block text-[16px] font-semibold text-ink">{i.productName}</span>
                  <span className="text-[14px] text-muted">
                    {i.variantName ?? 'Fără variantă'} · {i.sku}
                    {isGiftLine(o, i) ? ' · cadou (recompensă)' : ''}
                  </span>
                </span>
                <span className="text-[22px] font-semibold text-ink tabular-nums">×{i.quantity}</span>
              </li>
            ))}
          </ul>
          {o.notes && <p className="mt-2 rounded-[10px] bg-mist p-2.5 text-[14px] text-ink">Observații client: {o.notes}</p>}
        </section>

        <section className="rounded-[18px] bg-paper p-5 text-[15px]">
          <h2 className="text-[13px] font-semibold tracking-[0.1em] text-muted uppercase">Livrare</h2>
          <p className="mt-2 text-[17px] font-semibold text-ink">{s.recipient}</p>
          {o.customer.buyerType === 'pj' && <p className="text-[14px] text-muted">Contact: {customerName(o.customer)}</p>}
          <p className="mt-1 text-ink">{o.shippingAddress.address}</p>
          <p className="text-ink">
            {o.shippingAddress.postalCode} {o.shippingAddress.city}, jud. {o.shippingAddress.county}
          </p>
          <a href={`tel:${o.phone.replace(/\s/g, '')}`} className="mt-1 inline-block font-semibold text-ink underline underline-offset-4 tabular-nums">
            {o.phone}
          </a>
          <div className="mt-3 border-t border-mist-2 pt-3">
            <p className="text-muted">{PAYMENT_METHOD_LABEL[o.paymentMethod]}</p>
            {s.cashOnDeliveryMinor > 0 ? <p className="text-[19px] font-semibold text-ink">Ramburs de încasat: {formatLei(s.cashOnDeliveryMinor)}</p> : <p className="text-ink">Nimic de încasat la livrare.</p>}
          </div>
          <div className="mt-3 border-t border-mist-2 pt-3 text-[14px]">
            <p>
              Curier: <b>{o.courier ?? '–'}</b> · AWB: <b className="tabular-nums">{o.trackingNumber ?? '–'}</b>
            </p>
            {o.trackingUrl && (
              <a href={o.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-700 underline underline-offset-4">
                Urmărire colet
              </a>
            )}
            {o.shippedAt && <p className="text-muted">Expediată {dt(o.shippedAt)}</p>}
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-[18px] bg-paper p-5">
        <h2 className="text-[13px] font-semibold tracking-[0.1em] text-muted uppercase">Pasul următor</h2>
        <div className="mt-3 space-y-3">
          {workable && canMoveOrder(o.status, 'processing') && o.status === 'confirmed' && (
            <form action={startPreparingAction}>
              <input type="hidden" name="id" value={o.id} />
              <button className="cta w-full sm:w-auto">Încep pregătirea</button>
            </form>
          )}
          {workable && o.status === 'processing' && !o.preparedAt && (
            <form action={preparedAction}>
              <input type="hidden" name="id" value={o.id} />
              <button className="cta w-full sm:w-auto">Coletul este pregătit</button>
            </form>
          )}
          {workable && (o.status === 'processing' || o.status === 'confirmed') && (
            <form className="grid gap-2 rounded-[14px] bg-mist p-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={o.id} />
              <p className="text-[14px] text-text sm:col-span-2">AWB-ul îl emite curierul (din portalul lui). Aici îl treci doar ca să-l vadă clientul și echipa.</p>
              <label className="grid gap-1 text-[14px]">
                <span className="font-medium text-ink">Curier</span>
                <input name="courier" required list="couriers" defaultValue={o.courier ?? ''} placeholder="ex. Fan Courier" className="field !min-h-11 !py-2" />
              </label>
              <label className="grid gap-1 text-[14px]">
                <span className="font-medium text-ink">AWB</span>
                <input name="tracking" required defaultValue={o.trackingNumber ?? ''} inputMode="text" className="field !min-h-11 !py-2" />
              </label>
              <label className="grid gap-1 text-[14px] sm:col-span-2">
                <span className="font-medium text-ink">Link de urmărire (opțional)</span>
                <input name="trackingUrl" type="url" defaultValue={o.trackingUrl ?? ''} placeholder="https://…" className="field !min-h-11 !py-2" />
              </label>
              <datalist id="couriers">
                {COURIERS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                {o.status === 'processing' && (
                  <button formAction={noteAwbAction} className="btn-secondary sm">
                    Salvează AWB-ul
                  </button>
                )}
                {canMoveOrder(o.status, 'shipped') && (
                  <button formAction={shippedAction} className="cta sm">
                    Marchează expediată
                  </button>
                )}
              </div>
              <p className="text-[12.5px] text-muted sm:col-span-2">„Marchează expediată” trimite clientului emailul cu AWB-ul.</p>
            </form>
          )}
          {!workable && !waiting && o.status !== 'shipped' && o.status !== 'delivered' && <p className="text-[15px] text-muted">Comanda nu poate fi pregătită acum (neplătită sau anulată).</p>}
          {(o.status === 'shipped' || o.status === 'delivered') && <p className="text-[15px] text-muted">Comanda e la curier{o.status === 'delivered' ? ' și a fost livrată' : ''}. Nimic de făcut.</p>}
        </div>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="rounded-[18px] bg-paper p-5">
          <h2 className="text-[13px] font-semibold tracking-[0.1em] text-muted uppercase">Printare (A4)</h2>
          <div className="mt-3 flex flex-wrap gap-2 text-[14px]">
            <a href={print('pregatire')} target="_blank" className="btn-secondary sm">
              Fișă de pregătire
            </a>
            <a href={print('livrare')} target="_blank" className="btn-secondary sm">
              Fișă de livrare
            </a>
            <a href={print('eticheta')} target="_blank" className="btn-secondary sm">
              Etichetă internă
            </a>
            <a href={print('detalii')} target="_blank" className="btn-secondary sm">
              Detaliile comenzii
            </a>
          </div>
          <p className="mt-2 text-[12.5px] text-muted">Eticheta internă nu este AWB: AWB-ul oficial îl tipărești din portalul curierului.</p>
        </section>
        {o.status !== 'cancelled' && o.status !== 'delivered' && (
          <section className="rounded-[18px] bg-paper p-5">
            <h2 className="text-[13px] font-semibold tracking-[0.1em] text-muted uppercase">Raportează o problemă</h2>
            <form action={issueAction} className="mt-3 grid gap-2">
              <input type="hidden" name="id" value={o.id} />
              <textarea name="issue" required maxLength={500} rows={3} placeholder="ex. NEUROS Focus lipsă din stoc; adresa incompletă" className="field !py-2" />
              <button className="btn-secondary sm w-fit">Trimite echipei</button>
              <p className="text-[12.5px] text-muted">Echipa primește un email și comanda apare la „Probleme”.</p>
            </form>
          </section>
        )}
      </div>
    </div>
  )
}
