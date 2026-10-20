'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { isPlainClick } from '@/components/landing/checkout-link'
import { Bag, CardIcon } from '@/components/ui/icons'
import { getProduct, isPurchasable, type ProductId } from '@/content/catalog'
import { useLocale } from '@/i18n/LocaleProvider'
import { localePath } from '@/i18n/locales'
import { encodeItem } from '@/lib/purchase'
import { cashOnDelivery } from '@/config/payments'
import { cartStore } from './cart-store'

const COPY = {
  ro: {
    cod: 'Comandă cu plata la livrare',
    codSub: 'Plătești curierului când primești coletul',
    online: 'Comandă acum',
    onlineSub: 'Cu cardul sau prin transfer bancar',
    onlineSubCod: 'Plată la livrare, card sau transfer',
    secondary: 'Card / transfer',
    short: 'Comandă',
    opening: 'Se deschide comanda…',
  },
  en: {
    cod: 'Order with cash on delivery',
    codSub: 'Pay the courier when the parcel arrives',
    online: 'Order now',
    // English pages pay in euro or dollars, by card only.
    onlineSub: 'Secure payment by card',
    onlineSubCod: 'Secure payment by card',
    secondary: 'Card / transfer',
    short: 'Order',
    opening: 'Opening your order…',
  },
}

type Props = {
  productId: ProductId
  variantId?: string
  quantity?: number
  /** Which payment the checkout opens on: cash on delivery, or card (transfer one click away). */
  pay: 'cod' | 'online'
  /** `primary`: the red two-line button. `secondary`: outlined, one line. `bar`: the compact sticky bar. */
  look?: 'primary' | 'secondary' | 'bar'
  className?: string
}

/**
 * The product page's straight road to the checkout, on the same handoff as the landings (`lib/purchase.ts`).
 * The chosen line gets exactly the chosen quantity in the cart (other lines stay), then the checkout opens
 * with the same `?item=` and the payment method preselected (`?plata=`), so a new tab or a reload works too.
 * The checkout and the server price the order again; nothing here carries a price.
 */
export function BuyNowButton({ productId, variantId, quantity = 1, pay, look = 'primary', className = '' }: Props) {
  const router = useRouter()
  const locale = useLocale()
  const t = COPY[locale]
  const [pending, start] = useTransition()
  const product = getProduct(productId, locale)
  if (!product || !isPurchasable(product)) return null

  // With cash on delivery on, the general button lets the checkout open on its default (all three offered).
  const q = new URLSearchParams({ item: encodeItem({ productId, variantId, quantity }), ...(pay === 'cod' ? { plata: 'ramburs' } : !cashOnDelivery.enabled && { plata: 'card' }) })
  const href = localePath(locale, `/checkout?${q}`)
  const label = pay === 'cod' ? t.cod : t.online
  const Icon = look === 'secondary' ? CardIcon : Bag

  return (
    <a
      href={href}
      aria-disabled={pending || undefined}
      aria-label={look === 'primary' ? undefined : label}
      onClick={(e) => {
        if (pending) return e.preventDefault()
        cartStore.put([{ productId, variantId, quantity, source: 'product' }])
        if (!isPlainClick(e)) return
        e.preventDefault()
        start(() => router.push(href))
      }}
      className={`${look === 'secondary' ? 'btn-secondary' : `cta ${look === 'bar' ? 'sm' : 'buy-now'}`} ${pending ? 'is-pending' : ''} ${className}`}
    >
      {pending ? <span aria-hidden className={look === 'secondary' ? 'spinner !border-line !border-t-ink' : 'spinner'} /> : <Icon aria-hidden />}
      {look === 'bar' ? (
        <span>
          {t.short}
        </span>
      ) : look === 'secondary' ? (
        <span className="whitespace-nowrap">
          {t.secondary}
        </span>
      ) : (
        <span className="flex min-w-0 flex-col items-start text-left leading-tight">
          <span className="text-[16.5px] font-semibold whitespace-normal">
            {pending ? t.opening : label}
          </span>
          <span className="mt-0.5 text-[13px] font-normal whitespace-normal text-white/85">{pay === 'cod' ? t.codSub : cashOnDelivery.enabled ? t.onlineSubCod : t.onlineSub}</span>
        </span>
      )}
    </a>
  )
}
