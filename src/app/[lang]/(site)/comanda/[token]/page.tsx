import { cashOnDelivery } from '@/config/payments'
import type { Metadata } from 'next'
import Link from '@/components/ui/Link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { Arrow, Check } from '@/components/ui/icons'
import { site, terms } from '@/config/site'
import { lineKey } from '@/components/cart/cart-store'
import { lineRef } from '@/content/catalog'
import { formatMoney } from '@/lib/currency'
import { purchaseLei } from '@/lib/meta'
import { promoText } from '@/config/promotions'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { customerName, formatAddress, type Order } from '@/server/orders/model'
import { orders } from '@/server/orders/repository'
import { awaitsCollection, isPaid } from '@/server/orders/state'
import { offersFor } from '@/server/orders/upsell'
import { CopyButton, OrderEffects, WaitForPayment } from './OrderClient'
import { PostPurchaseOffer } from './PostPurchaseOffer'

export const metadata: Metadata = { title: 'Comanda ta', robots: { index: false, follow: false } }

/** The page's words in both languages (the URL's language: /comanda or /en/comanda). */
const COPY = {
  ro: {
    order: 'Comanda',
    cancelled: 'Comanda a fost anulată.',
    confirmed: 'Comanda ta este confirmată.',
    thanks: 'Mulțumim pentru comandă.',
    checking: 'Verificăm plata.',
    notPaid: 'Plata nu a fost finalizată.',
    paidText: (email: string) => `Plata este confirmată. Ți-am trimis confirmarea pe ${email}. Pregătim coletul în ${terms.processingDays}.`,
    addedAfter: (n: string) => `Adăugată după comanda #${n}. Le putem expedia împreună.`,
    alsoAdded: (what: string, n: string) => `Ai adăugat și ${what}: comanda separată #${n}, plătită.`,
    codTitle: 'Plata la livrare (ramburs)',
    codText: (email: string) => `Plătești curierului când primești coletul. Nu ai nimic de plătit acum. Ți-am trimis confirmarea pe ${email}.`,
    packing: ` Pregătim coletul în ${terms.processingDays}.`,
    transferWait: 'Comanda este înregistrată și așteaptă plata. O pregătim imediat ce suma ajunge în cont.',
    stripeWait: 'Stripe confirmă plata în câteva secunde. Pagina se actualizează singură.',
    failed: (cod: boolean, ro: boolean) => `Nu s-a efectuat nicio plată. Produsele sunt tot în coș și poți încerca din nou${ro ? `, cu cardul${cod ? ', cu plata la livrare' : ''} sau prin transfer bancar` : ''}.`,
    retry: 'Încearcă din nou',
    transferTitle: 'Datele pentru transfer',
    beneficiary: 'Beneficiar',
    bank: 'Banca',
    amount: 'Suma',
    reference: 'Detalii plată',
    referenceValue: (n: string) => `Comanda ${n}`,
    writeRef: ['Scrie ', ' la detaliile plății. Așa potrivim transferul cu comanda ta.'],
    transferByEmail: `Îți trimitem datele pentru transfer pe email. Pentru ele acum, scrie-ne la ${site.email}.`,
    invoice: 'Descarcă factura',
    atCourier: (c: string) => `Comanda este la ${c}. AWB: `,
    track: 'Urmărește coletul',
    ordered: 'Ce ai comandat',
    delivery: 'Livrare',
    free: 'Gratuită',
    vat: terms.vat,
    deliverTo: 'Livrare la',
    billing: 'Facturare',
    taxId: (ro: boolean) => (ro ? 'CUI' : 'TVA'),
    payment: 'Plată',
    date: 'Data',
    dateLocale: 'ro-RO',
    question: ['Ai o întrebare? Scrie-ne la ', ' sau sună la ', '. Menționează numărul comenzii: '],
    mailSubject: (n: string) => `Comanda ${n}`,
    changed: `Te-ai răzgândit? Ai ${terms.returnDays} zile de la primire. `,
    withdraw: 'Retrage-te din contract aici',
    back: 'Înapoi la magazin',
    method: { card: 'Card', bank_transfer: 'Transfer bancar', cash_on_delivery: 'Ramburs (plata la livrare)' } as Record<Order['paymentMethod'], string>,
  },
  en: {
    order: 'Order',
    cancelled: 'Your order has been cancelled.',
    confirmed: 'Your order is confirmed.',
    thanks: 'Thank you for your order.',
    checking: 'We are checking your payment.',
    notPaid: 'The payment was not completed.',
    paidText: (email: string) => `Your payment is confirmed. We sent the confirmation to ${email}. We pack your order within 1-3 days.`,
    addedAfter: (n: string) => `Added after order #${n}. We can ship them together.`,
    alsoAdded: (what: string, n: string) => `You also added ${what}: separate order #${n}, paid.`,
    codTitle: 'Cash on delivery',
    codText: (email: string) => `You pay the courier when the parcel arrives. Nothing to pay now. We sent the confirmation to ${email}.`,
    packing: ' We pack your order within 1-3 days.',
    transferWait: 'Your order is placed and waiting for payment. We pack it as soon as the payment arrives.',
    stripeWait: 'Stripe confirms the payment within a few seconds. This page updates by itself.',
    failed: (cod: boolean, ro: boolean) => `No payment was taken. Your products are still in the cart and you can try again${ro ? `, by card${cod ? ', cash on delivery' : ''} or bank transfer` : ''}.`,
    retry: 'Try again',
    transferTitle: 'Bank transfer details',
    beneficiary: 'Beneficiary',
    bank: 'Bank',
    amount: 'Amount',
    reference: 'Payment reference',
    referenceValue: (n: string) => `Order ${n}`,
    writeRef: ['Write ', ' as the payment reference, so we can match the transfer to your order.'],
    transferByEmail: `We send you the transfer details by email. To get them now, write to ${site.email}.`,
    invoice: 'Download invoice',
    atCourier: (c: string) => `Your order is with ${c}. Tracking number: `,
    track: 'Track your parcel',
    ordered: 'Your order',
    delivery: 'Delivery',
    free: 'Free',
    vat: 'VAT included',
    deliverTo: 'Deliver to',
    billing: 'Billing',
    taxId: (ro: boolean) => (ro ? 'CUI' : 'VAT'),
    payment: 'Payment',
    date: 'Date',
    dateLocale: 'en-GB',
    question: ['Any questions? Write to us at ', ' or call ', '. Please mention your order number: '],
    mailSubject: (n: string) => `Order ${n}`,
    changed: `Changed your mind? You have ${terms.returnDays} days from delivery. `,
    withdraw: 'Withdraw from the contract here',
    back: 'Back to the store',
    method: { card: 'Card', bank_transfer: 'Bank transfer', cash_on_delivery: 'Cash on delivery' } as Record<Order['paymentMethod'], string>,
  },
}

export default async function OrderPage({ params, searchParams }: PageProps<'/[lang]/comanda/[token]'>) {
  await connection()
  const { token, lang } = await params
  const L = lang === 'en' ? 'en' : 'ro'
  const t = COPY[L]
  const sp = await searchParams
  if (!/^[\w-]{20,64}$/.test(token)) notFound()
  let order: Order | null
  try {
    order = await orders.byToken(await getDb(), token)
  } catch {
    notFound()
  }
  if (!order) notFound()
  // Read-only: this page never marks a payment or starts a workflow. Card payments are confirmed by
  // the Stripe webhook (and, if it is ever lost, by the stripe.reconcile job), not by a page view.

  const c = getConfig()
  const paid = isPaid(order.paymentStatus)
  // A sale for the ad platforms: a card order once paid; cash on delivery and bank transfer once placed (firm orders).
  const sale = order.status !== 'cancelled' && (paid || order.paymentMethod === 'cash_on_delivery' || order.paymentMethod === 'bank_transfer')
  const transfer = order.paymentMethod === 'bank_transfer' && order.paymentStatus === 'awaiting_transfer' && order.status !== 'cancelled'
  // Stripe's redirect parameter only tells us the attempt failed in the browser; success is never taken from it.
  const redirectFailed = sp.redirect_status === 'failed'
  const cardOpen = order.paymentMethod === 'card' && !paid && order.status !== 'cancelled' && order.paymentStatus !== 'cancelled'
  const cardPending = cardOpen && order.paymentStatus === 'pending' && !!order.stripePaymentIntentId && !redirectFailed
  const cardFailed = cardOpen && !cardPending

  // Cash on delivery: confirmed when placed; the customer pays the courier.
  const cod = awaitsCollection(order) && order.status !== 'cancelled'
  const placed = paid || transfer || cod
  // The offer exists only for a card payment Stripe already confirmed (never from URL parameters).
  const db = await getDb()
  const offers = c.stripe ? offersFor(order) : []
  const child = order.kind === 'checkout' ? await orders.childOf(db, order.id) : null
  const parent = order.parentOrderId ? await orders.byId(db, order.parentOrderId) : null
  const items = order.items.map((i) => lineKey({ productId: i.productId as never, variantId: i.variantId ?? undefined }))
  const money = (minor: number) => formatMoney(minor, order.currency)
  // Ad platforms count sales in lei. `track` still expects minor units, so the purchase value stays in bani
  // of lei (fxRate is lei per unit of the order's currency, 1 for lei). Item prices passed in are already lei.
  const ronMinor = (minor: number) => Math.round(minor * order.fxRate)
  const unitLei = (i: Order['items'][number]) => purchaseLei(i.quantity ? Math.round((i.lineTotalMinor - i.discountMinor) / i.quantity) : i.unitPriceMinor, order.fxRate)

  return (
    <section className="pt-[calc(var(--nav-h)+48px)] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+24px)]">
      <div className="wrap max-w-[820px]">
        <OrderEffects
          orderNumber={order.orderNumber}
          clearKeys={placed ? items : []}
          funnel={order.attribution?.funnel}
          placed={!paid && (cod || transfer) ? { orderNumber: order.orderNumber, value: ronMinor(order.totalMinor), payment: cod ? 'cod' : 'transfer' } : null}
          purchase={sale ? { orderNumber: order.orderNumber, value: ronMinor(order.totalMinor), paid, items: order.items.map((i) => ({ item_id: lineRef(i.productId, i.variantId), item_name: i.productName, item_variant: i.variantName ?? undefined, price: unitLei(i), quantity: i.quantity })) } : null}
        />

        {placed && (
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
            <Check className="h-6 w-6" />
          </span>
        )}
        <p className="mt-6 text-[15px] font-medium text-cyan-700">{t.order} #{order.orderNumber}</p>
        <h1 className="mt-1 text-[clamp(30px,3.6vw,42px)] leading-tight tracking-[-0.035em]">
          {order.status === 'cancelled' ? t.cancelled : paid || cod ? t.confirmed : placed ? t.thanks : cardPending ? t.checking : t.notPaid}
        </h1>

        {paid && order.status !== 'cancelled' && (
          <p className="sub mt-4">
            {t.paidText(order.email)}
          </p>
        )}
        {parent && (
          <p className="mt-2 text-[15px] text-muted">{t.addedAfter(parent.orderNumber)}</p>
        )}
        {child && isPaid(child.paymentStatus) && (
          <p className="mt-4 rounded-[14px] bg-cyan-50 px-5 py-3 text-[15px] text-cyan-700">
            {t.alsoAdded(child.items.map((i) => (i.variantName ? `${i.productName} (${i.variantName})` : i.productName)).join(', '), child.orderNumber)}
          </p>
        )}
        {offers.length > 0 && !child && c.stripe && (
          <PostPurchaseOffer
            token={order.publicToken}
            orderNumber={order.orderNumber}
            publishableKey={c.stripe.publishableKey}
            offers={offers.map((o) => ({ productId: o.productId, name: o.name, reason: o.reason, variants: o.variants, priceMinor: o.priceMinor }))}
          />
        )}
        {cod && (
          <div className="mt-6 rounded-[20px] bg-paper p-6 max-sm:px-5">
            <p className="text-[15px] text-muted">{t.codTitle}</p>
            <p className="mt-1 text-[28px] font-medium tracking-[-0.02em] text-ink tabular-nums">{money(order.codAmountMinor ?? order.totalMinor)}</p>
            <p className="mt-2 text-[15.5px] leading-relaxed text-text">
              {t.codText(order.email)}
              {order.status === 'shipped' || order.status === 'delivered' ? '' : t.packing}
            </p>
          </div>
        )}
        {transfer && <p className="sub mt-4">{t.transferWait}</p>}
        {cardPending && (
          <>
            <p className="sub mt-4">{t.stripeWait}</p>
            <WaitForPayment />
          </>
        )}
        {cardFailed && (
          <>
            <p className="sub mt-4">{t.failed(cashOnDelivery.enabled, order.currency === 'RON' && order.shippingAddress.country === 'RO')}</p>
            <Link href="/checkout" className="cta mt-6">
              {t.retry} <Arrow />
            </Link>
          </>
        )}

        {transfer && (
          <div className="mt-8 rounded-[20px] bg-paper p-6 max-sm:px-5">
            <h2 className="text-[19px] tracking-[-0.015em]">{t.transferTitle}</h2>
            {c.bank ? (
              <>
                <dl className="mt-4 divide-y divide-mist-2 border-y border-mist-2">
                  {(
                    [
                      [t.beneficiary, c.bank.beneficiary, true],
                      ['IBAN', c.bank.iban, true],
                      [t.bank, c.bank.bank, false],
                      ...(c.bank.swift ? [['SWIFT', c.bank.swift, true]] : []),
                      [t.amount, money(order.totalMinor), false],
                      [t.reference, t.referenceValue(order.orderNumber), true],
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
                  {t.writeRef[0]}
                  <strong className="font-semibold text-ink">{order.orderNumber}</strong>
                  {t.writeRef[1]}
                </p>
              </>
            ) : (
              <p className="mt-3 text-[15.5px] text-text">{t.transferByEmail}</p>
            )}
          </div>
        )}

        {order.fgoInvoiceLink && (
          <p className="mt-6">
            <a href={order.fgoInvoiceLink} target="_blank" rel="noopener noreferrer" className="tlink">
              {t.invoice} {order.fgoInvoiceSeries} {order.fgoInvoiceNumber} <Arrow />
            </a>
          </p>
        )}

        {order.status === 'shipped' && order.trackingNumber && (
          <p className="mt-6 rounded-[14px] bg-paper px-5 py-4 text-[15.5px] text-ink">
            {t.atCourier(order.courier ?? '')}
            <strong>{order.trackingNumber}</strong>
            {order.trackingUrl && (
              <>
                {' '}
                ·{' '}
                <a href={order.trackingUrl} className="underline underline-offset-4" target="_blank" rel="noopener noreferrer">
                  {t.track}
                </a>
              </>
            )}
          </p>
        )}

        <div className="mt-6 rounded-[20px] bg-paper p-6 max-sm:px-5">
          <h2 className="text-[19px] tracking-[-0.015em]">{t.ordered}</h2>
          <ul className="mt-3 divide-y divide-mist-2">
            {order.items.map((i) => (
              <li key={i.position} className="flex justify-between gap-4 py-3 text-[15.5px]">
                <span className="text-ink">
                  {i.quantity} × {i.productName}
                  {i.variantName && <span className="block text-[14px] text-muted">{i.variantName}</span>}
                </span>
                <span className="font-medium text-ink tabular-nums">{money(i.lineTotalMinor)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-1 space-y-1 border-t border-mist-2 pt-3 text-[15px]">
            {order.discountMinor > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="text-ink tabular-nums">{money(order.subtotalMinor)}</dd>
              </div>
            )}
            {order.promotions.map((p) => (
              <div key={p.id} className="flex justify-between text-cyan-700">
                <dt>{promoText(p.label, L)}</dt>
                <dd className="tabular-nums">−{money(p.amountMinor)}</dd>
              </div>
            ))}
            <div className="flex justify-between">
              <dt className="text-muted">{t.delivery}</dt>
              <dd className="text-ink">{order.shippingMinor ? money(order.shippingMinor) : t.free}</dd>
            </div>
            <div className="flex justify-between text-[17px] font-medium text-ink">
              <dt>Total</dt>
              <dd className="tabular-nums">{money(order.totalMinor)}</dd>
            </div>
          </dl>
          <p className="mt-1 text-right text-[13px] text-muted">{t.vat}</p>

          <dl className="mt-5 grid gap-4 border-t border-mist-2 pt-5 text-[15px] sm:grid-cols-2">
            <div>
              <dt className="text-muted">{t.deliverTo}</dt>
              <dd className="mt-1 text-ink">
                {customerName(order.customer)}
                <br />
                {formatAddress(order.shippingAddress, L)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">{t.billing}</dt>
              <dd className="mt-1 text-ink">
                {order.customer.buyerType === 'pj' ? (
                  <>
                    {order.customer.company}, {t.taxId(order.billingAddress.country === 'RO')} {order.customer.cui}
                  </>
                ) : (
                  customerName(order.customer)
                )}
                <br />
                {formatAddress(order.billingAddress, L)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">{t.payment}</dt>
              <dd className="mt-1 text-ink">{t.method[order.paymentMethod]}</dd>
            </div>
            <div>
              <dt className="text-muted">{t.date}</dt>
              <dd className="mt-1 text-ink">{order.createdAt.toLocaleDateString(t.dateLocale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Bucharest' })}</dd>
            </div>
          </dl>
        </div>

        <p className="mt-8 text-[15.5px] leading-relaxed text-text">
          {t.question[0]}
          <a href={`mailto:${site.email}?subject=${encodeURIComponent(t.mailSubject(order.orderNumber))}`} className="font-medium text-ink underline underline-offset-4">
            {site.email}
          </a>
          {t.question[1]}
          <a href={site.phoneHref} className="font-medium whitespace-nowrap text-ink underline underline-offset-4">
            {site.phone}
          </a>
          {t.question[2]}
          {order.orderNumber}.
        </p>
        {(paid || cod) && order.customer.buyerType === 'pf' && order.status !== 'cancelled' && (
          <p className="mt-3 text-[15px] text-muted">
            {t.changed}
            <Link href="/retragere" className="font-medium text-ink underline underline-offset-4">
              {t.withdraw}
            </Link>
            .
          </p>
        )}
        <Link href="/" className="tlink mt-6">
          {t.back} <Arrow />
        </Link>
      </div>
    </section>
  )
}
