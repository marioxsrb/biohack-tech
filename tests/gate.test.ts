/** The price gate of acces.<domain>: the pre-paint script, and the markers every price and purchase control needs. */
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
const { GATE_SCRIPT, GATE_CSS, GATE_STYLE_ID } = await import('@/components/gate/Gate')

function runScript(hostname: string, cookie: string) {
  const head: { id: string; textContent: string }[] = []
  const document = {
    cookie,
    head: { appendChild: (el: { id: string; textContent: string }) => head.push(el) },
    createElement: () => ({ id: '', textContent: '' }),
    getElementById: (id: string) => head.find((el) => el.id === id) ?? null,
  }
  new Function('location', 'document', GATE_SCRIPT)({ hostname }, document)
  return head
}

describe('pre-paint gate script', () => {
  it('acces without the gate cookie: one blur style in <head>; with it, or on any other host: nothing', () => {
    expect(runScript('acces.biohack-tech.ro', 'a=1')).toEqual([{ id: GATE_STYLE_ID, textContent: GATE_CSS }])
    expect(runScript('acces.localhost', '')).toHaveLength(1)
    expect(runScript('acces.biohack-tech.ro', 'a=1; bt_gate=6f1c2a1e-1111-4111-8111-111111111111')).toEqual([])
    expect(runScript('biohack-tech.ro', '')).toEqual([])
    expect(runScript('calm.biohack-tech.ro', '')).toEqual([])
    expect(runScript('xacces.biohack-tech.ro', '')).toEqual([])
  })

  it('blurs every price and shows the locked labels; never relies on <html> attributes (React resets them on hydration)', () => {
    expect(GATE_CSS).toMatch(/\[data-price\]\{filter:blur\(7px\)!important/)
    expect(GATE_CSS).toMatch(/\.gate-label-locked\{display:inline!important\}/)
    expect(GATE_SCRIPT).not.toMatch(/setAttribute|dataset/)
  })
})

describe('one mechanism for the whole storefront', () => {
  const src = (f: string) => readFileSync(f, 'utf8')
  it('the shared price component and computed prices are marked for the blur', () => {
    expect(src('src/components/cart/Price.tsx')).toMatch(/<span data-price/)
    for (const f of ['src/components/product/BuyBox.tsx', 'src/components/offers/OfferSheets.tsx', 'src/components/cart/Totals.tsx', 'src/components/cart/LineOffer.tsx'])
      for (const line of src(f).split('\n').filter((l) => /formatLei\(/.test(l) && /<(span|p|dd)/.test(l))) expect(line, f).toMatch(/data-price/)
    expect(src('src/app/globals.css')).toMatch(/\.gate-label-locked \{ display: none; \}/)
  })

  it('every purchase control opens the form while locked', () => {
    for (const f of ['src/components/cart/AddToCartButton.tsx', 'src/components/cart/BuyNowButton.tsx', 'src/components/offers/OfferSheets.tsx', 'src/components/site/Header.tsx']) expect(src(f), f).toMatch(/data-buy/)
    expect(src('src/app/[lang]/layout.tsx')).toMatch(/GATE_SCRIPT[\s\S]*<GateRoot>/)
  })

  it('no separate gated pages remain (both hosts render the same pages)', () => {
    expect(() => readFileSync('src/app/[lang]/(landing)/acces/page.tsx')).toThrow()
  })
})
