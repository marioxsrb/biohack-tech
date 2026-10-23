import { describe, expect, it } from 'vitest'
import { PAYMENT_FAILED_EMAILS, PAYMENT_FAILED_STATUS } from '@/config/payment-failed-emails'
import { VARIABLE_FIELD } from '@/server/workflows/ghl-map'

describe('failed payment emails (draft)', () => {
  it('stay drafts; only variables the sub-account has; the house style (no em dash)', () => {
    expect(PAYMENT_FAILED_STATUS).toBe('draft')
    for (const e of PAYMENT_FAILED_EMAILS) {
      const text = [e.subject, e.preheader, e.title, e.body, e.ctaText].join('\n')
      expect(text).not.toMatch(/—/)
      const vars = [...(text + e.ctaUrl).matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).filter((v) => !v.startsWith('contact.'))
      for (const v of vars) expect(VARIABLE_FIELD[v], v).toBeTruthy()
    }
  })
})

describe('post-purchase guides (draft)', () => {
  it('one block per product, each under its name when several; the house style', async () => {
    const { productGuides } = await import('@/server/workflows/variables')
    const one = productGuides(['balance-wave'])
    expect(one.firstSteps).toMatch(/^- Încarcă NEUROS Calm\./)
    const two = productGuides(['balance-wave', 'carte-diana', 'balance-wave'])
    expect(two.firstSteps.split('\n\n')).toHaveLength(2)
    expect(two.usageTips).toContain('NEUROS Calm\n- ')
    for (const t of [two.firstSteps, two.usageTips, productGuides(['brainlink-pro', 'ochelari-biohack']).usageTips]) expect(t).not.toMatch(/—/)
    expect(productGuides(['necunoscut'])).toEqual({ firstSteps: '', usageTips: '' })
  })
})
