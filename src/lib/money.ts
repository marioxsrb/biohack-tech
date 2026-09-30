/**
 * Money is stored in bani (integer minor units of the leu). One currency: RON.
 * Presentation follows Romanian convention: "6.380 lei", "6.380,50 lei".
 */
export const CURRENCY = 'RON' as const

const whole = new Intl.NumberFormat('ro-RO', { useGrouping: 'always', maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('ro-RO', { useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatLei(bani: number): string {
  const lei = bani / 100
  return `${(Number.isInteger(lei) ? whole : decimal).format(lei)} lei`
}

/** Line total and order total, always recomputed from catalog prices. */
export const lineTotal = (unit: number, quantity: number) => unit * quantity
export const orderTotal = (lines: { unit: number; quantity: number }[]) => lines.reduce((s, l) => s + l.unit * l.quantity, 0)
