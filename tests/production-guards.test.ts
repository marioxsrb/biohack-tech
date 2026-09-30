/** Launch guards: Stripe live keys only in production (and only there), FGO test/production separation. */
import { afterEach, expect, it, vi } from 'vitest'
import { loadConfig, resetConfig } from '@/server/config'

afterEach(() => {
  vi.unstubAllEnvs()
  resetConfig()
})

const stripeKeys = (mode: 'test' | 'live') => {
  vi.stubEnv('STRIPE_SECRET_KEY', `sk_${mode}_x`)
  vi.stubEnv('STRIPE_PUBLISHABLE_KEY', `pk_${mode}_x`)
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_x')
}
const load = (appEnv: string) => {
  vi.stubEnv('APP_ENV', appEnv)
  resetConfig()
  return loadConfig()
}

it('Stripe: live keys work only with APP_ENV=production; test keys never in production; mixed keys never', () => {
  stripeKeys('live')
  expect(load('production').config.stripe?.live).toBe(true)
  expect(load('staging').config.stripe).toBeNull()
  expect(load('development').config.stripe).toBeNull()
  stripeKeys('test')
  expect(load('production').config.stripe).toBeNull()
  expect(load('development').config.stripe?.live).toBe(false)
  vi.stubEnv('STRIPE_PUBLISHABLE_KEY', 'pk_live_x')
  expect(load('production').config.stripe).toBeNull()
})

it('FGO: the test server unless FGO_ENV=production; production on the test server is reported', () => {
  for (const [k, v] of [['FGO_COD_UNIC', '12345678'], ['FGO_PRIVATE_KEY', 'k'], ['FGO_SERIE', 'X'], ['FGO_VAT_RATE', '21']]) vi.stubEnv(k, v)
  expect(load('development').config.fgo?.apiBase).toBe('https://api-testuat.fgo.ro/v1')
  const prodOnTest = load('production')
  expect(prodOnTest.issues.some((i) => i.area === 'fgo' && i.level === 'error')).toBe(true)
  vi.stubEnv('FGO_ENV', 'production')
  const prod = load('production')
  expect(prod.config.fgo?.apiBase).toBe('https://api.fgo.ro/v1')
  expect(prod.issues.some((i) => i.area === 'fgo')).toBe(false)
})
