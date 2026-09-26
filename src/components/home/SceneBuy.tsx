'use client'

import Link from 'next/link'
import { AddToCartButton } from '@/components/cart/AddToCartButton'
import { Price } from '@/components/cart/Price'
import { Arrow } from '@/components/ui/icons'
import { getProduct, productHref, type ProductId } from '@/content/catalog'

type Props = {
  productId: ProductId
  /** One plain sentence: what you do with it. */
  line: string
  tone?: 'light' | 'dark'
  headingId: string
}

/**
 * The purchase block of a homepage product moment: what it's for, the name, one sentence,
 * the price, "Adaugă în coș" and a link to the product page. Always the same, conventional thing.
 */
export function SceneBuy({ productId, line, tone = 'light', headingId }: Props) {
  const p = getProduct(productId)!
  const dark = tone === 'dark'
  return (
    <div className={dark ? 'on-dark' : ''}>
      <p className={`text-[16px] font-medium ${dark ? 'text-cyan' : 'text-cyan-700'}`}>{p.purpose}</p>
      <h2 id={headingId} className={`mt-1 text-[clamp(40px,4.6vw,64px)] leading-[0.98] tracking-[-0.045em] ${dark ? '!text-white' : ''}`}>
        {p.name}
      </h2>
      <p className={`mt-4 max-w-[26em] text-[17px] leading-relaxed ${dark ? 'text-white/85' : 'text-text'}`}>{line}</p>
      <p className={`mt-6 text-[26px] font-medium tracking-[-0.02em] ${dark ? 'text-white [&_.text-muted]:text-white/70' : 'text-ink'}`}>
        <Price productId={p.id} />
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <AddToCartButton productId={p.id} />
        <Link href={productHref(p)} className={`tlink ${dark ? '!text-white' : ''}`}>
          Vezi produsul <Arrow />
        </Link>
      </div>
    </div>
  )
}
