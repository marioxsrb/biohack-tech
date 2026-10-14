import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { customersLine } from '@/lib/social-proof'
import { encodeItem, parseItems } from '@/lib/purchase'
import { priceLines } from '@/lib/promotions'
import { PRICES_RON } from '@/config/prices'
import { socialProof } from '@/config/social-proof'
import { site } from '@/config/site'
import { cashOnDelivery } from '@/config/payments'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

describe('social proof', () => {
  it('shows the confirmed number as a floor, from one config value', () => {
    expect(socialProof.customers).toBe(500)
    expect(customersLine(500, 'ro')).toBe('500+ clienți au ales produsele noastre')
    expect(customersLine(1200, 'ro')).toBe('1.200+ clienți au ales produsele noastre')
    expect(customersLine(500, 'en')).toBe('500+ customers have chosen our products')
  })
  it('the number is written nowhere else', () => {
    for (const f of ['src/components/product/BuyBox.tsx', 'src/components/product/ProductHero.tsx', 'src/lib/social-proof.ts']) expect(read(f)).not.toMatch(/\b500\b/)
  })
  it('no star rating or review count is shown', () => {
    expect(read('src/components/product/BuyBox.tsx')).not.toMatch(/rating|stele|stars|recenzi/i)
  })
})

describe('WhatsApp', () => {
  it('uses the official number, digits only, for wa.me', () => {
    expect(site.whatsapp).toBe('40765874571')
  })
  it('prefills product, variant, quantity and the intent to order', () => {
    const src = read('src/components/product/BuyBox.tsx')
    expect(src).toContain('https://wa.me/${wa}?text=${encodeURIComponent(t.waMessage(product.name, variant ? variantLabel(product, variant) : null, quantity))}')
    expect(src).toContain('Aș dori să plasez o comandă')
    expect(src).toMatch(/Produs: \$\{product\}.*Varianta: \$\{variant\}.*Cantitate: \$\{qty\}/s)
  })
})

describe('bundle offers on the product page', () => {
  // The rows show exactly what the cart and the server charge for that quantity of this product.
  const calm = PRICES_RON['balance-wave'] as number
  const at = (n: number, productId = 'balance-wave', unit = calm) => priceLines([{ key: 'x', productId, quantity: n, unitAmount: unit }])
  it('NEUROS Calm: 1 / 2 (−10%) / 3 (−20%), savings in lei from the real price', () => {
    expect([at(1).totalMinor, at(1).discountMinor]).toEqual([638000, 0])
    expect([at(2).totalMinor, at(2).discountMinor]).toEqual([1148400, 127600])
    expect([at(3).totalMinor, at(3).discountMinor]).toEqual([1531200, 382800])
    expect(at(4).discountMinor).toBe(510400) // 3+ stays 20%
  })
  it('NEUROS Amber: 3 pairs, one free', () => {
    const amber = PRICES_RON['ochelari-biohack'] as number
    expect([at(3, 'ochelari-biohack', amber).totalMinor, at(3, 'ochelari-biohack', amber).discountMinor]).toEqual([63000, 31500])
    expect(at(2, 'ochelari-biohack', amber).discountMinor).toBe(0)
  })
  it('never shows an individual reduced price or a struck-through old price', () => {
    const src = read('src/components/product/BuyBox.tsx') + read('src/components/product/ProductHero.tsx')
    expect(src).not.toMatch(/<s[\s>]|line-through|REFERENCE_PRICES/)
  })
})

describe('order buttons', () => {
  it('cash on delivery is on by default, with no order-value ceiling', () => {
    expect(cashOnDelivery).toEqual({ enabled: true })
  })
  it('"Comandă cu plata la livrare" carries product, variant, quantity and the method, never a price', () => {
    const item = encodeItem({ productId: 'ochelari-biohack', variantId: 'patrat-maro', quantity: 2 })
    expect(item).toBe('ochelari-biohack:patrat-maro*2')
    expect(parseItems(new URLSearchParams({ item, plata: 'ramburs' }))).toEqual([{ productId: 'ochelari-biohack', variantId: 'patrat-maro', quantity: 2, source: 'link' }])
    const btn = read('src/components/cart/BuyNowButton.tsx')
    // Cash on delivery preselects ramburs; the general button names all three methods and lets the
    // checkout open on its default when cash on delivery is on (card only when it is off).
    expect(btn).toContain("pay === 'cod' ? { plata: 'ramburs' } : !cashOnDelivery.enabled && { plata: 'card' }")
    expect(btn).toContain("onlineSubCod: 'Plată la livrare, card sau transfer'")
    expect(btn).toContain("cod: 'Comandă cu plata la livrare'")
    expect(btn).toContain("codSub: 'Plătești curierului când primești coletul'")
  })
})
