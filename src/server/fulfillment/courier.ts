/**
 * The boundary to a courier. Today there is one provider, `manual`: the team books the parcel in the
 * courier's own portal and types the courier name, the AWB and (optionally) the tracking link in /admin.
 * No courier has been chosen by the business, so none is integrated or assumed here.
 *
 * A future provider (an API integration) implements the same interface and is selected with
 * COURIER_PROVIDER. It may add `createShipment`, but the order still becomes "shipped" only through
 * markShipped(), so emails, the CRM and the audit trail stay the same.
 */
import 'server-only'
import { customerName, type Address, type Order } from '@/server/orders/model'
import { awaitsCollection } from '@/server/orders/state'

export type CourierAdapter = {
  id: string
  /** Builds the public tracking link when the provider knows how; manual never guesses one. */
  trackingUrl(courierName: string, trackingNumber: string): string | undefined
}

const manual: CourierAdapter = {
  id: 'manual',
  trackingUrl: () => undefined,
}

const PROVIDERS: Record<string, CourierAdapter> = { manual }

export function courier(): CourierAdapter {
  const id = process.env.COURIER_PROVIDER?.trim() || 'manual'
  return PROVIDERS[id] ?? manual
}

/**
 * Everything a courier needs for one parcel, from the canonical order. Today the team copies it into the
 * courier's portal from /admin; a provider integration will send exactly this. `cashOnDeliveryMinor` is the
 * amount the courier must collect at the door: the order total for an uncollected cash-on-delivery order,
 * 0 otherwise. Nothing here books an AWB or collects money.
 */
export type ShipmentData = {
  reference: string
  recipient: string
  phone: string
  email: string
  address: Address
  contents: string
  parcels: number
  declaredValueMinor: number
  cashOnDeliveryMinor: number
}

export function shipmentFor(o: Order): ShipmentData {
  return {
    reference: o.orderNumber,
    recipient: o.customer.buyerType === 'pj' && o.customer.company ? `${o.customer.company} (${customerName(o.customer)})` : customerName(o.customer),
    phone: o.phone,
    email: o.email,
    address: o.shippingAddress,
    contents: o.items.map((i) => `${i.quantity} x ${i.productName}${i.variantName ? ` (${i.variantName})` : ''}`).join(', '),
    parcels: 1,
    declaredValueMinor: o.totalMinor,
    cashOnDeliveryMinor: awaitsCollection(o) ? (o.codAmountMinor ?? o.totalMinor) : 0,
  }
}
