import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { runDueJobs } from '@/server/jobs/runner'
import { purgeStaleLeads } from '@/server/leads'
import { purgeRiskSignals } from '@/server/risk'
import { expireVouchers } from '@/server/vouchers'
import { purgeAuthAttempts } from '@/server/auth-attempts'
import { settleRewards } from '@/server/rewards'
import { workflowTick, workflowsMode } from '@/server/workflows/engine'
import { errText, log } from '@/server/log'
import { imapSource, syncInbox } from '@/server/inbox'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * External trigger for the job queue: Authorization: Bearer $CRON_SECRET.
 * GET is what Vercel Cron sends (with that header, from the CRON_SECRET variable); POST stays for
 * any other scheduler. Both run the same batch.
 */
async function run(req: NextRequest) {
  const secret = getConfig().cronSecret
  const given = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const ran = await runDueJobs(50)
  // Leads that never became an order are not kept past the retention period in the privacy policy.
  let purged = 0
  try {
    purged = await purgeStaleLeads(await getDb())
    if (purged) log.info('leads.purged', { count: purged })
    // The fraud check's pseudonymised identifiers, likewise (server/risk.ts, 90 days).
    const cleared = await purgeRiskSignals(await getDb())
    if (cleared) log.info('risk.signals_purged', { count: cleared })
  } catch (e) {
    log.error('leads.purge_failed', { error: errText(e) })
  }
  // Vouchers past their expiry, referrals settled after the return window (both no-ops while none exist), and the
  // workflows' dry run (nothing unless WORKFLOWS_MODE=dry_run; no mode sends anything).
  try {
    const db = await getDb()
    await purgeAuthAttempts(db)
    const expired = await expireVouchers(db)
    if (expired) log.info('vouchers.expired', { count: expired })
    const settled = await db.tx((t) => settleRewards(t))
    if (settled.qualified) log.info('rewards.settled', settled)
    if (workflowsMode() !== 'off') {
      const ticked = await db.tx((t) => workflowTick(t))
      if (ticked.length) log.info('workflows.dry_run', { decisions: ticked.length })
    }
  } catch (e) {
    log.error('workflows.run_failed', { error: errText(e) })
  }
  // Customers' email answers for the admin inbox (IMAP), after the queue: bounded in time, and a mailbox that does
  // not answer is recorded and retried next run, never an error for the rest.
  let inbox: Awaited<ReturnType<typeof syncInbox>> | null = null
  const imap = getConfig().email?.imap ?? null
  if (imap) {
    try {
      inbox = await syncInbox(await getDb(), imapSource(imap), { deadline: Date.now() + 25_000 })
    } catch (e) {
      log.error('inbox.sync_error', { error: errText(e) })
    }
  }
  return NextResponse.json({ ran, purged, inbox: inbox && { imported: inbox.imported, ignored: inbox.ignored, ok: !inbox.error } })
}

export const GET = run
export const POST = run
