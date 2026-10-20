'use client'

import { useLocale } from '@/i18n/LocaleProvider'
import { useMoney } from '@/i18n/currency'
import { MAX_QTY } from '@/lib/purchase'
import { priceLines } from '@/lib/promotions'
import { useCart, type ResolvedLine } from './CartProvider'

/**
 * The next offer, right on the product line it concerns (cart and checkout), instead of separate boxes: one short
 * line and a button that adds the unit. Shown only when one more unit unlocks something; an offer already earned
 * is in the totals. Amounts come from the promotion engine.
 */
export function LineOffer({ line, className = '' }: { line: ResolvedLine; className?: string }) {
  const { lines, progress, setQuantity } = useCart()
  const { fmt } = useMoney()
  const locale = useLocale()
  const en = locale === 'en'
  const p = progress.find((x) => x.products.includes(line.product.id))
  if (!p || line.quantity >= MAX_QTY) return null
  const amber = p.kind === 'buy_x_get_y'
  // 2+1 counts every frame together: the hint sits on the last Amber line only.
  if (amber && [...lines].reverse().find((l) => l.product.id === line.product.id)?.key !== line.key) return null
  if (p.untilNext !== 1) return null

  const base = lines.map((l) => ({ key: l.key, productId: l.product.id, quantity: l.quantity, unitAmount: l.unit }))
  const saved = (ls: typeof base) => priceLines(ls).promotions.filter((a) => a.id === p.id).reduce((s, a) => s + a.amountMinor, 0)
  const gain = saved(base.map((b) => (b.key === line.key ? { ...b, quantity: b.quantity + 1 } : b))) - saved(base)
  if (gain <= 0) return null

  const all = p.units + 1
  const text = amber
    ? en
      ? `Add one more pair, it's free (−${fmt(gain)})`
      : `Adaugă încă o pereche, o primești gratuit (−${fmt(gain)})`
    : en
      ? `Add one more: ${p.nextPercent}% off ${all === 2 ? 'both' : `all ${all}`} (−${fmt(gain)})`
      : `Adaugă încă unul: ${p.nextPercent}% la ${all === 2 ? 'ambele' : all === 3 ? 'toate trei' : `toate ${all}`} (−${fmt(gain)})`

  return (
    <button
      type="button"
      onClick={() => setQuantity(line.key, line.quantity + 1)}
      className={`group mt-1.5 flex items-center gap-1.5 text-left text-[13.5px] leading-snug font-medium text-cyan-700 ${className}`}
    >
      <span aria-hidden className="flex h-4.5 w-4.5 flex-none items-center justify-center rounded-full bg-cyan-700 text-[12px] leading-none text-white">
        +
      </span>
      <span className="underline-offset-4 group-hover:underline">
        {text}
      </span>
    </button>
  )
}
