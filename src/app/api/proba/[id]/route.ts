import { readPhoto } from '@/server/try-on-photos'

export const runtime = 'nodejs'

/** The shared try-on photo itself (the link page and the link previews in WhatsApp, Facebook, ... show it). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const image = await readPhoto(id).catch(() => null)
  if (!image) return new Response('Not found', { status: 404 })
  return new Response(Buffer.from(image), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400', 'X-Robots-Tag': 'noindex' },
  })
}
