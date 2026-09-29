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
