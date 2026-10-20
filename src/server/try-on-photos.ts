/**
 * NEUROS Amber try-on photos shared as a link: the JPEG the visitor chose to share, under a random id, nothing else
 * (no IP, no account). Kept 30 days, then deleted the next time a photo is saved.
 */
import 'server-only'
import { randomBytes } from 'node:crypto'

import { getDb } from '@/server/db'

export const MAX_PHOTO_BYTES = 1_500_000
const ID = /^[A-Za-z0-9_-]{16}$/
export const isPhotoId = (v: string) => ID.test(v)

/** A JPEG starts with FF D8 FF; anything else is refused. */
export const isJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff

export async function savePhoto(bytes: Uint8Array): Promise<string> {
  const db = await getDb()
  const id = randomBytes(12).toString('base64url')
  await db.query("delete from try_on_photos where created_at < now() - interval '30 days'")
  await db.query('insert into try_on_photos (id, image) values ($1, $2)', [id, Buffer.from(bytes)])
  return id
}

export async function readPhoto(id: string): Promise<Uint8Array | null> {
  if (!isPhotoId(id)) return null
  const db = await getDb()
  const r = await db.query<{ image: Uint8Array }>("select image from try_on_photos where id = $1 and created_at > now() - interval '30 days'", [id])
  return r.rows[0]?.image ?? null
}
