import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { getConfig } from '@/server/config'
import { runDueJobs } from '@/server/jobs/runner'

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
  return NextResponse.json({ ran: await runDueJobs(50) })
}

export const GET = run
export const POST = run
