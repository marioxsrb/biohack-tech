import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { reviews, reviewsFor } from '@/content/reviews'
import { socialProof } from '@/config/social-proof'
import { products } from '@/content/catalog'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

describe('real reviews', () => {
  it('are the 15 the business gave for the products still sold (the 10 for NEUROS Flow are no longer shown), each complete', () => {
    expect(reviews).toHaveLength(15)
    const ids = new Set(products.map((p) => p.id))
    for (const r of reviews) {
      expect(ids.has(r.productId)).toBe(true)
      expect(r.name.length).toBeGreaterThan(2)
      expect(r.quote.length).toBeGreaterThan(20)
      expect([4, 5]).toContain(r.rating)
      expect(r.month).toMatch(/^2026-(0[6-9]|10)$/)
    }
    expect(new Set(reviews.map((r) => r.quote)).size).toBe(15)
  })
  it('each product page and landing gets only its own; NEUROS Focus has none, so no section', () => {
    expect(reviewsFor('balance-wave').map((r) => r.name)).toEqual(['Cristina P.', 'Alexandra B.', 'Gabriel N.', 'Diana V.', 'Ana-Maria I.', 'Florin U.', 'Oana C.', 'Simona D.'])
    expect(reviewsFor('brain-flow' as never)).toEqual([])
    expect(reviewsFor('ochelari-biohack')).toHaveLength(7)
    expect(reviewsFor('brainlink-pro')).toEqual([])
  })
  it('shows the store\'s own figures (500+, 4,9), no review count and no "recenzii reale" label', () => {
    expect(socialProof).toMatchObject({ customers: 500, averageRating: 4.9 })
    const src = read('src/components/reviews/ReviewMarquee.tsx')
    expect(src).not.toMatch(/'Recenzii reale'|'Real reviews'|recenzii`|ratingSummary/)
    expect(src).toContain('const { customers, averageRating } = socialProof')
  })
  it('appear on the homepage, every product page and every landing', () => {
    expect(read('src/app/[lang]/(site)/page.tsx')).toContain('<ReviewMarquee className="pt-[var(--sec)]" />')
    expect(read('src/app/[lang]/(site)/products/[slug]/page.tsx')).toContain('<ReviewMarquee productId={product.id}')
    for (const l of ['Calm', 'Focus', 'Amber']) expect(read(`src/components/landing/pages/${l}Landing.tsx`)).toContain('<Testimonials productId={p.id} />')
    expect(read('src/components/landing/parts.tsx')).toContain('<ReviewMarquee productId={productId} variant="landing"')
  })
  it('eases to a stop on the review under the cursor, pins on tap, drags, and sleeps off screen', () => {
    const src = read('src/components/reviews/ReviewMarquee.tsx')
    expect(src).toContain("onPointerEnter={(e) => e.pointerType === 'mouse' && realHover() && onActivate()}")
    expect(src).toContain('const target = reduced || st.hold || st.drag ? 0 : SPEED')
    expect(src).toContain('if (st.visible && !document.hidden && st.width > 0)')
    expect(src).toContain('setPinned(true)')
    // No inert copy: the duplicated half must stay hoverable, or the lane cannot stop on it.
    expect(src).not.toContain('inert')
  })
})
