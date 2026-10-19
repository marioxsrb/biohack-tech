import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { BULK_OFFER } from '@/config/promotions'
import { formatMoney } from '@/lib/currency'
import { getDb } from '@/server/db'
import { customerName, formatAddress, PAYMENT_METHOD_LABEL, type Order } from '@/server/orders/model'
import { orders } from '@/server/orders/repository'
import { confirmTeamAction } from '../actions'
import { ORDER_LABEL, PAYMENT_LABEL, tone } from '../labels'

export const metadata: Metadata = { title: 'Comenzi companii' }

const dt = (d: Date) => d.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** The tabs: each business order is in exactly one, from its canonical state and the team's confirmation. */
const TABS = {
  toate: { label: 'Toate', test: () => true },
  noi: { label: 'Noi (48 h)', test: (o: Order) => o.status !== 'cancelled' && Date.now() - o.createdAt.getTime() < 48 * 3_600_000 },
  confirmare: { label: 'Așteaptă confirmarea', test: (o: Order) => o.teamConfirmation === 'awaiting' && o.status !== 'cancelled' },
  confirmate: { label: 'Confirmate, de pregătit', test: (o: Order) => o.status === 'confirmed' && o.teamConfirmation !== 'awaiting' && (o.paymentMethod !== 'card' || o.paymentStatus === 'paid') },
  pregatire: { label: 'În pregătire', test: (o: Order) => o.status === 'processing' },
  expediate: { label: 'Expediate', test: (o: Order) => o.status === 'shipped' || o.status === 'delivered' },
  anulate: { label: 'Anulate', test: (o: Order) => o.status === 'cancelled' },
} as const
type Tab = keyof typeof TABS

const CONFIRMATION: Record<string, string> = { awaiting: 'Așteaptă confirmarea echipei', confirmed: 'Confirmată de echipă' }

/**
 * Business orders (40% from 25 Calm + Focus units): who ordered, what, the money, and the team's phone confirmation
 * for cash on delivery and transfer. Confirming here lets the order into preparation (and the fulfillment portal).
 */
export default async function CompaniesPage({ searchParams }: PageProps<'/[lang]/admin/companii'>) {
  await connection()
  const sp = await searchParams
  const tab: Tab = String(sp.tab ?? '') in TABS ? (String(sp.tab) as Tab) : 'toate'
  // Card attempts never paid are not orders yet.
  const all = (await orders.bulk(await getDb())).filter((o) => o.paymentMethod !== 'card' || o.paymentStatus !== 'pending' || o.status !== 'pending')
  const list = all.filter(TABS[tab].test)

  return (
    <div className="mx-auto max-w-[1100px]">
      <h1 className="text-[30px] tracking-[-0.03em]">Comenzi companii</h1>
      <p className="mt-1 text-[15px] text-text">
        Comenzile cu reducerea pentru companii ({BULK_OFFER.percent}% de la {BULK_OFFER.minUnits} de bucăți NEUROS Calm și Focus). La ramburs și transfer, sună clientul și confirmă comanda: abia apoi intră la pregătire.
      </p>
      <nav aria-label="Filtre" className="mt-5 flex flex-wrap gap-2">
        {(Object.keys(TABS) as Tab[]).map((k) => (
          <Link
            key={k}
            href={k === 'toate' ? '/admin/companii' : `/admin/companii?tab=${k}`}
            aria-current={tab === k ? 'page' : undefined}
            className={`rounded-full px-3.5 py-1.5 text-[14px] ${tab === k ? 'bg-ink text-white' : 'bg-paper text-ink hover:bg-mist'}`}
          >
            {TABS[k].label} · {all.filter(TABS[k].test).length}
          </Link>
        ))}
      </nav>

      {list.length === 0 ? (
        <p className="mt-8 rounded-[18px] bg-paper p-6 text-[15px] text-muted">Nicio comandă aici.</p>
      ) : (
        <ul className="mt-6 grid gap-4">
          {list.map((o) => {
            const c = o.customer
            const company = c.buyerType === 'pj' ? `${c.company} · CUI ${c.cui}` : null
            return (
              <li key={o.id} className="rounded-[18px] bg-paper p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/admin/orders/${o.id}`} className="text-[18px] font-semibold text-ink underline-offset-4 hover:underline">
                      {o.orderNumber}
                    </Link>
                    <span className="ml-2 text-[13.5px] text-muted">{dt(o.createdAt)}</span>
                    <p className="mt-1 text-[15px] text-ink">{company ?? customerName(c)}</p>
                    {company && <p className="text-[14px] text-muted">Contact: {customerName(c)}</p>}
                    <p className="text-[14px] text-muted">
                      <a href={`tel:${o.phone.replace(/\s/g, '')}`} className="underline underline-offset-4">
                        {o.phone}
                      </a>{' '}
                      ·{' '}
                      <a href={`mailto:${o.email}`} className="underline underline-offset-4">
                        {o.email}
                      </a>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[12.5px]">
                    <span className={`rounded-full px-2.5 py-1 ${tone(o.status)}`}>{ORDER_LABEL[o.status]}</span>
                    <span className={`rounded-full px-2.5 py-1 ${tone(o.paymentStatus)}`}>
                      {PAYMENT_METHOD_LABEL[o.paymentMethod]} · {PAYMENT_LABEL[o.paymentStatus]}
                    </span>
                    {o.teamConfirmation && (
                      <span className={`rounded-full px-2.5 py-1 ${o.teamConfirmation === 'awaiting' ? 'bg-[#fff4d6] text-[#7a5300]' : 'bg-cyan-50 text-cyan-700'}`}>{CONFIRMATION[o.teamConfirmation]}</span>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-[12.5px] font-medium tracking-[0.08em] text-muted uppercase">Produse</p>
                    <ul className="mt-1 text-[14.5px] text-ink">
                      {o.items.map((i) => (
                        <li key={i.position}>
                          {i.quantity} × {i.productName}
                          {i.variantName ? ` (${i.variantName})` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <dl className="text-[14.5px]">
                    <p className="text-[12.5px] font-medium tracking-[0.08em] text-muted uppercase">Valoare</p>
                    <div className="mt-1 flex justify-between gap-3">
                      <dt className="text-muted">Total inițial</dt>
                      <dd className="tabular-nums">{formatMoney(o.subtotalMinor, o.currency)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 text-cyan-700">
                      <dt>Reducere companii</dt>
                      <dd className="tabular-nums">−{formatMoney(o.promotions.find((p) => p.id === BULK_OFFER.id)?.amountMinor ?? 0, o.currency)}</dd>
                    </div>
                    {o.discountMinor > (o.promotions.find((p) => p.id === BULK_OFFER.id)?.amountMinor ?? 0) && (
                      <div className="flex justify-between gap-3 text-muted">
                        <dt>Alte reduceri</dt>
                        <dd className="tabular-nums">−{formatMoney(o.discountMinor - (o.promotions.find((p) => p.id === BULK_OFFER.id)?.amountMinor ?? 0), o.currency)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-3 font-semibold text-ink">
                      <dt>Total final</dt>
                      <dd className="tabular-nums">{formatMoney(o.totalMinor, o.currency)}</dd>
                    </div>
                  </dl>
                  <div className="text-[14.5px]">
                    <p className="text-[12.5px] font-medium tracking-[0.08em] text-muted uppercase">Livrare</p>
                    <p className="mt-1 text-ink">{formatAddress(o.shippingAddress)}</p>
                    {o.notes && <p className="mt-1 text-muted">Observații: {o.notes}</p>}
                    {o.trackingNumber && (
                      <p className="mt-1 text-muted">
                        AWB {o.trackingNumber}
                        {o.courier ? ` · ${o.courier}` : ''}
                      </p>
                    )}
                  </div>
                </div>

                {o.teamConfirmation === 'awaiting' && o.status !== 'cancelled' && (
                  <form action={confirmTeamAction} className="mt-4 flex flex-wrap items-center gap-3 rounded-[12px] bg-white p-3">
                    <input type="hidden" name="id" value={o.id} />
                    <label className="flex items-center gap-2 text-[14px] text-ink">
                      <input type="checkbox" name="confirm" value="da" required className="h-4 w-4" />
                      Am vorbit cu clientul: cantitățile și livrarea sunt confirmate.
                    </label>
                    <button className="cta sm">Confirmă comanda</button>
                  </form>
                )}
                {o.teamConfirmedAt && (
                  <p className="mt-3 text-[13px] text-muted">
                    Confirmată {dt(o.teamConfirmedAt)}
                    {o.teamConfirmedBy ? ` de ${o.teamConfirmedBy}` : ''}.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
