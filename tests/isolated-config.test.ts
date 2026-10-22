/** The isolated Stripe TEST mode (npm run stripe:test) can never reach FGO, GoHighLevel or the real database. */
import { afterEach, expect, it, vi } from 'vitest'
import { loadConfig, resetConfig } from '@/server/config'

afterEach(() => {
  vi.unstubAllEnvs()
  resetConfig()
})

const full = () => {
  vi.stubEnv('DATABASE_URL', 'postgres://real@db.example/biohack_ecom')
  vi.stubEnv('FGO_COD_UNIC', '12345678')
  vi.stubEnv('FGO_PRIVATE_KEY', 'k')
  vi.stubEnv('FGO_SERIE', 'X')
  vi.stubEnv('FGO_VAT_RATE', '21')
  vi.stubEnv('GHL_PRIVATE_TOKEN', 't')
  vi.stubEnv('GHL_LOCATION_ID', 'l')
  vi.stubEnv('GHL_PIPELINE_ID', 'p')
  vi.stubEnv('EMAIL_TRANSPORT', 'ghl')
}

it('ISOLATED_TEST=1: own embedded database, no FGO, no GoHighLevel, emails to files', () => {
  full()
  vi.stubEnv('ISOLATED_TEST', '1')
  resetConfig()
  const { config } = loadConfig()
  expect([config.databaseUrl, config.localDb, config.fgo, config.ghl, config.email.transport]).toEqual([undefined, true, null, null, 'file'])
})

it('without it, the same environment keeps its integrations; in production the flag is ignored and reported', () => {
  full()
  resetConfig()
  expect(loadConfig().config.ghl).not.toBeNull()
  vi.stubEnv('ISOLATED_TEST', '1')
  vi.stubEnv('APP_ENV', 'production')
  resetConfig()
  const { config, issues } = loadConfig()
  expect(config.databaseUrl).toBe('postgres://real@db.example/biohack_ecom')
  expect(issues.some((i) => i.message.includes('ISOLATED_TEST'))).toBe(true)
})

it('Preview / staging never connect to the production database (refused and reported); production does', () => {
  const prod = 'postgresql://postgres.whboehkartnchujhewhg:x@aws-1-eu-central-1.pooler.supabase.com:6543/postgres'
  vi.stubEnv('DATABASE_URL', prod)
  vi.stubEnv('APP_ENV', 'staging')
  resetConfig()
  const staging = loadConfig()
  expect(staging.config.databaseUrl).toBeUndefined()
  expect(staging.issues.some((i) => i.area === 'database' && /producție/.test(i.message))).toBe(true)
  vi.stubEnv('APP_ENV', 'production')
  resetConfig()
  expect(loadConfig().config.databaseUrl).toBe(prod)
  vi.stubEnv('APP_ENV', 'staging')
  vi.stubEnv('DATABASE_URL', 'postgresql://postgres.stagingref:x@aws-1-eu-central-1.pooler.supabase.com:6543/postgres')
  resetConfig()
  expect(loadConfig().config.databaseUrl).toContain('stagingref')
})
