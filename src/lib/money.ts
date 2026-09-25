export type Currency = 'EUR' | 'RON'

/** Amounts are stored in minor units (cents / bani) to avoid float rounding. */
export type Money = { amount: number; currency: Currency }

const whole = new Intl.NumberFormat('ro-RO', { useGrouping: 'always', maximumFractionDigits: 0 })
const cents = new Intl.NumberFormat('ro-RO', { useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatMoney({ amount, currency }: Money): string {
  const value = amount / 100
  return `${(Number.isInteger(value) ? whole : cents).format(value)} ${currency}`
}

/** Sums lines per currency. The catalog currently mixes EUR and RON (see docs/OPEN-POINTS.md). */
export function totalsByCurrency(lines: { unit: Money; quantity: number }[]): Money[] {
  const map = new Map<Currency, number>()
  for (const l of lines) map.set(l.unit.currency, (map.get(l.unit.currency) ?? 0) + l.unit.amount * l.quantity)
  return [...map].map(([currency, amount]) => ({ currency, amount }))
}
