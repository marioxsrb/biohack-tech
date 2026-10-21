import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { formatMoney } from '@/lib/currency'
import { getDb } from '@/server/db'
import { customerName, formatAddress, PAYMENT_METHOD_LABEL, type Order } from '@/server/orders/model'
import { orders } from '@/server/orders/repository'
import { REVIEW_AT } from '@/server/risk'
import { clearRiskAction, holdRiskAction } from '../actions'
import { ORDER_LABEL, PAYMENT_LABEL, tone } from '../labels'

export const metadata: Metadata = { title: 'Comenzi de verificat' }

const dt = (d: Date) => d.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** An unpaid card attempt: nothing to prepare, kept for the record and for the next checks. */
const unpaidCard = (o: Order) => o.paymentMethod === 'card' && (o.status === 'abandoned' || o.status === 'pending')

const TABS = {
  active: { label: 'De verificat', test: (o: Order) => o.riskReview === 'pending' && o.status !== 'cancelled' && !unpaidCard(o) },
  card: { label: 'Încercări card nefinalizate', test: (o: Order) => o.riskReview === 'pending' && o.status !== 'cancelled' && unpaidCard(o) },
  cleared: { label: 'Verificate (legitime)', test: (o: Order) => o.riskReview === 'cleared' },
  toate: { label: 'Toate', test: () => true },
} as const
type Tab = keyof typeof TABS

const EVENT: Record<string, string> = {
  'risk.flagged': 'Marcată pentru verificare',
  'risk.held': 'Menținută în verificare',
  'risk.cleared': 'Confirmată legitimă',
  'payment.failed': 'Plată cu cardul eșuată',
  'order.created': 'Comandă plasată',
  'order.abandoned': 'Plată nefinalizată',
}

/**
 * Orders the checkout's risk check flagged (server/risk.ts). While one waits here it is not prepared or shipped, and
 * this person gets no recovery email and no AI call. Confirming it (after a call) lets it into preparation and resumes
 * what is eligible; nothing here changes the payment or the order's status. The signals are for the team only.
 */
export default async function RiskReviewPage({ searchParams }: PageProps<'/[lang]/admin/verificare'>) {
  await connection()
  const sp = await searchParams
  const tab: Tab = String(sp.tab ?? '') in TABS ? (String(sp.tab) as Tab) : 'active'
  const db = await getDb()
  const all = await orders.risk(db)
  const list = all.filter(TABS[tab].test)
  const history = new Map(
    await Promise.all(list.map(async (o) => [o.id, (await orders.events(db, o.id)).filter((e) => EVENT[e.type])] as const)),
  )

  return (
    <div className="mx-auto max-w-[1100px]">
      <h1 className="text-[30px] tracking-[-0.03em]">Comenzi de verificat</h1>
      <p className="mt-1 text-[15px] text-text">
        Comenzi la care mai mulți indicatori se adună (scor de la {REVIEW_AT} în sus). Nu sunt fraude dovedite: sună clientul înainte de pregătire. Până la confirmare comanda nu intră în
        pregătire sau expediere și persoana nu primește emailuri de recuperare sau apeluri AI. Plata și statusul comenzii nu se schimbă aici.
      </p>
      <nav aria-label="Filtre" className="mt-5 flex flex-wrap gap-2">
        {(Object.keys(TABS) as Tab[]).map((k) => (
          <Link
            key={k}
            href={k === 'active' ? '/admin/verificare' : `/admin/verificare?tab=${k}`}
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
          {list.map((o) => (
            <li key={o.id} className="rounded-[18px] bg-paper p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/admin/orders/${o.id}`} className="text-[18px] font-semibold text-ink underline-offset-4 hover:underline">
                    {o.orderNumber}
                  </Link>
                  <span className="ml-2 text-[13.5px] text-muted">{dt(o.createdAt)}</span>
                  <p className="mt-1 text-[15px] text-ink">{customerName(o.customer)}</p>
                  <p className="text-[14px] text-muted">
                    <a href={`tel:${o.phone.replace(/\s/g, '')}`} className="underline underline-offset-4">
                      {o.phone}
                    </a>{' '}
                    · {o.email}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[12.5px]">
                  <span className={`rounded-full px-2.5 py-1 ${tone(o.status)}`}>{ORDER_LABEL[o.status]}</span>
                  <span className={`rounded-full px-2.5 py-1 ${tone(o.paymentStatus)}`}>
                    {PAYMENT_METHOD_LABEL[o.paymentMethod]} · {PAYMENT_LABEL[o.paymentStatus]}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 ${o.riskReview === 'pending' ? 'bg-[#fff4d6] text-[#7a5300]' : 'bg-cyan-50 text-cyan-700'}`}>
                    {o.riskReview === 'pending' ? 'Necesită verificare' : 'Verificată'} · scor {o.riskScore ?? '–'}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-[12.5px] font-medium tracking-[0.08em] text-muted uppercase">Motivul marcării</p>
                  <ul className="mt-1 list-disc pl-5 text-[14.5px] text-ink">
                    {o.riskReasons.length ? o.riskReasons.map((r) => <li key={r}>{r}</li>) : <li>–</li>}
                  </ul>
                </div>
                <div className="text-[14.5px]">
                  <p className="text-[12.5px] font-medium tracking-[0.08em] text-muted uppercase">Comanda</p>
                  <ul className="mt-1 text-ink">
                    {o.items.map((i) => (
                      <li key={i.position}>
                        {i.quantity} × {i.productName}
                        {i.variantName ? ` (${i.variantName})` : ''}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 font-semibold">{formatMoney(o.totalMinor, o.currency)}</p>
                  <p className="mt-1 text-muted">{formatAddress(o.shippingAddress)}</p>
                </div>
                <div className="text-[14px]">
                  <p className="text-[12.5px] font-medium tracking-[0.08em] text-muted uppercase">Istoric</p>
                  <ul className="mt-1 space-y-1">
                    {(history.get(o.id) ?? []).map((e, i) => (
                      <li key={i}>
                        <span className="text-muted tabular-nums">{dt(new Date(e.created_at))}</span> · {EVENT[e.type]}
                        {typeof e.data?.note === 'string' && <span className="block text-muted">„{e.data.note}”</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {o.riskReview === 'pending' && o.status !== 'cancelled' && (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <form action={clearRiskAction} className="rounded-[12px] bg-white p-3">
                    <input type="hidden" name="id" value={o.id} />
                    <label className="flex items-start gap-2 text-[14px] text-ink">
                      <input type="checkbox" name="confirm" value="da" required className="mt-0.5 h-4 w-4" />
                      Am verificat clientul (de exemplu la telefon): comanda este legitimă.
                    </label>
                    <input name="note" maxLength={300} placeholder="Notă (opțional)" className="mt-2 w-full rounded-[8px] border border-mist-2 px-2.5 py-1.5 text-[14px]" />
                    <button className="cta sm mt-2">Confirmă comanda</button>
                  </form>
                  <form action={holdRiskAction} className="rounded-[12px] bg-white p-3">
                    <input type="hidden" name="id" value={o.id} />
                    <label className="flex items-start gap-2 text-[14px] text-ink">
                      <input type="checkbox" name="confirm" value="da" required className="mt-0.5 h-4 w-4" />
                      Rămâne în verificare (nu se pregătește).
                    </label>
                    <input name="note" maxLength={300} placeholder="Ce ai aflat (de ex. nu răspunde)" className="mt-2 w-full rounded-[8px] border border-mist-2 px-2.5 py-1.5 text-[14px]" />
                    <button className="mt-2 rounded-[10px] bg-mist px-3 py-1.5 text-[14px] text-ink hover:bg-mist-2">Menține în verificare</button>
                  </form>
                </div>
              )}
              {o.riskReview === 'cleared' && o.riskReviewedAt && (
                <p className="mt-3 text-[13px] text-muted">
                  Confirmată legitimă {dt(o.riskReviewedAt)}
                  {o.riskReviewedBy ? ` de ${o.riskReviewedBy}` : ''}.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
