/**
 * Runtime configuration, read once from the environment and validated.
 * Every integration is optional in development; in production (APP_ENV=production) the
 * readiness report lists what is missing and payment methods stay off until they work.
 * Nothing here is ever sent to the browser except where explicitly marked public.
 */
import 'server-only'
import { missingCompanyFields } from '@/config/company'
import { ADMIN_PASSWORD_MIN } from '@/lib/admin-auth'
import { cashOnDelivery } from '@/config/payments'

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
  /**
   * When a cash-on-delivery order gets its invoice: when it ships (default, the invoice travels with the
   * parcel), when the courier's settlement is recorded, or never automatically. Never marked as collected.
   */
  codInvoice: 'on_shipment' | 'on_collection' | 'manual'
  autoStorno: boolean
}
export type GhlConfig = { token: string; locationId: string; pipelineId: string; apiBase: string; emailFrom?: string }
export type SmtpConfig = { host: string; port: number; secure: boolean; user: string; password: string }
export type EmailConfig = {
  transport: 'smtp' | 'ghl' | 'file' | 'none'
  /** "Biohack Tech <contact@biohack-tech.ro>": the sender of every email the application sends itself (smtp, file). */
  from: string
  replyTo?: string
  fileDir: string
  smtp: SmtpConfig | null
  /** Where the team's operational notifications go (orders@). Null = no notifications. Needs smtp or file. */
  notifyTo: string | null
  /** The service email the day after delivery (W6 P1). On unless DELIVERY_FOLLOWUP=off. */
  deliveryFollowup: boolean
}

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
  /**
   * Other GoHighLevel sub-accounts that only receive the purchase tags (bt-cumparat-*) on contacts they already
   * have, matched by email (e.g. Brain Event 2026, for the launch emails' "not bought" filter). Never creates.
   */
  ghlTagMirrors: GhlConfig[]
  email: EmailConfig
  admin: { user: string; password: string } | null
  cronSecret?: string
  /** Minutes after which an unpaid card order counts as abandoned. */
  abandonAfterMinutes: number
  /** Days after which an unpaid bank-transfer order is cancelled automatically; null = never (default). */
  transferExpiryDays: number | null
  /**
   * Conversion engine switches, each independent and off unless set to "true":
   *   priceGate          acces.<domain> shows products with the price behind a short form (off: it sends visitors to the main site)
   *   abandonedCheckout  leads from the checkout's contact step, and abandonment marking for every lead
   *   recoveryEmail      recovery emails (still only with marketing consent; off: leads are kept, nothing is sent)
   */
  features: { priceGate: boolean; abandonedCheckout: boolean; recoveryEmail: boolean }
  /** When the first and second recovery emails go out after the last activity (defaults 30 min, 24 h). */
  recovery: { firstMinutes: number; secondHours: number; testRecipients: string[] | null }
  /**
   * AI calling (an ElevenLabs agent calls leads who explicitly agreed to it). Off by default, and in dry run
   * (no real call, everything else recorded) unless AI_CALLING_DRY_RUN=false. Independent of lead capture,
   * recovery emails and checkout.
   */
  calling: CallingConfig
  /** ElevenLabs credentials; null until ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID and ELEVENLABS_PHONE_NUMBER_ID are set. */
  elevenlabs: ElevenLabsConfig | null
}

export type CallingConfig = {
  enabled: boolean
  dryRun: boolean
  provider: 'elevenlabs'
  maxAttempts: number
  /**
   * Minutes of quiet after the lead's last activity before the first call: `cart` = a checkout with a cart
   * (AI_CALL_DELAY_VISIBLE_MINUTES, default 20), `price_reveal` = the price form (AI_CALL_DELAY_GATED_MINUTES, 30).
   */
  delays: { cart: number; price_reveal: number }
  /**
   * Controlled testing (AI_CALLING_TEST_MODE=true): only `testNumbers` can be called, and only they get the short
   * `testDelayMinutes` (2). Test mode without a list calls nobody.
   */
  testMode: boolean
  testDelayMinutes: number
  /**
   * After a first missed attempt, the second comes this many hours later (default 1) if that is inside the calling
   * window (otherwise at the next window); a third, after a second miss, the next day at the same time (or the
   * next window).
   */
  retryHours: number
  /** Allowed local calling window [startHour, endHour) on allowed weekdays (1 = Monday ... 7 = Sunday), in `timezone`. */
  hours: { start: number; end: number }
  days: number[]
  timezone: string
  /** Controlled testing: when set, only these numbers (E.164) can be called. */
  testNumbers: string[] | null
}

export type ElevenLabsConfig = {
  apiKey: string
  agentId: string
  phoneNumberId: string
  /** How the number is connected in ElevenLabs: a Twilio number or a SIP trunk (ELEVENLABS_PHONE_PROVIDER). */
  phoneProvider: 'twilio' | 'sip_trunk'
  webhookSecret: string | null
  /** The shared secret the agent's server tools send (ELEVENLABS_TOOL_SECRET); tools answer 404 without it. */
  toolSecret: string | null
  apiBase: string
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
  // Either name works; NEXT_PUBLIC_ is the conventional one for a browser-visible key.
  const publishableKey = str('STRIPE_PUBLISHABLE_KEY') ?? str('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
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

function readFgo(appEnv: AppEnv, issues: ConfigIssue[], siteUrl: string): FgoConfig | null {
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
  // Reported (it shows in /api/health): a production site invoicing on FGO's test server issues no real invoices.
  if (appEnv === 'production' && env !== 'production') issues.push({ area: 'fgo', level: 'error', message: 'APP_ENV=production, dar FGO_ENV nu este production: facturile se emit pe serverul de test FGO.' })
  return {
    apiBase: str('FGO_API_BASE') ?? (env === 'production' ? 'https://api.fgo.ro/v1' : 'https://api-testuat.fgo.ro/v1'),
    codUnic,
    privateKey,
    serie,
    vatRate,
    unit: str('FGO_UM') ?? 'BUC',
    platformUrl: siteUrl,
    transferInvoice: str('FGO_TRANSFER_INVOICE') === 'manual' ? 'manual' : 'on_payment',
    codInvoice: str('FGO_COD_INVOICE') === 'manual' ? 'manual' : str('FGO_COD_INVOICE') === 'on_collection' ? 'on_collection' : 'on_shipment',
    autoStorno: str('FGO_AUTO_STORNO') === 'true',
  }
}

/** "10-19" → { start: 10, end: 19 }; anything invalid falls back to the default. */
function hourRange(raw: string | undefined, fallback: { start: number; end: number }) {
  const m = raw?.match(/^(\d{1,2})-(\d{1,2})$/)
  const r = m ? { start: Number(m[1]), end: Number(m[2]) } : fallback
  return r.start >= 0 && r.end <= 24 && r.start < r.end ? r : fallback
}

function readCalling(issues: ConfigIssue[], isolated: boolean): { calling: CallingConfig; elevenlabs: ElevenLabsConfig | null } {
  const days = (str('AI_CALLING_DAYS') ?? '1-5').match(/^([1-7])-([1-7])$/)
  const calling: CallingConfig = {
    enabled: flag('AI_CALLING_ENABLED'),
    dryRun: str('AI_CALLING_DRY_RUN') !== 'false',
    provider: 'elevenlabs',
    maxAttempts: Math.min(positiveInt(str('AI_CALLING_MAX_ATTEMPTS')) ?? 3, 3),
    delays: { cart: positiveInt(str('AI_CALL_DELAY_VISIBLE_MINUTES')) ?? 20, price_reveal: positiveInt(str('AI_CALL_DELAY_GATED_MINUTES')) ?? 30 },
    testMode: flag('AI_CALLING_TEST_MODE'),
    testDelayMinutes: Math.min(positiveInt(str('AI_CALLING_TEST_DELAY_MINUTES')) ?? 2, 10),
    retryHours: positiveInt(str('AI_CALLING_RETRY_HOURS')) ?? 1,
    hours: hourRange(str('AI_CALLING_HOURS'), { start: 8, end: 21 }),
    days: days && Number(days[1]) <= Number(days[2]) ? Array.from({ length: Number(days[2]) - Number(days[1]) + 1 }, (_, i) => Number(days[1]) + i) : [1, 2, 3, 4, 5],
    timezone: str('AI_CALLING_TIMEZONE') ?? 'Europe/Bucharest',
    testNumbers: str('AI_CALLING_TEST_NUMBERS')?.split(',').map((n) => n.trim()).filter(Boolean) || null,
  }
  const apiKey = isolated ? undefined : str('ELEVENLABS_API_KEY')
  const agentId = str('ELEVENLABS_AGENT_ID')
  const phoneNumberId = str('ELEVENLABS_PHONE_NUMBER_ID')
  const elevenlabs: ElevenLabsConfig | null =
    apiKey && agentId && phoneNumberId
      ? {
          apiKey,
          agentId,
          phoneNumberId,
          phoneProvider: str('ELEVENLABS_PHONE_PROVIDER') === 'sip_trunk' ? 'sip_trunk' : 'twilio',
          webhookSecret: str('ELEVENLABS_WEBHOOK_SECRET') ?? null,
          toolSecret: str('ELEVENLABS_TOOL_SECRET') ?? null,
          apiBase: (str('ELEVENLABS_API_BASE') ?? 'https://api.elevenlabs.io').replace(/\/$/, ''),
        }
      : null
  if (calling.enabled && calling.testMode && !calling.testNumbers)
    issues.push({ area: 'calling', level: 'warn', message: 'AI_CALLING_TEST_MODE fără AI_CALLING_TEST_NUMBERS: nu se sună nimeni.' })
  if (calling.enabled && !calling.dryRun && !elevenlabs)
    issues.push({ area: 'calling', level: 'warn', message: 'AI_CALLING_ENABLED fără AI_CALLING_DRY_RUN: lipsesc ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID sau ELEVENLABS_PHONE_NUMBER_ID; nu se sună nimeni.' })
  if (calling.enabled && elevenlabs && !elevenlabs.webhookSecret)
    issues.push({ area: 'calling', level: 'warn', message: 'ELEVENLABS_WEBHOOK_SECRET lipsește: rezultatele apelurilor nu pot fi primite.' })
  return { calling, elevenlabs }
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

/** A bare address gets the brand name: "contact@biohack-tech.ro" → "Biohack Tech <contact@biohack-tech.ro>". */
export const senderOf = (v: string | undefined) => (!v ? 'Biohack Tech <contact@biohack-tech.ro>' : v.includes('<') ? v : `Biohack Tech <${v}>`)

/** The application's own mail server account (contact@ on mail.biohack-tech.ro, implicit TLS on 465). */
function readSmtp(issues: ConfigIssue[], needed: boolean): SmtpConfig | null {
  const host = str('SMTP_HOST')
  const user = str('SMTP_USER')
  const password = str('SMTP_PASSWORD')
  if (!host && !user && !password) return null
  if (!host || !user || !password) {
    if (needed) issues.push({ area: 'email', level: 'error', message: 'Sunt necesare SMTP_HOST, SMTP_USER și SMTP_PASSWORD.' })
    return null
  }
  const port = positiveInt(str('SMTP_PORT')) ?? 465
  return { host, port, secure: port === 465, user, password }
}

/** A feature switch: on only when set to "true". */
export const flag = (k: string) => str(k) === 'true'

const positiveInt = (v: string | undefined) => {
  const n = Number(v)
  return v !== undefined && Number.isInteger(n) && n > 0 ? n : null
}

let cached: { config: Config; issues: ConfigIssue[] } | null = null

export function loadConfig(): { config: Config; issues: ConfigIssue[] } {
  if (cached) return cached
  const issues: ConfigIssue[] = []
  const appEnvRaw = str('APP_ENV')
  const appEnv: AppEnv = appEnvRaw === 'production' || appEnvRaw === 'staging' ? appEnvRaw : 'development'
  const siteUrl = (str('NEXT_PUBLIC_SITE_URL') ?? 'http://localhost:3000').replace(/\/$/, '')

  // Isolated test mode (scripts/stripe-test.mjs): its own embedded database, no FGO, no GoHighLevel, emails
  // to files, Stripe test keys only. Never in production. Nothing here can reach a real invoice or CRM.
  const isolated = str('ISOLATED_TEST') === '1' && appEnv !== 'production'
  if (str('ISOLATED_TEST') === '1' && appEnv === 'production') issues.push({ area: 'app', level: 'error', message: 'ISOLATED_TEST nu se folosește în producție; este ignorat.' })

  const databaseUrl = isolated ? undefined : str('DATABASE_URL')
  // Production never falls back to the embedded database: orders must survive a redeploy.
  const localDb = !databaseUrl && appEnv !== 'production'
  if (!databaseUrl && !localDb) issues.push({ area: 'database', level: 'error', message: 'DATABASE_URL lipsește. Fără bază de date nu se pot înregistra comenzi.' })
  if (appEnv === 'production' && siteUrl.startsWith('http://')) issues.push({ area: 'app', level: 'error', message: 'NEXT_PUBLIC_SITE_URL trebuie să fie https în producție.' })

  const transportRaw = isolated ? 'file' : str('EMAIL_TRANSPORT')
  const ghl = isolated ? null : readGhl(issues)
  const mirrorToken = str('GHL_BRAINEVENT_TOKEN')
  const mirrorLocation = str('GHL_BRAINEVENT_LOCATION_ID')
  const ghlTagMirrors: GhlConfig[] =
    !isolated && ghl && mirrorToken && mirrorLocation ? [{ token: mirrorToken, locationId: mirrorLocation, pipelineId: '', apiBase: ghl.apiBase }] : []
  const transport: EmailConfig['transport'] =
    transportRaw === 'smtp' || transportRaw === 'ghl' || transportRaw === 'file' || transportRaw === 'none' ? transportRaw : appEnv === 'development' ? 'file' : 'none'
  const smtp = isolated ? null : readSmtp(issues, transport === 'smtp')
  if (transport === 'smtp' && !smtp) issues.push({ area: 'email', level: 'error', message: 'EMAIL_TRANSPORT=smtp are nevoie de SMTP_HOST, SMTP_USER și SMTP_PASSWORD.' })
  if (transport === 'ghl' && appEnv === 'production')
    issues.push({ area: 'email', level: 'warn', message: 'EMAIL_TRANSPORT=ghl: GoHighLevel trimite emailurile cu expeditorul NEUROS, iar notificările către echipă sunt oprite. Treci pe smtp.' })
  const notifyTo = str('NOTIFY_EMAIL') ?? null
  if (notifyTo && transport !== 'smtp' && transport !== 'file') issues.push({ area: 'email', level: 'warn', message: `NOTIFY_EMAIL este setat, dar notificările către echipă pleacă doar prin smtp (acum: ${transport}).` })
  if (transport === 'ghl' && !ghl) issues.push({ area: 'email', level: 'error', message: 'EMAIL_TRANSPORT=ghl are nevoie de configurarea GoHighLevel.' })
  if (transport === 'none') issues.push({ area: 'email', level: appEnv === 'production' ? 'error' : 'warn', message: 'Emailurile tranzacționale sunt oprite (EMAIL_TRANSPORT).' })
  if (transport === 'file' && appEnv === 'production') issues.push({ area: 'email', level: 'error', message: 'EMAIL_TRANSPORT=file nu trimite emailuri reale.' })

  const adminUser = str('ADMIN_USER')
  const adminPassword = str('ADMIN_PASSWORD')
  if (!adminPassword) issues.push({ area: 'admin', level: appEnv === 'production' ? 'error' : 'warn', message: 'ADMIN_PASSWORD lipsește: pagina /admin este oprită.' })
  else if (adminPassword.length < ADMIN_PASSWORD_MIN)
    issues.push({ area: 'admin', level: 'error', message: `ADMIN_PASSWORD trebuie să aibă cel puțin ${ADMIN_PASSWORD_MIN} caractere.` })

  const missingCompany = missingCompanyFields()
  if (missingCompany.length) {
    issues.push({ area: 'legal', level: appEnv === 'production' ? 'error' : 'warn', message: `Datele de identificare a firmei lipsesc de pe site: ${missingCompany.join(', ')}.` })
  }

  const cronSecret = str('CRON_SECRET')
  if (!cronSecret && appEnv === 'production') issues.push({ area: 'jobs', level: 'warn', message: 'CRON_SECRET lipsește: /api/jobs/run nu poate fi apelat din exterior (rulează doar intern).' })

  const config: Config = {
    appEnv,
    siteUrl,
    databaseUrl,
    localDb,
    stripe: readStripe(appEnv, issues),
    bank: readBank(issues),
    fgo: isolated ? null : readFgo(appEnv, issues, siteUrl),
    ghl,
    ghlTagMirrors,
    email: {
      transport,
      from: senderOf(str('EMAIL_FROM')),
      replyTo: str('EMAIL_REPLY_TO'),
      fileDir: str('EMAIL_FILE_DIR') ?? '.data/emails',
      smtp,
      notifyTo,
      deliveryFollowup: str('DELIVERY_FOLLOWUP') !== 'off',
    },
    admin: adminPassword && adminPassword.length >= ADMIN_PASSWORD_MIN ? { user: adminUser ?? 'admin', password: adminPassword } : null,
    cronSecret,
    abandonAfterMinutes: positiveInt(str('ABANDON_AFTER_MINUTES')) ?? 60,
    transferExpiryDays: positiveInt(str('TRANSFER_EXPIRY_DAYS')),
    features: { priceGate: flag('PRICE_GATE_ENABLED'), abandonedCheckout: flag('ABANDONED_CHECKOUT_ENABLED'), recoveryEmail: flag('RECOVERY_EMAIL_ENABLED') },
    recovery: {
      firstMinutes: positiveInt(str('RECOVERY_FIRST_MINUTES')) ?? 30,
      secondHours: positiveInt(str('RECOVERY_SECOND_HOURS')) ?? 24,
      // Test mode for the activation: when set, recovery emails go only to these addresses (others: as if off).
      testRecipients: str('RECOVERY_TEST_RECIPIENTS')?.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean) || null,
    },
    ...readCalling(issues, isolated),
  }
  cached = { config, issues }
  return cached
}

export const getConfig = () => loadConfig().config

/** Test helper: forget the cached configuration after changing process.env. */
export function resetConfig() {
  cached = null
}

/**
 * Which payment methods can complete an order right now. Cash on delivery needs only the database (the
 * courier collects); it is switched off or limited in config/payments.ts.
 */
export function paymentMethods(c: Config = getConfig()) {
  const db = !!c.databaseUrl || c.localDb
  return { card: db && !!c.stripe, transfer: db && !!c.bank, cod: db && cashOnDelivery.enabled }
}
