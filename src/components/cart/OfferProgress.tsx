'use client'

import Link from 'next/link'
import { Check, Plus } from '@/components/ui/icons'
import { getProduct, productHref, type ProductId } from '@/content/catalog'
import type { PromotionProgress } from '@/lib/promotions'
import { formatLei } from '@/lib/money'
import { useCart, type ResolvedLine } from './CartProvider'

/**
 * Where the cart stands for each offer, in three weights: far (a quiet line), one unit away (a clear block
 * with the benefit large and a way to act), active (the saving, confirmed). Nothing is added unless the
 * customer presses a button. `actions={false}` shows the states without buttons (checkout).
 */
export function OfferProgress({ progress, lines, actions = true, className = '' }: { progress: PromotionProgress[]; lines: ResolvedLine[]; actions?: boolean; className?: string }) {
  const { add } = useCart()
  if (!progress.length) return null
  return (
    <div className={`space-y-3 ${className}`} aria-live="polite">
      {progress.map((p) => {
        const amber = p.kind === 'buy_x_get_y'
        const benefit = amber ? '2+1 gratis' : '20% reducere'
        const steps = Array.from({ length: p.target }, (_, i) => i < p.target - p.missing)
        return (
          <div key={p.id} className="space-y-3">
            {p.active && (
              <div className="flex items-start gap-3 rounded-[14px] bg-cyan-700 px-4 py-3.5 text-white">
                <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-white/20">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="text-[14.5px] leading-snug">
                  <span className="block font-semibold">Oferta este activă: {p.label}</span>
                  <span className="block text-white/85">Economisești {formatLei(p.savedMinor)}.</span>
                </span>
              </div>
            )}

            {p.state === 'close' && (
              <div className="rounded-[14px] bg-paper p-4 shadow-[inset_0_0_0_2px_var(--color-cyan-700)]">
                <p className="text-[14.5px] text-text">{amber ? (p.active ? 'Mai adaugă o pereche' : 'Mai adaugă o pereche NEUROS Amber') : 'Mai ai 1 produs'}</p>
                <p className="mt-0.5 text-[21px] leading-tight font-semibold tracking-[-0.02em] text-ink">
                  {amber ? (p.active ? 'și primești încă una gratuit.' : 'și primești 2+1 gratis.') : 'până la 20% reducere.'}
                </p>
                <div className="mt-3 flex gap-1.5" aria-hidden>
                  {steps.map((on, i) => (
                    <span key={i} className={`h-1.5 flex-1 rounded-full ${on ? 'bg-cyan-700' : 'bg-mist-2'}`} />
                  ))}
                </div>
                {actions && <CloseActions p={p} lines={lines} add={add} />}
              </div>
            )}

            {p.state === 'far' && (
              <p className="rounded-[12px] bg-mist px-4 py-3 text-[14px] leading-snug text-text">
                {amber ? `La 3 perechi NEUROS Amber, una e gratuită. Mai ai ${p.missing}.` : `Cu 3 produse NEUROS Calm, Focus sau Flow ai ${benefit}. Mai ai ${p.missing}.`}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function CloseActions({ p, lines, add }: { p: PromotionProgress; lines: ResolvedLine[]; add: (id: ProductId, variantId?: string, q?: number) => boolean }) {
  if (p.kind === 'buy_x_get_y') {
    // The same frame again is the obvious choice; another frame is one click away on the product page.
    const last = [...lines].reverse().find((l) => p.products.includes(l.product.id))
    if (!last) return null
    return (
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" onClick={() => add(last.product.id, last.variant?.id, 1)} className="cta sm">
          <Plus /> Adaugă încă o pereche{last.variantLabel ? ` (${last.variantLabel})` : ''}
        </button>
        <Link href={`${productHref(last.product)}#cumpara`} className="text-[14px] font-medium text-ink underline underline-offset-4">
          Altă ramă
        </Link>
      </div>
    )
  }
  const eligible = p.products.map((id) => getProduct(id)!)
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {eligible.map((e) =>
        e.variants?.length ? (
          <Link key={e.id} href={`${productHref(e)}#cumpara`} className="btn-secondary sm">
            Alege {e.name}
          </Link>
        ) : (
          <button key={e.id} type="button" onClick={() => add(e.id, undefined, 1)} className="btn-secondary sm">
            <Plus /> {e.name}
          </button>
        ),
      )}
    </div>
  )
}
