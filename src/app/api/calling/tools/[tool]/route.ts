import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { runCallTool, TOOL_SECRET_HEADER } from '@/server/calling/tools'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { kickJobs } from '@/server/jobs/runner'
import { errText, log } from '@/server/log'
import { rateLimit } from '@/server/rate-limit'

export const runtime = 'nodejs'

const same = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/**
 * The agent's server tools (server/calling/tools.ts). Without ELEVENLABS_TOOL_SECRET configured the route does
 * not exist (404); a wrong or missing secret is 401. Answers only about a call in progress.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ tool: string }> }) {
  const c = getConfig()
  const secret = c.elevenlabs?.toolSecret
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 404 })
  if (!same(req.headers.get(TOOL_SECRET_HEADER) ?? '', secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!rateLimit('call-tools', 300, 60_000)) return NextResponse.json({ error: 'rate limit' }, { status: 429 })
  const { tool } = await ctx.params
  const raw = await req.text()
  if (raw.length > 4_000) return NextResponse.json({ error: 'too large' }, { status: 413 })
  let body: Record<string, unknown>
  try {
    body = raw ? JSON.parse(raw) : {}
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }
  try {
    const db = await getDb()
    const r = await db.tx((t) => runCallTool(t, c, tool, body))
    if (r.status === 200) kickJobs()
    log.info('call.tool', { tool, status: r.status })
    return NextResponse.json(r.body, { status: r.status })
  } catch (e) {
    log.error('call.tool_failed', { tool, error: errText(e) })
    return NextResponse.json({ error: 'server' }, { status: 500 })
  }
}
