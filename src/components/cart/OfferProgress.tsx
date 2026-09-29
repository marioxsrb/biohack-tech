'use client'

import Link from 'next/link'
import { Check, Plus } from '@/components/ui/icons'
import { getProduct, productHref, unitPrice, type ProductId } from '@/content/catalog'
import { priceLines, type PromotionProgress } from '@/lib/promotions'
import { formatLei } from '@/lib/money'
import { useCart, type ResolvedLine } from './CartProvider'

/**
 * Where the cart stands for each offer, in three weights: far (a quiet line), one unit away (the benefit
 * in large type, the exact saving and a way to act), active (the saving, confirmed, large). Every amount
 * comes from the promotion engine. Nothing is added unless the customer presses a button.
 * `actions={false}` shows the states without buttons (checkout).
 */
export function OfferProgress({ progress, lines, actions = true, compact = false, className = '' }: { progress: PromotionProgress[]; lines: ResolvedLine[]; actions?: boolean; compact?: boolean; className?: string }) {
  const { add } = useCart()
  if (!progress.length) return null
  return (
    <div className={`space-y-3 ${className}`} aria-live="polite">
      {progress.map((p) => {
        const amber = p.kind === 'buy_x_get_y'
        const steps = Array.from({ length: p.target }, (_, i) => i < p.target - (p.missing || 0))
        const gain = p.state === 'close' ? nextGain(p, lines) : 0
        return (
          <div key={p.id} className="space-y-3">
            {p.active && (
              <div className={`flex items-start gap-4 rounded-[18px] bg-cyan-700 text-white ${compact ? 'px-4 py-3' : 'px-5 py-4'}`}>
                <span className="mt-1 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white/20">
                  <Check className="h-4 w-4" aria-hidden />
                </span>
                <span className="leading-snug">
                  <span className="block text-[14.5px] font-medium text-white/85">Oferta este activă: {p.label}</span>
                  <span className={`mt-0.5 block leading-tight font-semibold tracking-[-0.025em] text-white ${compact ? 'text-[22px]' : 'text-[clamp(24px,2.4vw,30px)]'}`}>
                    Economisești {formatLei(p.savedMinor)}.
                  </span>
                </span>
              </div>
            )}

            {p.state === 'close' && (
              <div className={`rounded-[18px] bg-cyan-50 shadow-[inset_0_0_0_2px_var(--color-cyan-700)] ${compact ? 'p-4' : 'p-5'}`}>
                <p className="text-[15.5px] font-medium text-ink">
                  {amber ? 'Mai adaugă o pereche de NEUROS Amber' : 'Mai adaugă un produs NEUROS Calm, Focus sau Flow'}
                </p>
                <p className={`mt-1 leading-[1.05] font-semibold tracking-[-0.03em] text-cyan-700 ${compact ? 'text-[22px]' : 'text-[clamp(26px,2.6vw,34px)]'}`}>
                  {amber ? (p.active ? 'și primești încă una gratis.' : 'și primești 2+1 gratis.') : 'și primești 20% reducere.'}
                </p>
                {gain > 0 && (
                  <p className="mt-2 text-[15px] text-text">
                    {amber ? `A treia pereche e gratuită: economisești ${formatLei(gain)}.` : `Economisești cel puțin ${formatLei(gain)}.`}
                  </p>
                )}
                <div className="mt-4 flex gap-1.5" aria-hidden>
                  {steps.map((on, i) => (
                    <span key={i} className={`h-2 flex-1 rounded-full ${on ? 'bg-cyan-700' : 'bg-white shadow-[inset_0_0_0_1px_var(--color-line)]'}`} />
                  ))}
                </div>
                {actions && <CloseActions p={p} lines={lines} add={add} />}
              </div>
            )}

            {p.state === 'far' && (
              <p className="rounded-[14px] bg-paper px-4 py-3 text-[14.5px] leading-snug text-text shadow-[inset_0_0_0_1px_var(--color-line)]">
                {amber ? (
                  <>
                    La 3 perechi NEUROS Amber, <strong>una e gratuită</strong>. Mai ai {p.missing}.
                  </>
                ) : (
                  <>
                    La 3 produse NEUROS Calm, Focus sau Flow ai <strong>20% reducere</strong>. Mai ai {p.missing}.
                  </>
                )}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * What one more unit would save, from the engine: for Amber the next free pair, for the 20% the smallest
 * saving among the eligible products (the cheapest one), hence "cel puțin".
 */
function nextGain(p: PromotionProgress, lines: ResolvedLine[]): number {
  const base = lines.map((l) => ({ key: l.key, productId: l.product.id, quantity: l.quantity, unitAmount: l.unit }))
  const saved = (extra: { productId: ProductId; unit: number; key: string }) => {
    const i = base.findIndex((b) => b.key === extra.key)
    const next = i === -1 ? [...base, { key: extra.key, productId: extra.productId, quantity: 1, unitAmount: extra.unit }] : base.map((b, j) => (j === i ? { ...b, quantity: b.quantity + 1 } : b))
    return priceLines(next).promotions.find((a) => a.id === p.id)?.amountMinor ?? 0
  }
  const now = priceLines(base).promotions.find((a) => a.id === p.id)?.amountMinor ?? 0
  const candidates = p.products.flatMap((id) => {
    const product = getProduct(id)!
    if (p.kind === 'buy_x_get_y') {
      const last = [...lines].reverse().find((l) => l.product.id === id)
      return last ? [{ productId: id as ProductId, unit: last.unit, key: last.key }] : []
    }
    const variants = product.variants?.length ? product.variants : [undefined]
    return variants.flatMap((v) => {
      const unit = unitPrice(product, v)
      return unit === null ? [] : [{ productId: id as ProductId, unit, key: `${id}:${v?.id ?? ''}` }]
    })
  })
  const gains = candidates.map((c) => saved(c) - now).filter((g) => g > 0)
  return gains.length ? Math.min(...gains) : 0
}

function CloseActions({ p, lines, add }: { p: PromotionProgress; lines: ResolvedLine[]; add: (id: ProductId, variantId?: string, q?: number) => boolean }) {
  if (p.kind === 'buy_x_get_y') {
    // The same frame again is the obvious choice; another frame is one click away on the product page.
    const last = [...lines].reverse().find((l) => p.products.includes(l.product.id))
    if (!last) return null
    return (
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" onClick={() => add(last.product.id, last.variant?.id, 1)} className="cta sm offer">
          <Plus /> Adaugă încă o pereche{last.variantLabel ? ` (${last.variantLabel})` : ''}
        </button>
        <Link href={`${productHref(last.product)}#cumpara`} className="text-[14.5px] font-medium text-ink underline underline-offset-4">
          Altă ramă
        </Link>
      </div>
    )
  }
  const eligible = p.products.map((id) => getProduct(id)!)
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {eligible.map((e) =>
        e.variants?.length ? (
          <Link key={e.id} href={`${productHref(e)}#cumpara`} className="btn-secondary sm !bg-paper">
            Alege {e.name}
          </Link>
        ) : (
          <button key={e.id} type="button" onClick={() => add(e.id, undefined, 1)} className="cta sm offer">
            <Plus /> Adaugă {e.name}
          </button>
        ),
      )}
    </div>
  )
}
