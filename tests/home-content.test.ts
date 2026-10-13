/**
 * Homepage and FAQ content in both languages. Regression (13 Oct 2026): removing a NEUROS Flow question shifted
 * an index-based reuse of a homepage question and /en/intrebari-frecvente crashed on an undefined item.
 */
import { describe, expect, it } from 'vitest'
import { homeContent } from '@/content/home'

describe('homepage and FAQ content', () => {
  for (const locale of ['ro', 'en'] as const) {
    it(`${locale}: every question exists, has an answer, and none mentions a discontinued product`, () => {
      const c = homeContent[locale]
      const all = [...c.homeFaq, ...c.faq.flatMap((g) => g.items)]
      for (const f of all) {
        expect(f).toBeDefined()
        expect(f.q.length).toBeGreaterThan(5)
        expect(f.a.length).toBeGreaterThan(10)
      }
      const text = JSON.stringify(c)
      expect(text).not.toMatch(/NEUROS Flow|Brain Flow|brain-flow|infraro[sș]ie acas/i)
      // The quantity discount is per product in both languages, never "mix them as you like".
      expect(text).not.toMatch(/Mix them as you like|You can mix products/i)
    })
  }
})
