import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { Arrow, Check } from '@/components/ui/icons'
import { site, terms } from '@/config/site'
import { lineKey } from '@/components/cart/cart-store'
import { formatLei } from '@/lib/money'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { stripe } from '@/server/integrations/stripe'
import { kickJobs } from '@/server/jobs/runner'
import { errText, log } from '@/server/log'
import { customerName, formatAddress, type Order } from '@/server/orders/model'
import { orders } from '@/server/orders/repository'
import { confirmPayment } from '@/server/orders/service'
import { isPaid } from '@/server/orders/state'
import { CopyButton, OrderEffects, WaitForPayment } from './OrderClient'

export const metadata: Metadata = { title: 'Comanda ta', robots: { index: false, follow: false } }

/**
 * Card payments: if the webhook hasn't arrived yet, ask Stripe directly (server-side, with the
 * secret key). Same idempotent transition as the webhook, so whichever comes first wins once.
 */
async function reconcile(o: Order): Promise<Order> {
  const c = getConfig()
  if (o.paymentMethod !== 'card' || isPaid(o.paymentStatus) || !o.stripePaymentIntentId || !c.stripe) return o
  try {
    const pi = await stripe.retrievePaymentIntent(c.stripe, o.stripePaymentIntentId)
    if (pi.status !== 'succeeded') return o
    const r = await confirmPayment(o.id, 'stripe.reconcile', { amountMinor: pi.amount_received, currency: pi.currency, paymentIntentId: pi.id })
    if (r.changed) kickJobs()
    return r.order ?? o
  } catch (e) {
    log.warn('order.reconcile_failed', { orderId: o.id, error: errText(e) })
    return o
  }
}

export default async function OrderPage({ params, searchParams }: PageProps<'/comanda/[token]'>) {
  await connection()
  const { token } = await params
  const sp = await searchParams
  if (!/^[\w-]{20,64}$/.test(token)) notFound()
  let order: Order | null
  try {
    order = await orders.byToken(await getDb(), token)
  } catch {
    notFound()
  }
  if (!order) notFound()
  order = await reconcile(order)

  const c = getConfig()
  const paid = isPaid(order.paymentStatus)
  const transfer = order.paymentMethod === 'bank_transfer' && order.paymentStatus === 'awaiting_transfer' && order.status !== 'cancelled'
  const redirectFailed = sp.redirect_status === 'failed'
  const cardPending = order.paymentMethod === 'card' && !paid && order.status !== 'cancelled' && !redirectFailed && order.paymentStatus !== 'failed' && sp.redirect_status === 'succeeded'
  const cardFailed = order.paymentMethod === 'card' && !paid && order.status !== 'cancelled' && !cardPending

  const placed = paid || transfer
  const items = order.items.map((i) => lineKey({ productId: i.productId as never, variantId: i.variantId ?? undefined }))

  return (
    <section className="pt-[calc(var(--nav-h)+48px)] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+24px)]">
      <div className="wrap max-w-[820px]">
        <OrderEffects
          clearKeys={placed ? items : []}
          purchase={paid ? { orderNumber: order.orderNumber, value: order.totalMinor, items: order.items.map((i) => ({ item_id: i.variantId ? `${i.productId}/${i.variantId}` : i.productId, item_name: i.productName, item_variant: i.variantName ?? undefined, price: i.unitPriceMinor / 100, quantity: i.quantity })) } : null}
        />

        {placed && (
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
            <Check className="h-6 w-6" />
          </span>
        )}
        <p className="mt-6 text-[15px] font-medium text-cyan-700">Comanda #{order.orderNumber}</p>
        <h1 className="mt-1 text-[clamp(30px,3.6vw,42px)] leading-tight tracking-[-0.035em]">
          {order.status === 'cancelled'
            ? 'Comanda a fost anulată.'
            : placed
              ? 'Mulțumim pentru comandă.'
              : cardPending
                ? 'Confirmăm plata.'
                : 'Plata nu a fost finalizată.'}
        </h1>

        {paid && order.status !== 'cancelled' && (
          <p className="sub mt-4">
            Plata este confirmată. Confirmarea a plecat pe {order.email}. Pregătim coletul în {terms.processingDays}.
          </p>
        )}
        {transfer && <p className="sub mt-4">Comanda este înregistrată și așteaptă plata. O pregătim imediat ce suma ajunge în cont.</p>}
        {cardPending && (
          <>
            <p className="sub mt-4">Stripe confirmă plata în câteva secunde. Pagina se actualizează singură.</p>
            <WaitForPayment />
          </>
        )}
        {cardFailed && (
          <>
            <p className="sub mt-4">Nu ți s-a retras nimic. Produsele sunt tot în coș și poți încerca din nou, cu cardul sau prin transfer bancar.</p>
            <Link href="/checkout" className="cta mt-6">
              Încearcă din nou <Arrow />
            </Link>
          </>
        )}

        {transfer && (
          <div className="mt-8 rounded-[20px] bg-paper p-6 max-sm:px-5">
            <h2 className="text-[19px] tracking-[-0.015em]">Datele pentru transfer</h2>
            {c.bank ? (
              <>
                <dl className="mt-4 divide-y divide-mist-2 border-y border-mist-2">
                  {(
                    [
                      ['Beneficiar', c.bank.beneficiary, true],
                      ['IBAN', c.bank.iban, true],
                      ['Banca', c.bank.bank, false],
                      ...(c.bank.swift ? [['SWIFT', c.bank.swift, true]] : []),
                      ['Suma', formatLei(order.totalMinor), false],
                      ['Detalii plată', `Comanda ${order.orderNumber}`, true],
                    ] as [string, string, boolean][]
                  ).map(([label, value, copy]) => (
                    <div key={label} className="grid grid-cols-[130px_1fr_auto] items-center gap-3 py-3 max-sm:grid-cols-[1fr_auto]">
                      <dt className="text-[14.5px] text-muted max-sm:col-span-2">{label}</dt>
                      <dd className={`text-[16px] font-medium break-words text-ink ${label === 'IBAN' ? 'font-mono text-[15px] tracking-[0.02em]' : ''}`}>{value}</dd>
                      {copy ? <CopyButton value={label === 'IBAN' ? value.replace(/\s/g, '') : value} label={label} /> : <span />}
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-[15px] leading-relaxed text-text">
                  Scrie <strong className="font-semibold text-ink">{order.orderNumber}</strong> la detaliile plății. Așa potrivim transferul cu comanda ta.
                </p>
              </>
            ) : (
              <p className="mt-3 text-[15.5px] text-text">Îți trimitem datele pentru transfer pe email. Pentru ele acum, scrie-ne la {site.email}.</p>
            )}
          </div>
        )}

        {order.fgoInvoiceLink && (
          <p className="mt-6">
            <a href={order.fgoInvoiceLink} target="_blank" rel="noopener noreferrer" className="tlink">
              Descarcă factura {order.fgoInvoiceSeries} {order.fgoInvoiceNumber} <Arrow />
            </a>
          </p>
        )}

        {order.status === 'shipped' && order.trackingNumber && (
          <p className="mt-6 rounded-[14px] bg-paper px-5 py-4 text-[15.5px] text-ink">
            Comanda este la {order.courier}. AWB: <strong>{order.trackingNumber}</strong>
            {order.trackingUrl && (
              <>
                {' '}
                ·{' '}
                <a href={order.trackingUrl} className="underline underline-offset-4" target="_blank" rel="noopener noreferrer">
                  Urmărește coletul
                </a>
              </>
            )}
          </p>
        )}

        <div className="mt-6 rounded-[20px] bg-paper p-6 max-sm:px-5">
          <h2 className="text-[19px] tracking-[-0.015em]">Ce ai comandat</h2>
          <ul className="mt-3 divide-y divide-mist-2">
            {order.items.map((i) => (
              <li key={i.position} className="flex justify-between gap-4 py-3 text-[15.5px]">
                <span className="text-ink">
                  {i.quantity} × {i.productName}
                  {i.variantName && <span className="block text-[14px] text-muted">{i.variantName}</span>}
                </span>
                <span className="font-medium text-ink tabular-nums">{formatLei(i.lineTotalMinor)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-1 space-y-1 border-t border-mist-2 pt-3 text-[15px]">
            <div className="flex justify-between">
              <dt className="text-muted">Livrare</dt>
              <dd className="text-ink">{order.shippingMinor ? formatLei(order.shippingMinor) : 'Gratuită'}</dd>
            </div>
            <div className="flex justify-between text-[17px] font-medium text-ink">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatLei(order.totalMinor)}</dd>
            </div>
          </dl>
          <p className="mt-1 text-right text-[13px] text-muted">{terms.vat}</p>

          <dl className="mt-5 grid gap-4 border-t border-mist-2 pt-5 text-[15px] sm:grid-cols-2">
            <div>
              <dt className="text-muted">Livrare la</dt>
              <dd className="mt-1 text-ink">
                {customerName(order.customer)}
                <br />
                {formatAddress(order.shippingAddress)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Facturare</dt>
              <dd className="mt-1 text-ink">
                {order.customer.buyerType === 'pj' ? (
                  <>
                    {order.customer.company}, CUI {order.customer.cui}
                  </>
                ) : (
                  customerName(order.customer)
                )}
                <br />
                {formatAddress(order.billingAddress)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Plată</dt>
              <dd className="mt-1 text-ink">{order.paymentMethod === 'card' ? 'Card' : 'Transfer bancar'}</dd>
            </div>
            <div>
              <dt className="text-muted">Data</dt>
              <dd className="mt-1 text-ink">{order.createdAt.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Bucharest' })}</dd>
            </div>
          </dl>
        </div>

        <p className="mt-8 text-[15.5px] leading-relaxed text-text">
          Ai o întrebare? Scrie-ne la{' '}
          <a href={`mailto:${site.email}?subject=${encodeURIComponent(`Comanda ${order.orderNumber}`)}`} className="font-medium text-ink underline underline-offset-4">
            {site.email}
          </a>{' '}
          sau sună la{' '}
          <a href={site.phoneHref} className="font-medium whitespace-nowrap text-ink underline underline-offset-4">
            {site.phone}
          </a>
          . Menționează numărul comenzii: {order.orderNumber}.
        </p>
        <Link href="/" className="tlink mt-6">
          Înapoi la magazin <Arrow />
        </Link>
      </div>
    </section>
  )
}
