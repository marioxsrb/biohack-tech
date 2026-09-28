const dayIn = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' })

/** Calendar day in Romania: ISO (2026-09-29) for the counter row, compact (20260929) for the number. */
export function orderDay(date: Date): { iso: string; compact: string } {
  const iso = dayIn.format(date)
  return { iso, compact: iso.replaceAll('-', '') }
}

/**
 * Human order number: BHT-20260929-0007. Day of creation (Romanian time) plus that day's sequence,
 * zero-padded to 4 digits (it grows to 5 after 9999 orders in a day, never colliding).
 * Only [A-Z0-9-]: safe for Stripe metadata, FGO, GoHighLevel and email subjects.
 */
export function formatOrderNumber(seq: number, date: Date): string {
  if (!Number.isInteger(seq) || seq < 1) throw new Error('invalid order sequence')
  return `BHT-${orderDay(date).compact}-${String(seq).padStart(4, '0')}`
}

export const ORDER_NUMBER_RE = /^BHT-\d{8}-\d{4,}$/
