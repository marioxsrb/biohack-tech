import { vi } from 'vitest'
import { emptyOrder, type OrderForm } from '@/lib/checkout'
import { resolveOrderLines } from '@/lib/orders/resolve'
import { resetConfig } from '@/server/config'
import { migrate, pglite, setDb, type Db } from '@/server/db'

export const TEST_ENV = {
  APP_ENV: 'staging',
  NEXT_PUBLIC_SITE_URL: 'https://test.biohack-tech.ro',
  STRIPE_SECRET_KEY: 'sk_test_x',
  STRIPE_PUBLISHABLE_KEY: 'pk_test_x',
  STRIPE_WEBHOOK_SECRET: 'whsec_test',
  BANK_BENEFICIARY: 'Exemplu SRL',
  BANK_NAME: 'Banca Exemplu',
  BANK_IBAN: 'RO49AAAA1B31007593840000',
  FGO_COD_UNIC: '2864518',
  FGO_PRIVATE_KEY: '1234567890',
  FGO_SERIE: 'BT',
  FGO_VAT_RATE: '21',
  GHL_PRIVATE_TOKEN: 'pit-test',
  GHL_LOCATION_ID: 'loc1',
  GHL_PIPELINE_ID: 'pipe1',
  EMAIL_TRANSPORT: 'ghl',
  ADMIN_PASSWORD: 'a-long-test-password',
}

export async function freshDb(env: Record<string, string> = TEST_ENV): Promise<Db> {
  vi.unstubAllEnvs()
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v)
  resetConfig()
  const db = await pglite()
  await migrate(db)
  setDb(db)
  return db
}

export const person: OrderForm = {
  ...emptyOrder,
  firstName: 'Ana',
  lastName: 'Popescu',
  email: 'ana@exemplu.ro',
  phone: '0722123456',
  address: 'Str. Lalelelor 10',
  city: 'Cluj-Napoca',
  county: 'Cluj',
  postalCode: '400001',
}

export const company: OrderForm = { ...person, buyerType: 'pj', company: 'Exemplu SRL', cui: 'RO14399840', regCom: 'J12/345/2020' }

export function lines(raw: unknown[]) {
  const r = resolveOrderLines(raw)
  if (!r.ok) throw new Error(r.reason)
  return r.lines
}
