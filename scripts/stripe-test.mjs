#!/usr/bin/env node
/**
 * Isolated Stripe TEST environment for buying like a customer, including the post-payment offer and
 * bank authentication (3DS/SCA):
 *
 *   npm run stripe:test            → http://localhost:3100
 *   npm run stripe:test -- --fresh → same, with an empty database
 *
 * Guaranteed (enforced in code by ISOLATED_TEST=1, see src/server/config.ts; ignored in production):
 *   - Stripe TEST keys only. Live keys are refused here and rejected by the app outside production.
 *   - Its own embedded database in .data/stripe-test/db (never DATABASE_URL), migrated automatically.
 *   - No FGO (no invoice), no GoHighLevel (no contact, CRM or GHL email). Emails are files in .data/stripe-test/emails.
 *
 * It starts `stripe listen` and waits until it is connected, starts the app, and waits until the app
 * reports card payments ready and the checkout serves a TEST publishable key. If anything is missing it
 * stops with a clear message instead of opening a storefront whose checkout would fail later.
 * No key or secret is ever printed.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'

const PORT = Number(process.env.TEST_PORT || 3100)
const DIR = '.data/stripe-test'
const BASE = `http://localhost:${PORT}`
const fresh = process.argv.includes('--fresh')

const die = (msg) => {
  console.error(`\n✗ ${msg}\n`)
  stop()
  process.exit(1)
}
const ok = (msg) => console.log(`✓ ${msg}`)

// 1. Keys: TEST only.
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
const mode = (k, t, l) => (k.startsWith(t) ? 'TEST' : k.startsWith(l) ? 'LIVE' : 'lipsă')
console.log(`Cheie publică Stripe: ${pk ? 'DA' : 'NU'} (${mode(pk, 'pk_test_', 'pk_live_')}) · cheie secretă: ${sk ? 'DA' : 'NU'} (${mode(sk, 'sk_test_', 'sk_live_')})`)
let listener = null
let server = null
function stop() {
  listener?.kill()
  server?.kill()
}
if (!sk.startsWith('sk_test_') || !pk.startsWith('pk_test_')) {
  die('Mediul de test pornește doar cu chei Stripe TEST (sk_test_ și pk_test_). Pune-le în .env.local ca STRIPE_TEST_SECRET_KEY și STRIPE_TEST_PUBLISHABLE_KEY.')
}

// 2. Port free.
await new Promise((resolve) => {
  const s = net.createServer().once('error', () => die(`Portul ${PORT} este ocupat (probabil un mediu de test pornit deja). Oprește-l: lsof -ti tcp:${PORT} | xargs kill`))
  s.listen(PORT, () => s.close(resolve))
})

// 3. Stripe CLI and its webhook signing secret.
if (spawnSync('stripe', ['version'], { stdio: 'ignore' }).status !== 0) die('Lipsește Stripe CLI. Pe macOS: brew install stripe/stripe-cli/stripe')
let whsec = ''
try {
  whsec = execFileSync('stripe', ['listen', '--api-key', sk, '--print-secret'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
} catch {}
if (!whsec.startsWith('whsec_')) die('Stripe CLI nu a putut obține secretul de webhook cu cheia TEST. Verifică accesul la internet și cheia TEST.')
ok('Secret webhook Stripe CLI: DA')

// 4. Database and files.
if (fresh && existsSync(`${DIR}/db`)) rmSync(`${DIR}/db`, { recursive: true, force: true })
mkdirSync(`${DIR}/emails`, { recursive: true })
const passFile = `${DIR}/admin-password`
if (!existsSync(passFile)) writeFileSync(passFile, randomBytes(12).toString('hex'), { mode: 0o600 })
const adminPassword = readFileSync(passFile, 'utf8').trim()

// 5. Webhook forwarding, and wait until it is connected.
listener = spawn(
  'stripe',
  ['listen', '--api-key', sk, '--events', 'payment_intent.succeeded,payment_intent.payment_failed,payment_intent.canceled,charge.refunded', '--forward-to', `localhost:${PORT}/api/webhooks/stripe`],
  { stdio: ['ignore', 'pipe', 'pipe'] },
)
const connected = await new Promise((resolve) => {
  let out = ''
  const on = (d) => {
    out += d
    // Stripe CLI prints "Ready!" once the forwarding session is established.
    if (/Ready!/.test(out)) resolve(true)
  }
  listener.stdout.on('data', on)
  listener.stderr.on('data', on)
  listener.on('exit', () => resolve(false))
  setTimeout(() => resolve(false), 30_000)
})
if (!connected) die('Stripe CLI nu s-a putut conecta pentru redirecționarea webhook-urilor (stripe listen).')
ok('Stripe CLI conectat, webhook-uri → /api/webhooks/stripe')
listener.stdout.on('data', (d) => process.stdout.write(`[stripe] ${String(d).replace(/whsec_\w+/g, 'whsec_***')}`))

// 6. The app, isolated.
server = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
  stdio: ['ignore', 'inherit', 'inherit'],
  env: {
    ...process.env,
    ISOLATED_TEST: '1',
    APP_ENV: 'development',
    NEXT_DIST_DIR: '.next-stripe-test',
    NEXT_PUBLIC_SITE_URL: BASE,
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
server.on('exit', (code) => {
  listener?.kill()
  process.exit(code ?? 0)
})
process.on('SIGINT', () => {
  stop()
  process.exit(0)
})
process.on('SIGTERM', () => {
  stop()
  process.exit(0)
})

// 7. Ready only when orders can be paid by card: database migrated, Stripe configured, checkout serving a TEST key.
let health = null
for (let i = 0; i < 120 && !health?.payments?.card; i++) {
  await new Promise((r) => setTimeout(r, 1000))
  health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch(() => null)
}
if (!health?.database) die('Baza de date izolată nu a pornit (vezi erorile de mai sus).')
// The integrations are shown only to a signed-in admin (the health check is minimal for visitors): sign in as this
// environment's own test admin and read them again.
const login = await fetch(`${BASE}/api/admin/login`, { method: 'POST', body: new URLSearchParams({ user: 'test', password: adminPassword }), redirect: 'manual' })
const adminCookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
health = await fetch(`${BASE}/api/health`, { headers: { cookie: adminCookie } }).then((r) => r.json()).catch(() => null)
if (!health?.integrations) die('Nu am putut citi starea integrărilor ca admin de test.')
if (!health.payments.card) die(`Plata cu cardul nu este disponibilă în mediul de test (probleme: ${health.errors.join(', ') || 'necunoscute'}).`)
if (health.integrations.fgo || health.integrations.ghl || health.integrations.email !== 'file') die('Izolarea nu este activă (FGO/GHL pornite). Oprește și raportează.')
const checkoutHtml = await fetch(`${BASE}/checkout`).then((r) => r.text())
// What the browser receives: the checkout page carries the publishable key for Stripe Elements.
if (checkoutHtml.includes('pk_live_')) die('Checkout-ul ar primi o cheie publică LIVE. Oprit.')
if (!checkoutHtml.includes(pk)) die('Checkout-ul nu primește cheia publică TEST a acestui mediu.')
ok('Browserul primește cheia publică: TEST (aceeași cont ca cheia secretă)')
ok('Bază de date izolată: DA (migrată) · Card: DA · FGO: oprit · GHL: oprit · emailuri: fișiere')

console.log(`
Mediu izolat Stripe TEST gata: ${BASE}
  Admin: ${BASE}/admin  utilizator "test", parola în ${passFile}
  Card de test: 4242 4242 4242 4242 · orice dată viitoare (ex. 12/34) · orice CVC (ex. 123)
  3DS/SCA:      4000 0027 6000 3184 (cere autentificare la fiecare plată)
  Refuzat:      4000 0000 0000 9995
  Oprire: Ctrl+C
`)
