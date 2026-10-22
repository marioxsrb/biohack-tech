import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE, checkAdminRequest } from '@/lib/admin-auth'
import { getDb } from '@/server/db'
import { videoStorage } from '@/server/integrations/video-storage'
import { audit } from '@/server/store-settings'

export const runtime = 'nodejs'

/** A review video for the team: admin only, a signed link valid 10 minutes, every viewing in the admin audit. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if ((await checkAdminRequest(req.cookies.get(ADMIN_COOKIE)?.value, req.headers.get('authorization'))) !== 'ok') return new NextResponse('Unauthorized', { status: 401 })
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('Not found', { status: 404 })
  const db = await getDb()
  const { rows } = await db.query<{ storage_key: string | null }>('select storage_key from video_reviews where id = $1', [id])
  const key = rows[0]?.storage_key
  if (!key) return new NextResponse('Not found', { status: 404 })
  const url = await videoStorage().downloadUrl(key, 600)
  if (!url) return new NextResponse('Video storage not configured', { status: 503 })
  await audit(db, 'admin', 'video_review.viewed', { id })
  const res = NextResponse.redirect(url, 303)
  res.headers.set('Cache-Control', 'no-store')
  return res
}
