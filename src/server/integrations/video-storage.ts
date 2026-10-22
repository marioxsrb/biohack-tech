/**
 * Where the Review Video files go (infrastructure, 21.10.2026). A video is far larger than a function's request body
 * (4,5 MB on Vercel), so the browser uploads it straight to the storage, with a signed upload URL made here for one
 * path only. Supabase Storage (the project's database host), private bucket:
 *   VIDEO_STORAGE_URL     https://<project>.supabase.co
 *   VIDEO_STORAGE_KEY     a service key (server only, never sent to the browser)
 *   VIDEO_STORAGE_BUCKET  e.g. review-videos (private)
 * Without them uploads are off ('none'); nothing else changes. Videos are never public: the team watches them through
 * a short signed download link, and a video is used in advertising only with its own consent (server/rewards.ts).
 */
import 'server-only'

export type VideoStorage = {
  kind: 'supabase' | 'none'
  /** A one-path upload URL, valid a short time. */
  uploadUrl(path: string): Promise<{ url: string } | null>
  /** A short download link for the team. */
  downloadUrl(path: string, seconds?: number): Promise<string | null>
  /** Deletes a file (a replaced or withdrawn video). True when the storage confirmed it. */
  remove(path: string): Promise<boolean>
}

export const MAX_VIDEO_BYTES = 300 * 1024 * 1024
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const
export const isVideoType = (t: unknown): t is (typeof VIDEO_TYPES)[number] => typeof t === 'string' && (VIDEO_TYPES as readonly string[]).includes(t)

export function videoStorage(env: Record<string, string | undefined> = process.env): VideoStorage {
  const base = env.VIDEO_STORAGE_URL?.replace(/\/+$/, '')
  const key = env.VIDEO_STORAGE_KEY
  const bucket = env.VIDEO_STORAGE_BUCKET
  if (!base || !key || !bucket || !/^https:\/\//.test(base)) return { kind: 'none', uploadUrl: async () => null, downloadUrl: async () => null, remove: async () => false }
  const call = async (path: string, body: unknown) => {
    const res = await fetch(`${base}/storage/v1${path}`, { method: 'POST', headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) throw new Error(`video storage ${res.status}`)
    return (await res.json()) as Record<string, string>
  }
  const safe = (p: string) => p.split('/').map(encodeURIComponent).join('/')
  return {
    kind: 'supabase',
    async uploadUrl(path) {
      const r = await call(`/object/upload/sign/${bucket}/${safe(path)}`, {})
      return r.url ? { url: `${base}/storage/v1${r.url}` } : null
    },
    async remove(path) {
      const res = await fetch(`${base}/storage/v1/object/${bucket}`, { method: 'DELETE', headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: [path] }) })
      return res.ok
    },
    async downloadUrl(path, seconds = 600) {
      const r = await call(`/object/sign/${bucket}/${safe(path)}`, { expiresIn: seconds })
      return r.signedURL ? `${base}/storage/v1${r.signedURL}` : null
    },
  }
}
