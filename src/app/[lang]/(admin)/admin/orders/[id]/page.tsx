import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { isDiscontinued } from '@/content/catalog'
import { attributionSummary } from '@/lib/attribution'
import { formatLei } from '@/lib/money'
import { formatMoney } from '@/lib/currency'

/** An amount of this order, in its currency (lei, or euro/dollar on the international site). */
const money = (o: { currency: Parameters<typeof formatMoney>[1] }, minor: number) => formatMoney(minor, o.currency)
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { jobs, type Job } from '@/server/jobs/outbox'
import { jobLabel, NOTIFICATIONS, type NotifyEvent } from '@/server/notifications'
import { customerName, formatAddress, PAYMENT_METHOD_LABEL } from '@/server/orders/model'
import { shipmentFor } from '@/server/fulfillment/courier'
import { marketing } from '@/server/marketing/consent'
import { callConsent } from '@/server/calling/consent'
import { romanianE164 } from '@/lib/consent/calling'
import { orders } from '@/server/orders/repository'
import { withdrawals } from '@/server/orders/withdrawal'
import { awaitsCollection, canCancel, canFulfil, canMoveOrder, isPaid, isPurchased } from '@/server/orders/state'
import {
  cancelAction,
  codCollectedAction,
  deliveredAction,
  markPaidAction,
  confirmTeamAction,
  clearRiskAction,
  holdRiskAction,
  processingAction,
  refundAction,
  resyncCrmAction,
  retryJobsAction,
  returnReceivedAction,
  returnRequestedAction,
  shipAction,
} from '../../actions'
import { INVOICE_LABEL, JOB_STATUS, ORDER_LABEL, PAYMENT_LABEL, tone } from '../../labels'

const dt = (d: Date | string | null) =>
  d ? new Date(d).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–'

/** What a job is, in words: the customer email by template, the team notification by event, the integration by name. */
const jobTitle = (j: Job) =>
  j.kind === 'email.send'
    ? `Email client · ${String(j.payload.template)}`
    : j.kind === 'notify.send'
      ? `Notificare echipă · ${NOTIFICATIONS[j.payload.event as NotifyEvent]?.title ?? String(j.payload.event)}`
      : jobLabel(j.kind)
const jobState = (j: Job) =>
  j.status === 'pending' && j.runAt.getTime() > Date.now()
    ? `programat pentru ${dt(j.runAt)}`
    : j.status === 'retry'
      ? `reîncercare ${j.attempts} · următoarea la ${dt(j.runAt)}`
      : (JOB_STATUS[j.status] ?? j.status)

export default async function AdminOrderPage({ params }: PageProps<'/[lang]/admin/orders/[id]'>) {
  await connection()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const db = await getDb()
  const o = await orders.byId(db, id)
  if (!o) notFound()
  const phone = romanianE164(o.phone)
  const [events, jobList, consent, withdrawalList, call] = await Promise.all([
    orders.events(db, id),
    jobs.forOrder(db, id),
    marketing.state(db, o.email),
    withdrawals.forOrder(id),
    phone ? callConsent.state(db, phone) : null,
  ])
  const c = getConfig()
  const paid = isPaid(o.paymentStatus)
  const cod = awaitsCollection(o)
  const ship = shipmentFor(o)
  const [parent, child] = await Promise.all([o.parentOrderId ? orders.byId(db, o.parentOrderId) : null, orders.childOf(db, o.id)])
  // What happened to the CRM record, from the order's own sync jobs (GHL is never asked from this page).
  const crmJobs = jobList.filter((j) => j.kind === 'ghl.sync')
  const crmStuck = crmJobs.find((j) => j.status === 'failed') ?? crmJobs.find((j) => j.status === 'retry')
  const crmState = !c.ghl
    ? 'neconfigurat'
    : crmStuck
      ? `${crmStuck.status === 'failed' ? 'oprită, are nevoie de o persoană' : `reîncercare ${crmStuck.attempts}`}: ${crmStuck.lastError ?? ''}`
      : crmJobs.some((j) => j.status === 'pending' || j.status === 'running')
        ? 'în curs'
        : o.ghlOpportunityId
          ? 'sincronizată'
          : o.paymentMethod === 'card'
            ? 'se trimite după plată sau la abandon'
            : 'nesincronizată încă'
  const UPSELL: Record<string, string> = { offered: 'oferită, fără răspuns încă', declined: 'refuzată de client', accepted: 'acceptată', expired: 'expirată (fără răspuns)' }

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-[34px] tracking-[-0.03em]">{o.orderNumber}</h1>
        <span className={`rounded-full px-3 py-1 text-[13px] font-medium ${tone(o.paymentStatus)}`}>{PAYMENT_LABEL[o.paymentStatus]}</span>
        <span className={`rounded-full px-3 py-1 text-[13px] font-medium ${tone(o.status)}`}>{ORDER_LABEL[o.status]}</span>
        <span className="ml-auto flex flex-wrap gap-2 text-[14px]">
          {(
            [
              ['pregatire', 'Fișă pregătire'],
              ['livrare', 'Fișă livrare'],
              ['eticheta', 'Etichetă colet'],
              ['detalii', 'Detalii'],
            ] as const
          ).map(([doc, label]) => (
            <Link key={doc} href={`/admin/print?doc=${doc}&ids=${o.id}`} target="_blank" className="btn-secondary sm">
              {label}
            </Link>
          ))}
          <Link href={`/comanda/${o.publicToken}`} className="self-center underline underline-offset-4" target="_blank">
            Pagina clientului
          </Link>
        </span>
      </div>
      <p className="mt-1 text-[14.5px] text-muted">
        {dt(o.createdAt)} · {PAYMENT_METHOD_LABEL[o.paymentMethod]} · {money(o, o.totalMinor)}
        {o.currency !== 'RON' && ` (≈ ${formatLei(Math.round(o.totalMinor * o.fxRate))}, curs ${o.fxRate})`}
        {o.site === 'net' && ' · biohack-tech.net'}
        {o.locale === 'en' && ' · engleză'}
      </p>
      {cod && o.status !== 'cancelled' && (
        <p className="mt-4 rounded-[14px] bg-[#fdf3f3] px-5 py-3 text-[15px] text-ink shadow-[inset_0_0_0_1px_#f3d6d6]">
          Ramburs: curierul încasează <strong className="tabular-nums">{money(o, ship.cashOnDeliveryMinor)}</strong> la livrare. Comanda rămâne neplătită până înregistrezi decontul curierului.
        </p>
      )}

      {(parent || child || o.upsellStatus) && (
        <div className="mt-5 rounded-[14px] bg-cyan-50 px-5 py-3 text-[14.5px] text-ink">
          {parent && (
            <p>
              ↳ Comandă adăugată după plată la{' '}
              <Link href={`/admin/orders/${parent.id}`} className="font-medium underline underline-offset-4">
                {parent.orderNumber}
              </Link>{' '}
              ({PAYMENT_LABEL[parent.paymentStatus]}, {ORDER_LABEL[parent.status]}). Același client și aceeași adresă: se pot expedia împreună. Plată și factură separate.
            </p>
          )}
          {child && (
            <p>
              Comandă inițială. Adăugată după plată:{' '}
              <Link href={`/admin/orders/${child.id}`} className="font-medium underline underline-offset-4">
                ↳ {child.orderNumber}
              </Link>{' '}
              · {child.items.map((i) => `${i.quantity} × ${i.productName}${i.variantName ? ` (${i.variantName})` : ''}`).join(', ')} · {money(o, child.totalMinor)} · {PAYMENT_LABEL[child.paymentStatus]}. Se pot expedia împreună.
            </p>
          )}
          {!child && o.upsellStatus && <p>Oferta după plată: {UPSELL[o.upsellStatus] ?? o.upsellStatus}.</p>}
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-12">
        <div className="min-w-0 space-y-5 lg:col-span-7">
          <Panel title="Produse">
            <ul className="divide-y divide-mist-2">
              {o.items.map((i) => {
                return (
                  <li key={i.position} className="flex justify-between gap-4 py-2.5">
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      <span className="font-medium">
                        {i.quantity} × {i.productName}
                      </span>
                      {isDiscontinued(i.productId) && <span className="ml-2 rounded-full bg-mist px-2.5 py-0.5 text-[13px]">Produs retras</span>}
                      {i.variantName && (
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-mist px-2.5 py-0.5 text-[13px]">Variantă: {i.variantName}</span>
                        </span>
                      )}
                      <span className="mt-1 block text-[13px] text-muted">
                        Produs {i.productId}
                        {i.variantId && ` · variantă ${i.variantId}`} · ref. {i.sku} · {money(o, i.unitPriceMinor)} / buc.
                      </span>
                    </span>
                    <span className="text-right whitespace-nowrap tabular-nums">
                      {money(o, i.lineTotalMinor)}
                      {i.discountMinor > 0 && (
                        <span className="block text-[13px] text-cyan-700">
                          −{money(o, i.discountMinor)} = {money(o, i.lineTotalMinor - i.discountMinor)}
                        </span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
            <dl className="mt-2 space-y-1 border-t border-mist-2 pt-2">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="tabular-nums">{money(o, o.subtotalMinor)}</dd>
              </div>
              {o.promotions.map((p) => (
                <div key={p.id} className="flex justify-between text-cyan-700">
                  <dt>
                    Promoție: {p.label} <span className="text-muted">({p.id})</span>
                  </dt>
                  <dd className="tabular-nums">−{money(o, p.amountMinor)}</dd>
                </div>
              ))}
              {o.discountMinor > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">Reducere totală</dt>
                  <dd className="tabular-nums">−{money(o, o.discountMinor)}</dd>
                </div>
              )}
            </dl>
            <p className="mt-2 flex justify-between border-t border-mist-2 pt-2 font-semibold">
              <span>Total (livrare {o.shippingMinor ? money(o, o.shippingMinor) : 'gratuită'})</span>
              <span className="tabular-nums">{money(o, o.totalMinor)}</span>
            </p>
            {o.refundedMinor > 0 && <p className="mt-1 text-right text-[14px] text-red-deep">Rambursat: {money(o, o.refundedMinor)}</p>}
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
                ['Sursa comenzii', attributionSummary(o.attribution)],
                ...(o.attribution?.landing
                  ? ([['Landing', `${o.attribution.landingHost ?? ''}${o.attribution.landingPath ?? ''}`]] as [string, string][])
                  : []),
                ...Object.entries(o.attribution?.utm ?? {}).map(([k, v]) => [k, v] as [string, string]),
                ['Bifă marketing la această comandă', o.marketingConsent ? 'Da' : 'Nu'],
                ['Marketing email acum', consent ? `${consent.granted ? 'Acord' : 'Retras'} · ${dt(consent.at)} · ${consent.source} · ${consent.version}` : 'Fără acord'],
                ['Apeluri AI acum', !phone ? 'Fără număr românesc' : call ? `${call.granted ? 'Acord' : 'Retras'} · ${dt(call.at)} · ${call.source}${call.version ? ` · ${call.version}` : ''}` : 'Fără acord'],
                ...(o.recoveryStatus
                  ? ([['Recuperare checkout', `${o.recoveryStatus === 'eligible' ? 'Permisă' : 'Nepermisă'} (${o.recoveryReason})`]] as [string, string][])
                  : []),
              ]}
            />
          </Panel>

          {withdrawalList.length > 0 && (
            <Panel title="Cereri de retragere">
              {o.returnStatus && (
                <p className="mb-2 text-[14px]">
                  Retur: <strong>{o.returnStatus === 'received' ? `primit ${dt(o.returnReceivedAt)}` : `solicitat ${dt(o.returnRequestedAt)}`}</strong>
                </p>
              )}
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
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <span className="font-medium">{e.type}</span> <span className="text-muted">· {e.source}</span>
                    {eventDetails(e.data) && <span className="block text-[13px] text-muted">{eventDetails(e.data)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="min-w-0 space-y-5 lg:col-span-5">
          <Panel title="Acțiuni">
            <div className="space-y-4">
              {o.riskReview === 'pending' && o.status !== 'cancelled' && (
                <div className="rounded-[12px] bg-[#fff4d6] p-4">
                  <p className="text-[14px] text-text">
                    <strong>Necesită verificare</strong> (scor {o.riskScore ?? '–'}). Până la confirmare comanda nu se pregătește, iar clientul nu primește emailuri de recuperare sau
                    apeluri AI. Plata nu se schimbă.
                  </p>
                  {o.riskReasons.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-[13.5px] text-text">
                      {o.riskReasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  )}
                  <form action={clearRiskAction} className="mt-3">
                    <input type="hidden" name="id" value={o.id} />
                    <Confirm text="Am verificat clientul (de exemplu la telefon): comanda este legitimă." />
                    <input name="note" maxLength={300} placeholder="Notă (opțional)" className="mt-2 w-full rounded-[8px] border border-mist-2 bg-white px-2.5 py-1.5 text-[14px]" />
                    <button className="cta sm mt-2">Confirmă comanda</button>
                  </form>
                  <form action={holdRiskAction} className="mt-3 border-t border-[#ecd9a6] pt-3">
                    <input type="hidden" name="id" value={o.id} />
                    <Confirm text="Rămâne în verificare (nu se pregătește)." />
                    <input name="note" maxLength={300} placeholder="Ce ai aflat (de ex. nu răspunde)" className="mt-2 w-full rounded-[8px] border border-mist-2 bg-white px-2.5 py-1.5 text-[14px]" />
                    <button className="mt-2 rounded-[10px] bg-white px-3 py-1.5 text-[14px] text-ink">Menține în verificare</button>
                  </form>
                </div>
              )}
              {o.riskReview === 'cleared' && <p className="text-[13.5px] text-muted">Verificată și confirmată legitimă{o.riskReviewedAt ? ` la ${dt(o.riskReviewedAt)}` : ''}.</p>}
              {o.teamConfirmation === 'awaiting' && o.status !== 'cancelled' && (
                <form action={confirmTeamAction} className="rounded-[12px] bg-[#fff4d6] p-4">
                  <input type="hidden" name="id" value={o.id} />
                  <p className="text-[14px] text-text">
                    <strong>Comandă companie (40%).</strong> Sună clientul și confirmă cantitățile și livrarea. Până la confirmare comanda nu se pregătește.
                  </p>
                  <Confirm text="Am vorbit cu clientul: cantitățile și livrarea sunt confirmate." />
                  <button className="cta sm mt-3">Confirmă comanda</button>
                </form>
              )}
              {o.teamConfirmation === 'confirmed' && <p className="text-[13.5px] text-muted">Comandă companie confirmată de echipă{o.teamConfirmedAt ? ` la ${dt(o.teamConfirmedAt)}` : ''}.</p>}
              {o.paymentMethod === 'bank_transfer' && o.paymentStatus === 'awaiting_transfer' && o.status !== 'cancelled' && (
                <form action={markPaidAction} className="rounded-[12px] bg-mist p-4">
                  <input type="hidden" name="id" value={o.id} />
                  <p className="text-[14px] text-text">
                    Confirmă doar după ce vezi în extras <strong>{money(o, o.totalMinor)}</strong> cu referința <strong>{o.orderNumber}</strong>.
                  </p>
                  <Confirm text={`Am văzut ${money(o, o.totalMinor)} în extras, cu referința ${o.orderNumber}.`} />
                  <button className="cta sm mt-3">Plata a fost primită</button>
                </form>
              )}
              {cod && (o.status === 'shipped' || o.status === 'delivered') && (
                <form action={codCollectedAction} className="space-y-2 rounded-[12px] bg-mist p-4">
                  <input type="hidden" name="id" value={o.id} />
                  <p className="text-[14px] text-text">
                    Confirmă încasarea doar după ce curierul a decontat <strong>{money(o, ship.cashOnDeliveryMinor)}</strong> pentru AWB <strong>{o.trackingNumber}</strong>. Livrarea singură nu înseamnă încasare.
                  </p>
                  <input name="amount" inputMode="decimal" required placeholder={`Suma decontată, ex. ${(ship.cashOnDeliveryMinor / 100).toFixed(2)}`} className="field !min-h-11 !py-2" aria-label="Suma decontată în lei" />
                  <input name="reference" required minLength={3} placeholder="Referința decontului (borderou / OP)" className="field !min-h-11 !py-2" aria-label="Referința decontului" />
                  <Confirm text="Curierul a decontat suma, iar referința e corectă." />
                  <button className="cta sm w-full">Rambursul a fost încasat</button>
                  <p className="text-[13px] text-muted">Suma trebuie să fie exact totalul comenzii. Altfel, nimic nu se schimbă.</p>
                </form>
              )}
              {canFulfil(o) && canMoveOrder(o.status, 'processing') && (
                <form action={processingAction}>
                  <input type="hidden" name="id" value={o.id} />
                  <button className="btn-secondary sm w-full">Marchează în pregătire</button>
                </form>
              )}
              {canFulfil(o) && canMoveOrder(o.status, 'shipped') && (
                <form action={shipAction} className="space-y-2 rounded-[12px] bg-mist p-4">
                  <input type="hidden" name="id" value={o.id} />
                  <p className="text-[14px] font-medium">Expediere</p>
                  <dl className="space-y-0.5 rounded-[10px] bg-paper p-3 text-[13.5px]">
                    <div><dt className="inline text-muted">Destinatar: </dt><dd className="inline">{ship.recipient}, {ship.phone}</dd></div>
                    <div><dt className="inline text-muted">Adresă: </dt><dd className="inline">{formatAddress(ship.address)}</dd></div>
                    <div><dt className="inline text-muted">Conținut: </dt><dd className="inline">{ship.contents}</dd></div>
                    <div><dt className="inline text-muted">Valoare declarată: </dt><dd className="inline tabular-nums">{money(o, ship.declaredValueMinor)}</dd></div>
                    <div className="font-semibold"><dt className="inline">Ramburs de încasat: </dt><dd className="inline tabular-nums">{ship.cashOnDeliveryMinor ? money(o, ship.cashOnDeliveryMinor) : 'nu (plătită)'}</dd></div>
                  </dl>
                  <p className="text-[12.5px] text-muted">Rezervi AWB-ul în portalul curierului cu aceste date{ship.cashOnDeliveryMinor ? ', cu serviciul ramburs pe suma de mai sus' : ''}, apoi completezi mai jos.</p>
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
              {o.paymentMethod !== 'card' && paid && (
                <form action={refundAction} className="space-y-2 rounded-[12px] bg-mist p-4">
                  <input type="hidden" name="id" value={o.id} />
                  <p className="text-[14px] text-text">După ce ai returnat banii din bancă, înregistrează totalul rambursat până acum (lei).</p>
                  <input name="amount" inputMode="decimal" required placeholder={`ex. ${(o.totalMinor / 100).toFixed(2)}`} className="field !min-h-11 !py-2" aria-label="Total rambursat în lei" />
                  <Confirm text="Banii au plecat deja din bancă." />
                  <button className="btn-secondary sm w-full">Înregistrează rambursarea</button>
                </form>
              )}
              {(isPurchased(o) || o.paymentStatus === 'refunded') && o.returnStatus !== 'received' && (
                <div className="space-y-2 rounded-[12px] bg-mist p-4">
                  <p className="text-[14px] font-medium">Retur</p>
                  <p className="text-[13.5px] text-text">
                    {o.returnStatus === 'requested'
                      ? `Solicitat la ${dt(o.returnRequestedAt)}. Marchează când coletul a ajuns înapoi și l-ai verificat.`
                      : 'Pentru o retragere primită pe email sau telefon (cele din formular apar singure).'}
                  </p>
                  {!o.returnStatus && (
                    <form action={returnRequestedAction}>
                      <input type="hidden" name="id" value={o.id} />
                      <button className="btn-secondary sm w-full">Marchează retur solicitat</button>
                    </form>
                  )}
                  <form action={returnReceivedAction}>
                    <input type="hidden" name="id" value={o.id} />
                    <button className="btn-secondary sm w-full">Produsul returnat a fost primit</button>
                  </form>
                  <p className="text-[13px] text-muted">Rambursarea se face separat: din Stripe (card) sau din bancă, apoi înregistrată mai jos (transfer).</p>
                </div>
              )}
              {canCancel(o) && (
                <form action={cancelAction} className="space-y-2">
                  <input type="hidden" name="id" value={o.id} />
                  <input name="reason" placeholder="Motivul anulării" className="field !min-h-11 !py-2" aria-label="Motivul anulării" />
                  <Confirm text="Anulez comanda. Clientul primește emailul de anulare." />
                  <button className="btn-secondary sm w-full !text-red-deep">Anulează comanda</button>
                  {paid && <p className="text-[13px] text-muted">Comanda este plătită: fă rambursarea din Stripe (card) sau din bancă (transfer, ramburs).</p>}
                  {cod && o.status === 'shipped' && <p className="text-[13px] text-muted">Pentru un colet refuzat la livrare: nu s-a încasat nimic.</p>}
                </form>
              )}
            </div>
          </Panel>

          <Panel title="Plată, factură, CRM">
            <Rows
              rows={[
                ['Metodă', PAYMENT_METHOD_LABEL[o.paymentMethod]],
                ['Plătită la', dt(o.paidAt)],
                ...(o.paymentMethod === 'cash_on_delivery'
                  ? ([
                      ['Ramburs', o.codAmountMinor ? money(o, o.codAmountMinor) : '–'],
                      ['Decont curier', o.codReference ?? '–'],
                    ] as [string, string][])
                  : []),
                ['Stripe', o.stripePaymentIntentId ?? '–'],
                ['Factură', o.fgoInvoiceNumber ? `${o.fgoInvoiceSeries} ${o.fgoInvoiceNumber}` : INVOICE_LABEL[o.invoiceStatus]],
                ['Storno', o.fgoStornoNumber ?? '–'],
                ['Stare GHL', crmState],
                ['GHL contact', o.ghlContactId ?? '–'],
                ['GHL oportunitate', o.ghlOpportunityId ?? '–'],
                ['Curier / AWB', o.trackingNumber ? `${o.courier} · ${o.trackingNumber}` : '–'],
                ['Livrare', o.deliveredAt ? `livrată ${dt(o.deliveredAt)}` : o.shippedAt ? `expediată ${dt(o.shippedAt)}` : 'neexpediată'],
              ]}
            />
            {o.trackingUrl && (
              <a href={o.trackingUrl} target="_blank" rel="noopener noreferrer" className="mt-2 mr-4 inline-block text-[14px] underline underline-offset-4">
                Urmărește coletul
              </a>
            )}
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

          <Panel title="Emailuri, notificări și sincronizări">
            <ul className="space-y-2 text-[14px]">
              {jobList.map((j) => (
                <li key={j.id} className="flex items-start justify-between gap-3">
                  <span>
                    <span className="font-medium">{jobTitle(j)}</span>
                    <span className={`block text-[13px] ${j.status === 'failed' || j.status === 'retry' ? 'text-red-deep' : 'text-muted'}`}>
                      {jobState(j)}
                      {j.attempts && j.status !== 'retry' ? ` · ${j.attempts} încercări` : ''}
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

/** A sensitive action needs a ticked box; the Server Action checks it too. */
function Confirm({ text }: { text: string }) {
  return (
    <label className="mt-2 flex items-start gap-2 text-[13.5px] text-text">
      <input type="checkbox" name="confirm" value="da" required className="mt-1" />
      <span>{text}</span>
    </label>
  )
}

/** The useful part of an event's data, in one line (no personal data is stored in events). */
function eventDetails(data: Record<string, unknown>) {
  const LABEL: Record<string, string> = { courier: 'curier', trackingNumber: 'AWB', reason: 'motiv', amount: 'sumă', refundedMinor: 'rambursat', codAmount: 'ramburs', reference: 'referință', series: 'serie', number: 'număr', template: 'email', via: 'prin', eventId: 'eveniment Stripe', score: 'scor', note: 'notă' }
  const MONEY = new Set(['amount', 'refundedMinor', 'codAmount', 'amountMinor'])
  return Object.entries(data ?? {})
    .filter(([k, v]) => LABEL[k] && v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${LABEL[k]}: ${MONEY.has(k) && typeof v === 'number' ? formatLei(v) : String(v)}`)
    .join(' · ')
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
        <div key={k} className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 py-2 sm:grid-cols-[150px_minmax(0,1fr)]">
          <dt className="text-muted">{k}</dt>
          <dd className="[overflow-wrap:anywhere]">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
