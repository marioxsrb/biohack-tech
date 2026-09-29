import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { formatLei } from '@/lib/money'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { jobs } from '@/server/jobs/outbox'
import { customerName, formatAddress } from '@/server/orders/model'
import { marketing } from '@/server/marketing/consent'
import { orders } from '@/server/orders/repository'
import { withdrawals } from '@/server/orders/withdrawal'
import { canMoveOrder, isPaid } from '@/server/orders/state'
import { cancelAction, deliveredAction, markPaidAction, processingAction, refundAction, resyncCrmAction, retryJobsAction, shipAction } from '../../actions'
import { INVOICE_LABEL, ORDER_LABEL, PAYMENT_LABEL, tone } from '../../labels'

const dt = (d: Date | string | null) =>
  d ? new Date(d).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–'

export default async function AdminOrderPage({ params }: PageProps<'/admin/orders/[id]'>) {
  await connection()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const db = await getDb()
  const o = await orders.byId(db, id)
  if (!o) notFound()
  const [events, jobList, consent, withdrawalList] = await Promise.all([orders.events(db, id), jobs.forOrder(db, id), marketing.state(db, o.email), withdrawals.forOrder(id)])
  const c = getConfig()
  const paid = isPaid(o.paymentStatus)

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-[34px] tracking-[-0.03em]">{o.orderNumber}</h1>
        <span className={`rounded-full px-3 py-1 text-[13px] font-medium ${tone(o.paymentStatus)}`}>{PAYMENT_LABEL[o.paymentStatus]}</span>
        <span className={`rounded-full px-3 py-1 text-[13px] font-medium ${tone(o.status)}`}>{ORDER_LABEL[o.status]}</span>
        <Link href={`/comanda/${o.publicToken}`} className="ml-auto text-[14px] underline underline-offset-4" target="_blank">
          Pagina clientului
        </Link>
      </div>
      <p className="mt-1 text-[14.5px] text-muted">
        {dt(o.createdAt)} · {o.paymentMethod === 'card' ? 'Card' : 'Transfer bancar'} · {formatLei(o.totalMinor)}
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          <Panel title="Produse">
            <ul className="divide-y divide-mist-2">
              {o.items.map((i) => (
                <li key={i.position} className="flex justify-between gap-4 py-2.5">
                  <span>
                    {i.quantity} × {i.productName}
                    {i.variantName && <span className="text-muted"> · {i.variantName}</span>}
                    <span className="block text-[13px] text-muted">
                      {i.sku} · {formatLei(i.unitPriceMinor)} / buc.
                    </span>
                  </span>
                  <span className="tabular-nums">{formatLei(i.lineTotalMinor)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex justify-between border-t border-mist-2 pt-2 font-semibold">
              <span>Total (livrare {o.shippingMinor ? formatLei(o.shippingMinor) : 'gratuită'})</span>
              <span className="tabular-nums">{formatLei(o.totalMinor)}</span>
            </p>
            {o.refundedMinor > 0 && <p className="mt-1 text-right text-[14px] text-red-deep">Rambursat: {formatLei(o.refundedMinor)}</p>}
          </Panel>

          <Panel title="Client și livrare">
            <Rows
              rows={[
                ['Tip', o.customer.buyerType === 'pj' ? 'Persoană juridică' : 'Persoană fizică'],
                ...(o.customer.buyerType === 'pj'
                  ? ([
                      ['Firmă', o.customer.company ?? ''],
                      ['CUI', o.customer.cui ?? ''],
                      ['Reg. Com.', o.customer.regCom ?? '–'],
                    ] as [string, string][])
                  : []),
                ['Persoană de contact', customerName(o.customer)],
                ['Email', o.email],
                ['Telefon', o.phone],
                ['Adresă facturare', formatAddress(o.billingAddress)],
                ['Adresă livrare', formatAddress(o.shippingAddress)],
                ['Observații', o.notes || '–'],
                ['Bifă marketing la această comandă', o.marketingConsent ? 'Da' : 'Nu'],
                ['Marketing email acum', consent ? `${consent.granted ? 'Acord' : 'Retras'} · ${dt(consent.at)} · ${consent.source} · ${consent.version}` : 'Fără acord'],
                ...(o.recoveryStatus
                  ? ([['Recuperare checkout', `${o.recoveryStatus === 'eligible' ? 'Permisă' : 'Nepermisă'} (${o.recoveryReason})`]] as [string, string][])
                  : []),
              ]}
            />
          </Panel>

          {withdrawalList.length > 0 && (
            <Panel title="Cereri de retragere">
              <ul className="space-y-2 text-[14px]">
                {withdrawalList.map((w) => (
                  <li key={w.id}>
                    <span className="font-medium">{w.reference}</span> · {dt(w.createdAt)} · {w.items}
                    {w.message && <span className="block text-muted">{w.message}</span>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Istoric">
            <ul className="space-y-1.5 text-[14px]">
              {events.map((e, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-[130px] flex-none text-muted tabular-nums">{dt(e.created_at)}</span>
                  <span>
                    <span className="font-medium">{e.type}</span> <span className="text-muted">· {e.source}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-5 lg:col-span-5">
          <Panel title="Acțiuni">
            <div className="space-y-4">
              {o.paymentMethod === 'bank_transfer' && o.paymentStatus === 'awaiting_transfer' && o.status !== 'cancelled' && (
                <form action={markPaidAction} className="rounded-[12px] bg-mist p-4">
                  <input type="hidden" name="id" value={o.id} />
                  <p className="text-[14px] text-text">
                    Confirmă doar după ce vezi în extras <strong>{formatLei(o.totalMinor)}</strong> cu referința <strong>{o.orderNumber}</strong>.
                  </p>
                  <button className="cta sm mt-3">Plata a fost primită</button>
                </form>
              )}
              {paid && canMoveOrder(o.status, 'processing') && (
                <form action={processingAction}>
                  <input type="hidden" name="id" value={o.id} />
                  <button className="btn-secondary sm w-full">Marchează în pregătire</button>
                </form>
              )}
              {paid && canMoveOrder(o.status, 'shipped') && (
                <form action={shipAction} className="space-y-2 rounded-[12px] bg-mist p-4">
                  <input type="hidden" name="id" value={o.id} />
                  <p className="text-[14px] font-medium">Expediere</p>
                  <input name="courier" required placeholder="Curier (ex. Fan Courier)" className="field !min-h-11 !py-2" aria-label="Curier" />
                  <input name="tracking" required placeholder="Număr AWB" className="field !min-h-11 !py-2" aria-label="Număr AWB" />
                  <input name="trackingUrl" type="url" placeholder="Link urmărire (https://...)" className="field !min-h-11 !py-2" aria-label="Link urmărire" />
                  <button className="cta sm w-full">Marchează expediată și anunță clientul</button>
                </form>
              )}
              {canMoveOrder(o.status, 'delivered') && (
                <form action={deliveredAction}>
                  <input type="hidden" name="id" value={o.id} />
                  <button className="btn-secondary sm w-full">Marchează livrată</button>
                </form>
              )}
              {o.paymentMethod === 'bank_transfer' && paid && (
                <form action={refundAction} className="space-y-2 rounded-[12px] bg-mist p-4">
                  <input type="hidden" name="id" value={o.id} />
                  <p className="text-[14px] text-text">După ce ai returnat banii din bancă, înregistrează totalul rambursat până acum (lei).</p>
                  <input name="amount" inputMode="decimal" required placeholder={`ex. ${(o.totalMinor / 100).toFixed(2)}`} className="field !min-h-11 !py-2" aria-label="Total rambursat în lei" />
                  <button className="btn-secondary sm w-full">Înregistrează rambursarea</button>
                </form>
              )}
              {canMoveOrder(o.status, 'cancelled') && (
                <form action={cancelAction} className="space-y-2">
                  <input type="hidden" name="id" value={o.id} />
                  <input name="reason" placeholder="Motivul anulării" className="field !min-h-11 !py-2" aria-label="Motivul anulării" />
                  <button className="btn-secondary sm w-full !text-red-deep">Anulează comanda</button>
                  {paid && <p className="text-[13px] text-muted">Comanda este plătită: fă rambursarea din Stripe (card) sau din bancă (transfer).</p>}
                </form>
              )}
            </div>
          </Panel>

          <Panel title="Plată, factură, CRM">
            <Rows
              rows={[
                ['Plătită la', dt(o.paidAt)],
                ['Stripe', o.stripePaymentIntentId ?? '–'],
                ['Factură', o.fgoInvoiceNumber ? `${o.fgoInvoiceSeries} ${o.fgoInvoiceNumber}` : INVOICE_LABEL[o.invoiceStatus]],
                ['Storno', o.fgoStornoNumber ?? '–'],
                ['GHL contact', o.ghlContactId ?? '–'],
                ['GHL oportunitate', o.ghlOpportunityId ?? '–'],
                ['Curier / AWB', o.trackingNumber ? `${o.courier} · ${o.trackingNumber}` : '–'],
              ]}
            />
            {o.fgoInvoiceLink && (
              <a href={o.fgoInvoiceLink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[14px] underline underline-offset-4">
                Descarcă factura
              </a>
            )}
            {o.stripePaymentIntentId && c.stripe && (
              <a href={`https://dashboard.stripe.com/${c.stripe.live ? '' : 'test/'}payments/${o.stripePaymentIntentId}`} target="_blank" rel="noopener noreferrer" className="mt-2 ml-4 inline-block text-[14px] underline underline-offset-4">
                Deschide în Stripe
              </a>
            )}
            {c.ghl && (
              <form action={resyncCrmAction} className="mt-3">
                <input type="hidden" name="id" value={o.id} />
                <button className="btn-secondary sm">Resincronizează în GoHighLevel</button>
              </form>
            )}
          </Panel>

          <Panel title="Sincronizări">
            <ul className="space-y-2 text-[14px]">
              {jobList.map((j) => (
                <li key={j.id} className="flex items-start justify-between gap-3">
                  <span>
                    <span className="font-medium">{j.kind}</span>
                    {j.payload.template ? ` · ${String(j.payload.template)}` : ''}
                    <span className="block text-[13px] text-muted">
                      {j.status}
                      {j.attempts ? ` · ${j.attempts} încercări` : ''}
                      {j.lastError ? ` · ${j.lastError}` : ''}
                    </span>
                  </span>
                  {(j.status === 'failed' || j.status === 'retry') && (
                    <form action={retryJobsAction}>
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="jobId" value={j.id} />
                      <button className="btn-secondary sm">Reîncearcă</button>
                    </form>
                  )}
                </li>
              ))}
              {!jobList.length && <li className="text-muted">Nimic de sincronizat.</li>}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[16px] bg-paper p-5">
      <h2 className="mb-3 text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
      <div className="text-[14.5px]">{children}</div>
    </div>
  )
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y divide-mist-2">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[150px_1fr] gap-3 py-2">
          <dt className="text-muted">{k}</dt>
          <dd className="break-words">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
