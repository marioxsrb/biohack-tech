import { countryName } from '@/lib/countries'
import Link from 'next/link'
import { connection } from 'next/server'
import { companyLine } from '@/config/company'
import { site } from '@/config/site'
import { formatLei } from '@/lib/money'
import { formatMoney } from '@/lib/currency'
import { getDb } from '@/server/db'
import { shipmentFor } from '@/server/fulfillment/courier'
import { customerName, formatAddress, PAYMENT_METHOD_LABEL, type Order } from '@/server/orders/model'
import { orders } from '@/server/orders/repository'
import { ORDER_LABEL, PAYMENT_LABEL } from '@/app/[lang]/(admin)/admin/labels'
import { PrintButton } from '@/app/[lang]/(print)/admin/print/PrintButton'

const DOCS = {
  pregatire: 'Fișă de pregătire',
  livrare: 'Fișă de livrare',
  eticheta: 'Etichetă internă de colet',
  detalii: 'Detaliile comenzii',
} as const
type Doc = keyof typeof DOCS

const dt = (d: Date | null) => (d ? d.toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/**
 * Printable documents for one or more orders (A4, browser print; "Save as PDF" works too). The parcel label is
 * an internal label for the team (recipient, address, order, cash to collect): it is NOT a courier AWB, which
 * only the courier issues. Courier and AWB appear when they were entered on the order.
 */
export async function OrderDocuments({
  searchParams,
  base,
  restricted = false,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
  /** Where the document tabs link to: /admin/print or /fulfillment/print. */
  base: string
  /** The fulfillment portal: no order values or payment state (only what the courier collects). */
  restricted?: boolean
}) {
  await connection()
  const sp = await searchParams
  const doc: Doc = typeof sp.doc === 'string' && sp.doc in DOCS ? (sp.doc as Doc) : 'pregatire'
  const ids = [sp.ids ?? sp.id].flat().flatMap((v) => String(v ?? '').split(',')).filter((v) => UUID.test(v)).slice(0, 50)
  const db = await getDb()
  const list = (await Promise.all(ids.map((id) => orders.byId(db, id)))).filter((o): o is Order => !!o)
  const parents = new Map((await Promise.all(list.filter((o) => o.parentOrderId).map((o) => orders.byId(db, o.parentOrderId!)))).filter((o): o is Order => !!o).map((o) => [o.id, o]))
  const children = new Map((await Promise.all(list.map(async (o) => [o.id, await orders.childOf(db, o.id)] as const))).filter(([, c]) => !!c) as [string, Order][])

  return (
    <div className="mx-auto max-w-[210mm] p-6 print:p-0">
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <h1 className="text-[22px] font-semibold">{DOCS[doc]}</h1>
        <span className="text-[14px] text-muted">{list.length} {list.length === 1 ? 'comandă' : 'comenzi'}</span>
        <span className="ml-auto flex flex-wrap gap-2 text-[14px]">
          {(Object.keys(DOCS) as Doc[]).map((d) => (
            <Link key={d} href={`${base}?doc=${d}&ids=${list.map((o) => o.id).join(',')}`} className={`rounded-full px-3 py-1.5 ${d === doc ? 'bg-ink text-white' : 'bg-mist text-ink'}`}>
              {DOCS[d]}
            </Link>
          ))}
          <PrintButton />
        </span>
      </div>
      {!list.length && <p className="text-muted">Nicio comandă selectată.</p>}

      {doc === 'eticheta' ? (
        <div className="grid grid-cols-2 gap-[6mm]">
          {list.map((o) => {
            const s = shipmentFor(o)
            return (
              <section key={o.id} className="break-inside-avoid rounded-[3mm] border-2 border-black p-[5mm] text-[12pt] leading-snug">
                <p className="text-[8pt] font-semibold tracking-wide uppercase">Etichetă internă · nu este AWB</p>
                <p className="mt-[3mm] text-[9pt] uppercase">Destinatar</p>
                <p className="text-[15pt] font-bold">{s.recipient}</p>
                <p>{s.address.address}</p>
                <p>
                  {s.address.postalCode} {s.address.city}, jud. {s.address.county}
                </p>
                {/* An order abroad (the international site): the country, never left out. Romania prints as before. */}
                {s.address.country && s.address.country !== 'RO' && <p className="font-semibold">{countryName(s.address.country)}</p>}
                <p className="font-semibold">Tel. {s.phone}</p>
                <div className="mt-[3mm] flex justify-between border-t border-black pt-[2mm] text-[10pt]">
                  <span>Comanda {o.orderNumber}</span>
                  <span>{o.courier && o.trackingNumber ? `${o.courier} · AWB ${o.trackingNumber}` : 'AWB: de la curier'}</span>
                </div>
                {s.cashOnDeliveryMinor > 0 && <p className="mt-[2mm] text-[13pt] font-bold">RAMBURS: {formatLei(s.cashOnDeliveryMinor)}</p>}
                <p className="mt-[2mm] text-[8pt]">Expeditor: {companyLine() || site.name} · {site.phone}</p>
              </section>
            )
          })}
        </div>
      ) : (
        list.map((o) => {
          const s = shipmentFor(o)
          const parent = o.parentOrderId ? parents.get(o.parentOrderId) : undefined
          const child = children.get(o.id)
          return (
            <section key={o.id} className="mb-[10mm] break-after-page text-[11pt] leading-snug last:break-after-auto">
              <header className="flex items-start justify-between border-b-2 border-black pb-[3mm]">
                <div>
                  <p className="text-[9pt] tracking-wide uppercase">{DOCS[doc]}</p>
                  <p className="text-[20pt] font-bold">{o.orderNumber}</p>
                  <p className="text-[10pt]">
                    {dt(o.createdAt)} · {PAYMENT_METHOD_LABEL[o.paymentMethod]}{restricted ? '' : ` · ${PAYMENT_LABEL[o.paymentStatus]}`} · {ORDER_LABEL[o.status]}
                  </p>
                </div>
                <p className="text-right text-[9pt]">{companyLine() || site.name}</p>
              </header>

              {(parent || child) && (
                <p className="mt-[3mm] border border-black p-[2mm] text-[10pt]">
                  {parent ? `Adăugată după plată la ${parent.orderNumber}: se expediază împreună.` : `Are o comandă adăugată după plată (${child!.orderNumber}): se expediază împreună.`}
                </p>
              )}

              {(doc === 'pregatire' || doc === 'detalii') && (
                <table className="mt-[4mm] w-full border-collapse text-[10.5pt]">
                  <thead>
                    <tr className="border-b border-black text-left">
                      {doc === 'pregatire' && <th className="w-[10mm] py-[1.5mm]">✓</th>}
                      <th className="py-[1.5mm]">Produs</th>
                      <th className="py-[1.5mm]">Variantă</th>
                      <th className="py-[1.5mm]">Cod</th>
                      <th className="py-[1.5mm] text-right">Cant.</th>
                      {doc === 'detalii' && !restricted && <th className="py-[1.5mm] text-right">Valoare</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {o.items.map((i) => (
                      <tr key={i.position} className="border-b border-black/30">
                        {doc === 'pregatire' && (
                          <td className="py-[2mm]">
                            <span className="inline-block h-[4mm] w-[4mm] border border-black" />
                          </td>
                        )}
                        <td className="py-[2mm] font-semibold">{i.productName}</td>
                        <td className="py-[2mm]">{i.variantName ?? '–'}</td>
                        <td className="py-[2mm] text-[9pt]">{i.sku}</td>
                        <td className="py-[2mm] text-right text-[13pt] font-bold">{i.quantity}</td>
                        {doc === 'detalii' && !restricted && <td className="py-[2mm] text-right">{formatMoney(i.lineTotalMinor - i.discountMinor, o.currency)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {doc === 'pregatire' && (
                <div className="mt-[5mm] grid grid-cols-2 gap-[5mm] text-[10.5pt]">
                  <div>
                    <p className="font-semibold">Verificare colet</p>
                    {['Produsele și variantele de mai sus, în cantitățile indicate', 'Produsele sunt intacte, în ambalajul original', o.fgoInvoiceNumber ? `Factura ${o.fgoInvoiceSeries} ${o.fgoInvoiceNumber} (tipărită sau trimisă pe email)` : 'Factura: încă neemisă', 'Coletul închis și etichetat'].map((t) => (
                      <p key={t} className="mt-[1.5mm] flex gap-[2mm]">
                        <span className="mt-[0.5mm] inline-block h-[3.5mm] w-[3.5mm] flex-none border border-black" /> {t}
                      </p>
                    ))}
                  </div>
                  <div>
                    <p className="font-semibold">Plată</p>
                    <p>{PAYMENT_METHOD_LABEL[o.paymentMethod]}</p>
                    {s.cashOnDeliveryMinor > 0 ? <p className="text-[13pt] font-bold">Ramburs de încasat: {formatLei(s.cashOnDeliveryMinor)}</p> : <p>Nimic de încasat la livrare.</p>}
                    <p className="mt-[3mm] font-semibold">Observații client</p>
                    <p>{o.notes || '–'}</p>
                  </div>
                </div>
              )}

              {(doc === 'livrare' || doc === 'detalii') && (
                <div className="mt-[5mm] grid grid-cols-2 gap-[5mm] text-[10.5pt]">
                  <div>
                    <p className="font-semibold">Livrare</p>
                    <p className="text-[13pt] font-bold">{s.recipient}</p>
                    <p>{o.shippingAddress.address}</p>
                    <p>
                      {o.shippingAddress.city}, jud. {o.shippingAddress.county}
                    </p>
                    <p>Cod poștal {o.shippingAddress.postalCode}</p>
                    {o.shippingAddress.country && o.shippingAddress.country !== 'RO' && <p className="font-semibold">{countryName(o.shippingAddress.country)}</p>}
                    <p className="font-semibold">Telefon {o.phone}</p>
                    <p>{o.email}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Curier</p>
                    <p>{o.courier ?? 'Neatribuit încă'}</p>
                    <p>AWB: {o.trackingNumber ?? '–'}</p>
                    {o.trackingUrl && <p className="break-all text-[9pt]">{o.trackingUrl}</p>}
                    <p>Expediată: {dt(o.shippedAt)}</p>
                    {s.cashOnDeliveryMinor > 0 && <p className="text-[13pt] font-bold">Ramburs: {formatLei(s.cashOnDeliveryMinor)}</p>}
                    <p className="mt-[2mm] text-[9pt]">Conținut: {s.contents}</p>
                  </div>
                </div>
              )}

              {doc === 'detalii' && (
                <div className="mt-[5mm] grid grid-cols-2 gap-[5mm] text-[10.5pt]">
                  <div>
                    <p className="font-semibold">Facturare</p>
                    <p>{o.customer.buyerType === 'pj' ? `Persoană juridică: ${o.customer.company ?? ''}` : `Persoană fizică: ${customerName(o.customer)}`}</p>
                    {o.customer.buyerType === 'pj' && (
                      <p>
                        CUI {o.customer.cui ?? '–'} · Reg. Com. {o.customer.regCom ?? '–'}
                      </p>
                    )}
                    <p>{formatAddress(o.billingAddress)}</p>
                    <p>Factură: {o.fgoInvoiceNumber ? `${o.fgoInvoiceSeries} ${o.fgoInvoiceNumber}` : o.invoiceStatus}</p>
                  </div>
                  {!restricted && (
                    <div>
                      <p className="font-semibold">Total</p>
                    <p>Subtotal {formatMoney(o.subtotalMinor, o.currency)}</p>
                    {o.discountMinor > 0 && <p>Reduceri −{formatMoney(o.discountMinor, o.currency)}</p>}
                    <p className="text-[13pt] font-bold">Total {formatMoney(o.totalMinor, o.currency)}</p>
                    {o.refundedMinor > 0 && <p>Rambursat {formatMoney(o.refundedMinor, o.currency)}</p>}
                      <p>Plătită: {dt(o.paidAt)}</p>
                    </div>
                  )}
                </div>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}
