/**
 * Runtime configuration, read once from the environment and validated.
 * Every integration is optional in development; in production (APP_ENV=production) the
 * readiness report lists what is missing and payment methods stay off until they work.
 * Nothing here is ever sent to the browser except where explicitly marked public.
 */
import 'server-only'

export type AppEnv = 'development' | 'staging' | 'production'

const str = (k: string) => {
  const v = process.env[k]?.trim()
  return v ? v : undefined
}

export type StripeConfig = { secretKey: string; publishableKey: string; webhookSecret: string; live: boolean; apiBase: string }
export type BankConfig = { beneficiary: string; bank: string; iban: string; swift?: string }
export type FgoConfig = {
  apiBase: string
  codUnic: string
  privateKey: string
  serie: string
  vatRate: number
  unit: string
  platformUrl: string
  /** When a bank-transfer order gets its invoice: on payment (default) or never automatically. */
  transferInvoice: 'on_payment' | 'manual'
  autoStorno: boolean
}
export type GhlConfig = { token: string; locationId: string; pipelineId: string; apiBase: string; emailFrom?: string }
export type EmailConfig = { transport: 'ghl' | 'file' | 'none'; replyTo?: string; fileDir: string }

export type Config = {
  appEnv: AppEnv
  siteUrl: string
  databaseUrl?: string
  /** Embedded PGlite database under .data/ (development and QA only). */
  localDb: boolean
  stripe: StripeConfig | null
  bank: BankConfig | null
  fgo: FgoConfig | null
  ghl: GhlConfig | null
  email: EmailConfig
  admin: { user: string; password: string } | null
  cronSecret?: string
  /** Minutes after which an unpaid card order counts as abandoned. */
  abandonAfterMinutes: number
}

/** ISO 13616 mod-97 check, so a mistyped IBAN is caught before a customer sees it. */
export function isValidIban(raw: string): boolean {
  const iban = raw.replace(/\s/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false
  if (iban.startsWith('RO') && iban.length !== 24) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55))
  let rem = 0
  for (const ch of numeric) rem = (rem * 10 + Number(ch)) % 97
  return rem === 1
}

export const formatIban = (iban: string) => iban.replace(/\s/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim()

export type ConfigIssue = { area: string; level: 'error' | 'warn'; message: string }

function readStripe(appEnv: AppEnv, issues: ConfigIssue[]): StripeConfig | null {
  const secretKey = str('STRIPE_SECRET_KEY')
  const publishableKey = str('STRIPE_PUBLISHABLE_KEY')
  const webhookSecret = str('STRIPE_WEBHOOK_SECRET')
  if (!secretKey && !publishableKey && !webhookSecret) {
    issues.push({ area: 'stripe', level: 'warn', message: 'Stripe nu este configurat: plata cu cardul este oprită.' })
    return null
  }
  if (!secretKey || !/^(sk|rk)_(test|live)_/.test(secretKey)) issues.push({ area: 'stripe', level: 'error', message: 'STRIPE_SECRET_KEY lipsește sau nu are formatul sk_live_/sk_test_.' })
  if (!publishableKey || !/^pk_(test|live)_/.test(publishableKey)) issues.push({ area: 'stripe', level: 'error', message: 'STRIPE_PUBLISHABLE_KEY lipsește sau nu are formatul pk_live_/pk_test_.' })
  if (!webhookSecret || !webhookSecret.startsWith('whsec_')) issues.push({ area: 'stripe', level: 'error', message: 'STRIPE_WEBHOOK_SECRET lipsește (whsec_...). Fără el, plățile nu pot fi confirmate.' })
  if (!secretKey || !publishableKey || !webhookSecret || issues.some((i) => i.area === 'stripe' && i.level === 'error')) return null
  const live = secretKey.includes('_live_')
  if (live !== publishableKey.startsWith('pk_live_')) {
    issues.push({ area: 'stripe', level: 'error', message: 'Cheile Stripe amestecă modul test cu modul live.' })
    return null
  }
  if (appEnv === 'production' && !live) {
    issues.push({ area: 'stripe', level: 'error', message: 'APP_ENV=production folosește chei Stripe de test. Plata cu cardul este oprită.' })
    return null
  }
  if (appEnv !== 'production' && live) {
    issues.push({ area: 'stripe', level: 'error', message: `APP_ENV=${appEnv} folosește chei Stripe live. Plata cu cardul este oprită.` })
    return null
  }
  const apiBase = (live ? undefined : str('STRIPE_API_BASE')) ?? 'https://api.stripe.com'
  return { secretKey, publishableKey, webhookSecret, live, apiBase }
}

function readBank(issues: ConfigIssue[]): BankConfig | null {
  const iban = str('BANK_IBAN')
  const bank = str('BANK_NAME')
  const beneficiary = str('BANK_BENEFICIARY')
  if (!iban && !bank && !beneficiary) {
    issues.push({ area: 'bank', level: 'warn', message: 'Datele bancare lipsesc: transferul bancar este oprit.' })
    return null
  }
  if (!iban || !bank || !beneficiary) {
    issues.push({ area: 'bank', level: 'error', message: 'Sunt necesare BANK_BENEFICIARY, BANK_NAME și BANK_IBAN.' })
    return null
  }
  if (!isValidIban(iban)) {
    issues.push({ area: 'bank', level: 'error', message: 'BANK_IBAN nu este un IBAN valid. Transferul bancar este oprit.' })
    return null
  }
  return { iban: formatIban(iban), bank, beneficiary, swift: str('BANK_SWIFT') }
}

function readFgo(issues: ConfigIssue[], siteUrl: string): FgoConfig | null {
  const codUnic = str('FGO_COD_UNIC')
  const privateKey = str('FGO_PRIVATE_KEY')
  const serie = str('FGO_SERIE')
  const vat = str('FGO_VAT_RATE')
  if (!codUnic && !privateKey && !serie) {
    issues.push({ area: 'fgo', level: 'warn', message: 'FGO nu este configurat: facturile nu se emit automat.' })
    return null
  }
  const vatRate = vat === undefined ? NaN : Number(vat)
  if (!codUnic || !privateKey || !serie || !Number.isFinite(vatRate)) {
    issues.push({ area: 'fgo', level: 'error', message: 'Sunt necesare FGO_COD_UNIC, FGO_PRIVATE_KEY, FGO_SERIE și FGO_VAT_RATE.' })
    return null
  }
  const env = str('FGO_ENV') === 'production' ? 'production' : 'test'
  return {
    apiBase: str('FGO_API_BASE') ?? (env === 'production' ? 'https://api.fgo.ro/v1' : 'https://api-testuat.fgo.ro/v1'),
    codUnic,
    privateKey,
    serie,
    vatRate,
    unit: str('FGO_UM') ?? 'BUC',
    platformUrl: siteUrl,
    transferInvoice: str('FGO_TRANSFER_INVOICE') === 'manual' ? 'manual' : 'on_payment',
    autoStorno: str('FGO_AUTO_STORNO') === 'true',
  }
}

function readGhl(issues: ConfigIssue[]): GhlConfig | null {
  const token = str('GHL_PRIVATE_TOKEN')
  const locationId = str('GHL_LOCATION_ID')
  const pipelineId = str('GHL_PIPELINE_ID')
  if (!token && !locationId && !pipelineId) {
    issues.push({ area: 'ghl', level: 'warn', message: 'GoHighLevel nu este configurat: CRM-ul și emailurile prin GHL sunt oprite.' })
    return null
  }
  if (!token || !locationId || !pipelineId) {
    issues.push({ area: 'ghl', level: 'error', message: 'Sunt necesare GHL_PRIVATE_TOKEN, GHL_LOCATION_ID și GHL_PIPELINE_ID.' })
    return null
  }
  return { token, locationId, pipelineId, apiBase: str('GHL_API_BASE') ?? 'https://services.leadconnectorhq.com', emailFrom: str('EMAIL_FROM') }
}

let cached: { config: Config; issues: ConfigIssue[] } | null = null

export function loadConfig(): { config: Config; issues: ConfigIssue[] } {
  if (cached) return cached
  const issues: ConfigIssue[] = []
  const appEnvRaw = str('APP_ENV')
  const appEnv: AppEnv = appEnvRaw === 'production' || appEnvRaw === 'staging' ? appEnvRaw : 'development'
  const siteUrl = (str('NEXT_PUBLIC_SITE_URL') ?? 'http://localhost:3000').replace(/\/$/, '')

  const databaseUrl = str('DATABASE_URL')
  // Production never falls back to the embedded database: orders must survive a redeploy.
  const localDb = !databaseUrl && appEnv !== 'production'
  if (!databaseUrl && !localDb) issues.push({ area: 'database', level: 'error', message: 'DATABASE_URL lipsește. Fără bază de date nu se pot înregistra comenzi.' })
  if (appEnv === 'production' && siteUrl.startsWith('http://')) issues.push({ area: 'app', level: 'error', message: 'NEXT_PUBLIC_SITE_URL trebuie să fie https în producție.' })

  const transportRaw = str('EMAIL_TRANSPORT')
  const ghl = readGhl(issues)
  const transport: EmailConfig['transport'] = transportRaw === 'ghl' || transportRaw === 'file' || transportRaw === 'none' ? transportRaw : appEnv === 'development' ? 'file' : 'none'
  if (transport === 'ghl' && !ghl) issues.push({ area: 'email', level: 'error', message: 'EMAIL_TRANSPORT=ghl are nevoie de configurarea GoHighLevel.' })
  if (transport === 'none') issues.push({ area: 'email', level: appEnv === 'production' ? 'error' : 'warn', message: 'Emailurile tranzacționale sunt oprite (EMAIL_TRANSPORT).' })
  if (transport === 'file' && appEnv === 'production') issues.push({ area: 'email', level: 'error', message: 'EMAIL_TRANSPORT=file nu trimite emailuri reale.' })

  const adminUser = str('ADMIN_USER')
  const adminPassword = str('ADMIN_PASSWORD')
  if (!adminPassword) issues.push({ area: 'admin', level: appEnv === 'production' ? 'error' : 'warn', message: 'ADMIN_PASSWORD lipsește: pagina /admin este oprită.' })
  else if (adminPassword.length < 12) issues.push({ area: 'admin', level: 'error', message: 'ADMIN_PASSWORD trebuie să aibă cel puțin 12 caractere.' })

  const cronSecret = str('CRON_SECRET')
  if (!cronSecret && appEnv === 'production') issues.push({ area: 'jobs', level: 'warn', message: 'CRON_SECRET lipsește: /api/jobs/run nu poate fi apelat din exterior (rulează doar intern).' })

  const config: Config = {
    appEnv,
    siteUrl,
    databaseUrl,
    localDb,
    stripe: readStripe(appEnv, issues),
    bank: readBank(issues),
    fgo: readFgo(issues, siteUrl),
    ghl,
    email: { transport, replyTo: str('EMAIL_REPLY_TO'), fileDir: str('EMAIL_FILE_DIR') ?? '.data/emails' },
    admin: adminPassword && adminPassword.length >= 12 ? { user: adminUser ?? 'admin', password: adminPassword } : null,
    cronSecret,
    abandonAfterMinutes: Number(str('ABANDON_AFTER_MINUTES') ?? 60) || 60,
  }
  cached = { config, issues }
  return cached
}

export const getConfig = () => loadConfig().config

/** Test helper: forget the cached configuration after changing process.env. */
export function resetConfig() {
  cached = null
}

/** Which payment methods can complete an order right now. */
export function paymentMethods(c: Config = getConfig()) {
  const db = !!c.databaseUrl || c.localDb
  return { card: db && !!c.stripe, transfer: db && !!c.bank }
}
