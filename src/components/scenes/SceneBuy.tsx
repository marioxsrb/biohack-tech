'use client'

import Link from 'next/link'
import { AddToCartButton } from '@/components/cart/AddToCartButton'
import { Arrow } from '@/components/ui/icons'
import { getProduct, productHref, type ProductId } from '@/content/catalog'
import { Price } from '@/components/cart/Price'

type Props = {
  productId: ProductId
  /** One plain sentence: what you do with it. */
  line?: string
  variantId?: string
  /** Text under the button, e.g. the selected frame. */
  note?: string
  tone?: 'light' | 'dark'
  headingId: string
  /** On the product page the "view product" link is pointless. */
  showLink?: boolean
  /** 'head' = purpose, name, sentence; 'action' = price and buttons; 'all' = both. */
  part?: 'all' | 'head' | 'action'
}

/**
 * The purchase part of every scene. The scenes around it can be as editorial as they like;
 * this block is always the same, conventional thing: what it's for, the name, one sentence,
 * the price, a red "Adaugă în coș" and a secondary link to the product.
 */
export function SceneBuy({ productId, line, variantId, note, tone = 'light', headingId, showLink = true, part = 'all' }: Props) {
  const p = getProduct(productId)!
  const dark = tone === 'dark'
  return (
    <div className={dark ? 'on-dark' : ''}>
      {part !== 'action' && (
        <>
          <p className={`text-[16px] font-medium ${dark ? 'text-cyan' : 'text-cyan-700'}`}>{p.purpose}</p>
          <h2 id={headingId} className={`mt-1 text-[clamp(40px,4.6vw,64px)] leading-[0.98] tracking-[-0.045em] ${dark ? '!text-white' : ''}`}>
            {p.name}
          </h2>
          <p className={`mt-4 max-w-[26em] text-[17px] leading-relaxed ${dark ? 'text-white/85' : 'text-text'}`}>{line}</p>
        </>
      )}
      {part !== 'head' && (
        <>
          <p className={`${part === 'action' ? '' : 'mt-6 '}text-[26px] font-medium tracking-[-0.02em] ${dark ? 'text-white [&_.text-muted]:text-white/70' : 'text-ink'}`}>
            <Price productId={p.id} />
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <AddToCartButton productId={p.id} variantId={variantId} />
            {showLink && (
              <Link href={productHref(p)} className={`tlink ${dark ? '!text-white' : ''}`}>
                Vezi produsul <Arrow />
              </Link>
            )}
          </div>
          {note && <p className={`mt-3 text-[15px] ${dark ? 'text-white/75' : 'text-muted'}`}>{note}</p>}
        </>
      )}
    </div>
  )
}
