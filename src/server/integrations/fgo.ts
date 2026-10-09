/**
 * FGO invoicing (api.fgo.ro, spec v7.1). JSON POST, SHA-1 hash per request.
 * One invoice per order: IdExtern = order number with VerificareDuplicat, and the invoice
 * number stored on the order before we ever call again. FGO allows 1 request per second.
 */
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

function lineName(i: Order['items'][number], o: Order) {
  const base = i.variantName ? `${i.productName} (${i.variantName})` : i.productName
  if (!i.discountMinor) return base
  const label = o.promotions.find((p) => p.id === i.promotionId)?.label ?? 'reducere'
  // A per-product discount names its product ("20% la 3 bucăți NEUROS Calm"); the line already does.
  const promo = label.endsWith(` ${i.productName}`) ? label.slice(0, -i.productName.length - 1) : label
  return `${base}, ${promo}: -${(i.discountMinor / 100).toFixed(2)} lei`
}

/** The invoice request, built from the canonical order only. */
export function invoicePayload(c: FgoConfig, o: Order) {
  const client = billingName(o.customer)
  const pj = o.customer.buyerType === 'pj'
  return {
    CodUnic: c.codUnic,
    Hash: fgoHash(c.codUnic, c.privateKey, client),
    Serie: c.serie,
    Valuta: 'RON',
    TipFactura: 'Factura',
    IdExtern: o.orderNumber,
    VerificareDuplicat: true,
    // The invoice records how it is paid; it is never registered as collected here (no receipt is sent to FGO).
    Text: o.paymentMethod === 'cash_on_delivery' ? `Comanda ${o.orderNumber}. Plata ramburs, la livrare.` : `Comanda ${o.orderNumber}`,
    Client: {
      Denumire: client,
      Tip: pj ? 'PJ' : 'PF',
      ...(pj && { CodUnic: o.customer.cui, NrRegCom: o.customer.regCom }),
      Email: o.email,
      Telefon: o.phone,
      Tara: 'RO',
      Judet: fgoCounty(o.billingAddress.county),
      Localitate: o.billingAddress.city,
      Adresa: o.billingAddress.address,
    },
    // Prices are VAT-inclusive, so each line sends its total and FGO derives the unit price. A promotion
    // is already split across its lines (whole bani), so line totals add up to exactly what was paid;
    // the line name says which promotion lowered it.
    Continut: o.items.map((i) => ({
      Denumire: lineName(i, o),
      CodArticol: i.sku,
      UM: c.unit,
      NrProduse: i.quantity,
      CotaTVA: c.vatRate,
      PretTotal: lei(i.lineTotalMinor - i.discountMinor),
    })),
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
