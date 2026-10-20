/**
 * NEUROS Amber try-on photos shared as a link: only a JPEG is accepted, it gets a random id, the link page and the
 * image endpoint serve it, and anything else answers 404. PGlite database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.setConfig({ testTimeout: 30_000 })
vi.mock('@/server/rate-limit', async (orig) => ({ ...(await orig<typeof import('@/server/rate-limit')>()), rateLimit: () => true }))

const { freshDb } = await import('./helpers')
const { POST } = await import('@/app/api/proba/route')
const { GET } = await import('@/app/api/proba/[id]/route')

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9])
const post = (body: Uint8Array) => POST(new Request('https://biohack-tech.ro/api/proba', { method: 'POST', body: new Blob([body as BlobPart]) }) as unknown as NextRequest)

describe('try-on photos shared as a link', () => {
  beforeEach(async () => {
    await freshDb()
  })

  it('saves a JPEG and serves it back under its link', async () => {
    const res = await post(jpeg)
    const json = (await res.json()) as { ok: boolean; url: string }
    expect(json.ok).toBe(true)
    const id = json.url.match(/\/proba\/([A-Za-z0-9_-]{16})$/)?.[1]
    expect(id).toBeTruthy()
    const img = await GET(new Request(`https://biohack-tech.ro/api/proba/${id}`), { params: Promise.resolve({ id: id! }) })
    expect(img.headers.get('content-type')).toBe('image/jpeg')
    expect(new Uint8Array(await img.arrayBuffer())).toEqual(jpeg)
  })

  it('refuses anything that is not a JPEG, and answers 404 for unknown or malformed ids', async () => {
    expect((await post(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).status).toBe(400)
    for (const id of ['AAAAAAAAAAAAAAAA', '../../etc/passwd', "x' or 1=1 --"]) {
      expect((await GET(new Request('https://x/'), { params: Promise.resolve({ id }) })).status).toBe(404)
    }
  })
})
