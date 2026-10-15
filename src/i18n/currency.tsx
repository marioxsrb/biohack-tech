'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { convertAmount, convertUnit, formatMoney, ruleIn, type Currency } from '@/lib/currency'
import type { PromoCodeRule } from '@/lib/promotions'
import { useLocale } from './LocaleProvider'

/**
 * The visitor's currency. Romanian pages are always in lei; English pages are in euro unless the visitor picked
 * dollars (cookie bt_cur, one year, read by the checkout too). The first render is euro on English pages (the same
 * on the server and in the browser), then the chosen currency.
 */
export const CURRENCY_COOKIE = 'bt_cur'
const listeners = new Set<() => void>()

const read = (): Currency | null => {
  const m = new RegExp(`(?:^|; )${CURRENCY_COOKIE}=(EUR|USD)`).exec(document.cookie)
  return (m?.[1] as Currency) ?? null
}

export function setCurrency(c: 'EUR' | 'USD') {
  document.cookie = `${CURRENCY_COOKIE}=${c}; path=/; max-age=31536000; samesite=lax`
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useCurrency(): Currency {
  const locale = useLocale()
  const chosen = useSyncExternalStore(subscribe, read, () => null)
  if (locale === 'ro') return 'RON'
  return chosen === 'USD' ? 'USD' : 'EUR'
}

/** Prices in the visitor's currency: `unit` converts a catalog price (lei), `fmt` formats an amount already in it. */
export function useMoney() {
  const currency = useCurrency()
  return useMemo(
    () => ({
      currency,
      unit: (bani: number) => convertUnit(bani, currency),
      amount: (bani: number) => convertAmount(bani, currency),
      fmt: (minor: number) => formatMoney(minor, currency),
      rule: (r: PromoCodeRule) => ruleIn(r, currency),
    }),
    [currency],
  )
}
