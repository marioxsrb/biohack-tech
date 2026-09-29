#!/usr/bin/env node
/**
 * Isolated Stripe TEST environment for trying the whole payment path by hand, including the
 * post-payment offer and bank authentication (3DS/SCA):
 *
 *   npm run stripe:test        → http://localhost:3100
 *
 * What it guarantees (enforced in code by ISOLATED_TEST=1, see src/server/config.ts):
 *   - Stripe TEST keys only. Live keys are refused here and are rejected by the app outside production.
 *   - Its own embedded database in .data/stripe-test/db (not DATABASE_URL).
 *   - No FGO (no invoice), no GoHighLevel (no contact, no CRM, no email through GHL).
 *   - Emails are written as files to .data/stripe-test/emails.
 * Stripe webhooks reach it through `stripe listen` (Stripe CLI), started and stopped with it.
 *
 * Keys: STRIPE_TEST_SECRET_KEY / STRIPE_TEST_PUBLISHABLE_KEY from .env.local if set, otherwise the normal
 * STRIPE_SECRET_KEY / (NEXT_PUBLIC_)STRIPE_PUBLISHABLE_KEY, but only when they are test keys. No key is printed.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const PORT = process.env.TEST_PORT || '3100'
const DIR = '.data/stripe-test'

const env = existsSync('.env.local')
  ? Object.fromEntries(
      readFileSync('.env.local', 'utf8')
        .split('\n')
        .filter((l) => /^[A-Z_0-9]+=/.test(l))
        .map((l) => {
          const i = l.indexOf('=')
          return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
        }),
    )
  : {}

const sk = env.STRIPE_TEST_SECRET_KEY || env.STRIPE_SECRET_KEY || ''
const pk = env.STRIPE_TEST_PUBLISHABLE_KEY || env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || env.STRIPE_PUBLISHABLE_KEY || ''
if (!sk.startsWith('sk_test_') || !pk.startsWith('pk_test_')) {
  console.error('Refuz: pentru mediul de test sunt necesare chei Stripe TEST (sk_test_ și pk_test_).')
  console.error('Pune-le în .env.local ca STRIPE_TEST_SECRET_KEY și STRIPE_TEST_PUBLISHABLE_KEY. Cheile live nu se folosesc aici.')
  process.exit(1)
}
if (spawnSync('stripe', ['version'], { stdio: 'ignore' }).status !== 0) {
  console.error('Lipsește Stripe CLI (https://docs.stripe.com/stripe-cli). Pe macOS: brew install stripe/stripe-cli/stripe')
  process.exit(1)
}

mkdirSync(`${DIR}/emails`, { recursive: true })
const passFile = `${DIR}/admin-password`
if (!existsSync(passFile)) writeFileSync(passFile, randomBytes(12).toString('hex'), { mode: 0o600 })
const adminPassword = readFileSync(passFile, 'utf8').trim()

// The signing secret of this machine's `stripe listen`, handed to the app (never printed).
const whsec = execFileSync('stripe', ['listen', '--api-key', sk, '--print-secret'], { encoding: 'utf8' }).trim()
if (!whsec.startsWith('whsec_')) {
  console.error('Stripe CLI nu a întors un secret de webhook.')
  process.exit(1)
}

const listenLog = createWriteStream(`${DIR}/stripe-listen.log`, { flags: 'a' })
const listener = spawn(
  'stripe',
  ['listen', '--api-key', sk, '--events', 'payment_intent.succeeded,payment_intent.payment_failed,payment_intent.canceled,charge.refunded', '--forward-to', `localhost:${PORT}/api/webhooks/stripe`],
  { stdio: ['ignore', 'pipe', 'pipe'] },
)
listener.stdout.pipe(listenLog)
listener.stderr.pipe(listenLog)

const server = spawn('npx', ['next', 'dev', '-p', PORT], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ISOLATED_TEST: '1',
    APP_ENV: 'development',
    NEXT_DIST_DIR: '.next-stripe-test',
    NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
    LOCAL_DB_DIR: `${DIR}/db`,
    EMAIL_FILE_DIR: `${DIR}/emails`,
    STRIPE_SECRET_KEY: sk,
    STRIPE_PUBLISHABLE_KEY: pk,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: pk,
    STRIPE_WEBHOOK_SECRET: whsec,
    ADMIN_USER: 'test',
    ADMIN_PASSWORD: adminPassword,
  },
})

console.log(`
Mediu izolat Stripe TEST pe http://localhost:${PORT}
  Fără FGO, fără GoHighLevel, bază de date proprie (${DIR}/db), emailuri în ${DIR}/emails.
  Admin: http://localhost:${PORT}/admin  utilizator "test", parola în ${passFile}
  Card de test: 4242 4242 4242 4242 · orice dată viitoare · orice CVC
  3DS/SCA:      4000 0027 6000 3184 (cere autentificare la fiecare plată)
  Refuzat:      4000 0000 0000 9995
  Oprire: Ctrl+C
`)

const stop = () => {
  listener.kill()
  server.kill()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
server.on('exit', (code) => {
  listener.kill()
  process.exit(code ?? 0)
})
