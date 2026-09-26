const yearIn = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Bucharest', year: 'numeric' })

/** Human order number: BT-2026-000123. Year of creation (Romanian time) plus a global, never-reused sequence. */
export function formatOrderNumber(seq: number, date: Date): string {
  if (!Number.isInteger(seq) || seq < 1) throw new Error('invalid order sequence')
  return `BT-${yearIn.format(date)}-${String(seq).padStart(6, '0')}`
}

export const ORDER_NUMBER_RE = /^BT-\d{4}-\d{6,}$/
