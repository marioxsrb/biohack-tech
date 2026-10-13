/**
 * Real delivery check for the SMTP transport, run by hand only:
 *   SMTP_LIVE=1 SMTP_USER=contact@biohack-tech.ro SMTP_PASSWORD=… npx vitest run tests/manual/smtp-live.test.ts
 * A synthetic bank-transfer order (customer "BHT-WF-TEST", address SMTP_LIVE_TO, default marioxsrb@gmail.com) goes
 * through the real outbox on an embedded database, with no FGO, GoHighLevel or Stripe. It sends 6 real emails:
 * to the customer address the transfer details, the 2-day reminder and the payment confirmation; to NOTIFY_EMAIL
 * the new order, the 5-day overdue note and the confirmed transfer. Nothing touches the production database.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/server', () => ({ after: (fn: () => unknown) => void fn() }))

const live = process.env.SMTP_LIVE === '1'

describe.skipIf(!live)('SMTP live delivery (manual)', () => {
  it('sends the transfer lifecycle and the team notes through mail.biohack-tech.ro', async () => {
    const { freshDb, person, lines } = await import('../server/helpers')
    const env = {
      APP_ENV: 'staging',
      NEXT_PUBLIC_SITE_URL: 'https://biohack-tech.ro',
      BANK_BENEFICIARY: process.env.BANK_BENEFICIARY ?? 'Exemplu SRL',
      BANK_NAME: process.env.BANK_NAME ?? 'Banca Exemplu',
      BANK_IBAN: process.env.BANK_IBAN ?? 'RO49AAAA1B31007593840000',
      EMAIL_TRANSPORT: 'smtp',
      EMAIL_FROM: 'Biohack Tech <contact@biohack-tech.ro>',
      SMTP_HOST: process.env.SMTP_HOST ?? 'mail.biohack-tech.ro',
      SMTP_PORT: process.env.SMTP_PORT ?? '465',
      SMTP_USER: process.env.SMTP_USER ?? '',
      SMTP_PASSWORD: process.env.SMTP_PASSWORD ?? '',
      NOTIFY_EMAIL: process.env.NOTIFY_EMAIL ?? 'orders@biohack-tech.ro',
      ADMIN_PASSWORD: 'a-long-test-password',
    }
    const db = await freshDb(env)
    const svc = await import('@/server/orders/service')
    const { jobs } = await import('@/server/jobs/outbox')
    const { runDueJobs } = await import('@/server/jobs/runner')
    const to = process.env.SMTP_LIVE_TO ?? 'marioxsrb@gmail.com'
    const { order } = await svc.placeOrder({
      lines: lines([{ productId: 'brainlink-pro', quantity: 1 }]),
      form: { ...person, firstName: 'BHT-WF-TEST', lastName: 'Test', email: to, paymentMethod: 'transfer' },
      attemptId: `smtp-live-${Date.now()}`,
    })
    await runDueJobs()
    await db.query("update jobs set run_at = now() where status = 'pending'")
    await runDueJobs()
    await svc.confirmPayment(order.id, 'admin')
    await runDueJobs()
    await runDueJobs()
    const list = await jobs.forOrder(db, order.id)
    const report = list.filter((j) => j.kind === 'email.send' || j.kind === 'notify.send').map((j) => `${j.dedupeKey.split(':').slice(0, 2).join(':')} = ${j.status} ${j.lastError ?? ''}`)
    console.log(`order ${order.orderNumber}\n${report.join('\n')}`)
    // Still waiting by design: the 2-day preparation note after the payment.
    expect(list.filter((j) => (j.kind === 'email.send' || j.kind === 'notify.send') && j.status !== 'pending').every((j) => j.status === 'done' || j.status === 'skipped')).toBe(true)
    expect(list.filter((j) => j.status === 'done' && (j.kind === 'email.send' || j.kind === 'notify.send'))).toHaveLength(6)
  }, 120_000)
})
