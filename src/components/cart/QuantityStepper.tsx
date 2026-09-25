'use client'

import { Minus, Plus } from '@/components/ui/icons'
import { MAX_QTY } from './cart-store'

type Props = {
  value: number
  onChange: (next: number) => void
  label: string
  size?: 'sm' | 'md'
}

export function QuantityStepper({ value, onChange, label, size = 'md' }: Props) {
  // Both sizes keep 44px+ touch targets; "sm" is just narrower.
  const h = size === 'sm' ? 'h-11' : 'h-14'
  const w = size === 'sm' ? 'w-11' : 'w-12'
  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex ${h} items-center rounded-[10px] shadow-[inset_0_0_0_1px_var(--color-line)]`}
    >
      <button
        type="button"
        className={`${w} flex h-full items-center justify-center rounded-l-[10px] text-ink transition-colors hover:bg-paper disabled:text-muted disabled:hover:bg-transparent`}
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label="Scade cantitatea"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-8 text-center text-[15px] font-medium tabular-nums text-ink" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={`${w} flex h-full items-center justify-center rounded-r-[10px] text-ink transition-colors hover:bg-paper disabled:text-muted disabled:hover:bg-transparent`}
        onClick={() => onChange(value + 1)}
        disabled={value >= MAX_QTY}
        aria-label="Crește cantitatea"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
