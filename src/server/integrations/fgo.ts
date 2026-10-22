/**
 * FGO invoicing (api.fgo.ro, spec v7.1). JSON POST, SHA-1 hash per request.
 * One invoice per order: IdExtern = order number with VerificareDuplicat, and the invoice
 * number stored on the order before we ever call again. FGO allows 1 request per second.
 */
import { isGiftLine } from '@/lib/orders/gifts'
import 'server-only'
import { createHash } from 'node:crypto'
import type { FgoConfig } from '@/server/config'
import { billingName, type Order } from '@/server/orders/model'

export class FgoError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message)
  }
}

/** Hash = SHA1(CUI furnizor + cheie privată + denumire client | număr factură), uppercase. */
export const fgoHash = (codUnic: string, privateKey: string, tail: string) =>
  createHash('sha1').update(`${codUnic}${privateKey}${tail}`).digest('hex').toUpperCase()

/** FGO's county names are without diacritics ("Bucuresti", "Arges"). */
export const fgoCounty = (county: string) => county.normalize('NFD').replace(/[̀-ͯ]/g, '')

const lei = (minor: number) => Number((minor / 100).toFixed(2))
/** The currency's word on an invoice line: lei, EUR, USD. */
const unitOf = (o: Order) => (o.currency === 'RON' ? 'lei' : o.currency)

function lineName(i: Order['items'][number], o: Order) {
  const base = i.variantName ? `${i.productName} (${i.variantName})` : i.productName
  if (!i.discountMinor) return base
  const parts: string[] = []
  const auto = i.discountMinor - i.codeDiscountMinor
  if (auto) {
    const label = o.promotions.find((p) => p.id === i.promotionId)?.label ?? 'reducere'
    // A per-product discount names its product ("20% la 3 bucăți NEUROS Calm"); the line already does.
    const promo = label.endsWith(` ${i.productName}`) ? label.slice(0, -i.productName.length - 1) : label
    parts.push(`${promo}: -${(auto / 100).toFixed(2)} ${unitOf(o)}`)
  }
  // A promo code applies after the automatic promotion: its share is named on its own ("cod VARA10"); a personal
  // voucher or a gift by what it is ("Voucher NEUROS Calm BTVC…", "Cadou NEUROS Amber BTGA…").
  if (i.codeDiscountMinor) {
    const label = o.promotions.find((p) => p.id === `cod:${o.promoCode}`)?.label
    const named = label && !label.startsWith('Cod ') ? `${label} ${o.promoCode}` : `cod ${o.promoCode ?? ''}`.trim()
    parts.push(`${named}: -${(i.codeDiscountMinor / 100).toFixed(2)} ${unitOf(o)}`)
  }
  return `${base}, ${parts.join(', ')}`
}

/** The invoice request, built from the canonical order only. */
export function invoicePayload(c: FgoConfig, o: Order) {
  const client = billingName(o.customer)
  const pj = o.customer.buyerType === 'pj'
  return {
    CodUnic: c.codUnic,
    Hash: fgoHash(c.codUnic, c.privateKey, client),
    Serie: c.serie,
    // The order's currency; an order in euro or dollars carries the BNR rate it was priced at.
    Valuta: o.currency,
    ...(o.currency !== 'RON' && { Curs: o.fxRate }),
    TipFactura: 'Factura',
    IdExtern: o.orderNumber,
    VerificareDuplicat: true,
    // The invoice records how it is paid; it is never registered as collected here (no receipt is sent to FGO).
    Text: o.paymentMethod === 'cash_on_delivery' ? `Comanda ${o.orderNumber}. Plata ramburs, la livrare.` : `Comanda ${o.orderNumber}${o.currency !== 'RON' ? `. Curs BNR ${o.currency}: ${o.fxRate} lei` : ''}`,
    Client: {
      Denumire: client,
      Tip: pj ? 'PJ' : 'PF',
      ...(pj && { CodUnic: o.customer.cui, NrRegCom: o.customer.regCom }),
      Email: o.email,
      Telefon: o.phone,
      Tara: o.billingAddress.country || 'RO',
      // A Romanian county by FGO's names; abroad, the region as given (may be empty).
      Judet: o.billingAddress.country && o.billingAddress.country !== 'RO' ? o.billingAddress.county : fgoCounty(o.billingAddress.county),
      Localitate: o.billingAddress.city,
      Adresa: o.billingAddress.address,
    },
    // Prices are VAT-inclusive, so each line sends its total and FGO derives the unit price. A promotion
    // is already split across its lines (whole bani), so line totals add up to exactly what was paid;
    // the line name says which promotion lowered it.
    Continut: o.items.flatMap((i) => {
      // A reward's gift with FGO_GIFT_LINES=discount: the product at its price (less any other discount), then the
      // gift's own negative line, so the lines still add up to what was paid.
      if (c.giftLines === 'discount' && isGiftLine(o, i)) {
        return [
          { Denumire: i.variantName ? `${i.productName} (${i.variantName})` : i.productName, CodArticol: i.sku, UM: c.unit, NrProduse: i.quantity, CotaTVA: c.vatRate, PretTotal: lei(i.lineTotalMinor - i.discountMinor + i.codeDiscountMinor) },
          { Denumire: `Cadou (recompensă) ${o.promoCode}`, CodArticol: 'cadou', UM: c.unit, NrProduse: 1, CotaTVA: c.vatRate, PretTotal: -lei(i.codeDiscountMinor) },
        ]
      }
      return [
        {
          Denumire: lineName(i, o),
          CodArticol: i.sku,
          UM: c.unit,
          NrProduse: i.quantity,
          CotaTVA: c.vatRate,
          PretTotal: lei(i.lineTotalMinor - i.discountMinor),
        },
      ]
    }).concat(
      // Delivery (orders with the book, or with a reward's gift: once): its own line, never discounted, so the lines still add up.
      o.shippingMinor > 0 ? [{ Denumire: 'Transport (livrare prin curier)', CodArticol: 'transport', UM: c.unit, NrProduse: 1, CotaTVA: c.vatRate, PretTotal: lei(o.shippingMinor) }] : [],
    ),
    PlatformaUrl: c.platformUrl,
  }
}

let last = 0
async function throttle() {
  const wait = last + 1100 - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  last = Date.now()
}

type FgoResponse = { Success: boolean; Message?: string; Factura?: { Numar: string; Serie: string; Link?: string } }

async function post(c: FgoConfig, path: string, body: Record<string, unknown>): Promise<FgoResponse> {
  await throttle()
  let res: Response
  try {
    res = await fetch(`${c.apiBase}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    })
  } catch (e) {
    throw new FgoError(`network: ${e instanceof Error ? e.message : e}`, true)
  }
  if (res.status >= 500 || res.status === 429) throw new FgoError(`HTTP ${res.status}`, true)
  const json = (await res.json().catch(() => null)) as FgoResponse | null
  if (!json) throw new FgoError(`HTTP ${res.status}, răspuns invalid`, true)
  if (!json.Success) {
    const msg = json.Message ?? 'eroare necunoscută'
    // FGO's own timeout message says the invoice was NOT issued and to retry.
    throw new FgoError(msg, /timpul maxim|reincercati|reîncercați/i.test(msg))
  }
  return json
}

export const fgo = {
  async issueInvoice(c: FgoConfig, o: Order) {
    const r = await post(c, '/factura/emitere', invoicePayload(c, o))
    if (!r.Factura?.Numar) throw new FgoError('FGO nu a întors numărul facturii', false)
    return { series: r.Factura.Serie, number: r.Factura.Numar, link: r.Factura.Link || null }
  },
  async stornoInvoice(c: FgoConfig, series: string, number: string) {
    const r = await post(c, '/factura/stornare', {
      CodUnic: c.codUnic,
      Hash: fgoHash(c.codUnic, c.privateKey, number),
      Serie: series,
      Numar: number,
      PlatformaUrl: c.platformUrl,
    })
    return { series: r.Factura?.Serie ?? series, number: r.Factura?.Numar ?? '' }
  },
}
