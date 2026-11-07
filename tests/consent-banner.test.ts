/** The cookie banner stays under the header on phones and shares one choice across the shop. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/app/globals.css', 'utf8')
const banner = readFileSync('src/components/consent/ConsentManager.tsx', 'utf8')
const assistant = readFileSync('src/components/assistant/Assistant.tsx', 'utf8')

describe('cookie banner layout', () => {
  it('sits under the header below 1024px, at most 140px, and does not lock the page', () => {
    expect(css).toContain('top: calc(var(--header-h, 64px) + 8px)')
    expect(css).toContain('max-height: 140px')
    expect(css).toMatch(/--z-header:\s*100/)
    expect(css).toMatch(/--z-chat:\s*150/)
    expect(css).toMatch(/--z-sticky:\s*200/)
    expect(css).toMatch(/--z-banner:\s*300/)
    expect(css).toMatch(/--z-modal:\s*400/)
    expect(css).toMatch(/--z-toast:\s*500/)
    expect(css).toContain('html:has([data-sticky-bar]:not([inert])) { --buybar-h: calc(64px + env(safe-area-inset-bottom, 0px)); }')
    expect(banner).toContain('className="consent consent-in')
    expect(banner).toContain('Folosim cookie-urile necesare pentru coș și plată.')
    expect(banner).not.toContain('overflow-hidden')
    expect(banner).not.toContain('document.body.style')
  })

  it('keeps the chat bubble above the purchase bar', () => {
    expect(assistant).toContain('max-lg:bottom-[calc(var(--buybar-h,0px)+12px+env(safe-area-inset-bottom,0px))]')
    expect(assistant).toContain('z-[150]')
  })
})
