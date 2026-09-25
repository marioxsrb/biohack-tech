'use client'

import { useEffect, useState } from 'react'
import { Check, Plus } from '@/components/ui/icons'
import type { ProductId } from '@/content/catalog'
import { useCart } from './CartProvider'

type Props = {
  productId: ProductId
  variantId?: string
  quantity?: number
  className?: string
  size?: 'sm' | 'md'
  label?: string
}

export function AddToCartButton({ productId, variantId, quantity = 1, className = '', size = 'md', label = 'Adaugă în coș' }: Props) {
  const { add } = useCart()
  const [added, setAdded] = useState(false)

  useEffect(() => {
    if (!added) return
    const t = setTimeout(() => setAdded(false), 1800)
    return () => clearTimeout(t)
  }, [added])

  return (
    <button
      type="button"
      className={`cta ${size === 'sm' ? 'sm' : ''} ${className}`}
      onClick={() => {
        add(productId, variantId, quantity)
        setAdded(true)
      }}
    >
      {added ? (
        <>
          Adăugat <Check />
        </>
      ) : (
        <>
          {label} <Plus />
        </>
      )}
    </button>
  )
}
