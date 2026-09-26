/**
 * Delivers rendered emails. `ghl`: through the contact's GoHighLevel conversation.
 * `file`: writes .html/.txt under EMAIL_FILE_DIR for local QA. `none`: off.
 */
import 'server-only'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Config } from '@/server/config'
import { ghl } from '@/server/integrations/ghl'

export async function deliver(c: Config, e: { subject: string; html: string; text: string; name: string; ghlContactId: string | null }) {
  if (c.email.transport === 'file') {
    await mkdir(c.email.fileDir, { recursive: true })
    const base = path.join(c.email.fileDir, e.name)
    await writeFile(`${base}.html`, e.html)
    await writeFile(`${base}.txt`, `Subject: ${e.subject}\n\n${e.text}`)
    return `file:${base}`
  }
  if (c.email.transport === 'ghl') {
    if (!c.ghl) throw new Error('GHL is not configured')
    if (!e.ghlContactId) throw new Error('contact not synced to GHL yet')
    return `ghl:${await ghl.sendEmail(c.ghl, e.ghlContactId, e)}`
  }
  return 'none'
}
