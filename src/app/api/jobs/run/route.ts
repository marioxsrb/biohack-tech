import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { getConfig } from '@/server/config'
import { runDueJobs } from '@/server/jobs/runner'

export const runtime = 'nodejs'

/** External trigger for the job queue (cron): Authorization: Bearer $CRON_SECRET. */
export async function POST(req: NextRequest) {
  const secret = getConfig().cronSecret
  const given = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ ran: await runDueJobs(50) })
}
