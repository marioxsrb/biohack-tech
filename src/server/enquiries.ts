/**
 * Contact-form enquiries. Stored first (the database is the record), then copied to GoHighLevel through
 * the outbox, so a CRM outage never loses a message. Contacting us is not a marketing consent: nothing
 * here touches marketing fields or starts an order workflow.
 */
import 'server-only'
import { randomBytes, randomUUID } from 'node:crypto'
import type { Attribution } from '@/lib/attribution'
import { ENQUIRY_TOPICS, type EnquiryInput, type EnquiryTopic } from '@/lib/enquiry'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { ghl, TAGS } from '@/server/integrations/ghl'
import { jobs } from '@/server/jobs/outbox'
import { log } from '@/server/log'

export const ENQUIRY_STATUS = { new: 'Nou', in_progress: 'În lucru', resolved: 'Rezolvat' } as const
export type EnquiryStatus = keyof typeof ENQUIRY_STATUS

export type Enquiry = EnquiryInput & {
  id: string
  reference: string
  status: EnquiryStatus
  sourcePage: string | null
  attribution: Attribution | null
  ghlContactId: string | null
  createdAt: Date
  updatedAt: Date
}

const toEnquiry = (r: Record<string, unknown>): Enquiry => ({
  id: r.id as string,
  reference: r.reference as string,
  name: r.name as string,
  email: r.email as string,
  phone: (r.phone as string) ?? '',
  topic: r.topic as EnquiryTopic,
  message: r.message as string,
  status: r.status as EnquiryStatus,
  sourcePage: (r.source_page as string) ?? null,
  attribution: (r.attribution as Attribution) ?? null,
  ghlContactId: (r.ghl_contact_id as string) ?? null,
  createdAt: new Date(r.created_at as string),
  updatedAt: new Date(r.updated_at as string),
})

/** Stores an enquiry once per submission attempt (a resubmit returns the same one). */
export async function recordEnquiry(e: EnquiryInput, meta: { attemptId: string; sourcePage: string | null; attribution: Attribution | null }) {
  const db = await getDb()
  const found = await db.query('select * from enquiries where idempotency_key = $1', [meta.attemptId])
  if (found.rows[0]) return { enquiry: toEnquiry(found.rows[0]), created: false }
  const id = randomUUID()
  const reference = `MSG-${randomBytes(4).toString('hex').toUpperCase()}`
  const created = await db.tx(async (t) => {
    const { rows } = await t.query(
      `insert into enquiries (id, reference, idempotency_key, name, email, phone, topic, message, source_page, attribution)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict (idempotency_key) do nothing returning *`,
      [id, reference, meta.attemptId, e.name, e.email, e.phone, e.topic, e.message, meta.sourcePage, meta.attribution ? JSON.stringify(meta.attribution) : null],
    )
    if (rows[0] && getConfig().ghl) await jobs.enqueue(t, { kind: 'ghl.enquiry', dedupeKey: `ghl.enquiry:${id}`, payload: { enquiryId: id } })
    return rows[0]
  })
  if (!created) {
    const again = await db.query('select * from enquiries where idempotency_key = $1', [meta.attemptId])
    return { enquiry: toEnquiry(again.rows[0]), created: false }
  }
  log.info('enquiry.recorded', { reference, topic: e.topic })
  return { enquiry: toEnquiry(created), created: true }
}

/** Outbox job: the sender becomes (or stays) a GHL contact with the bt-mesaj-contact tag. */
export async function syncEnquiry(enquiryId: string): Promise<string> {
  const c = getConfig()
  if (!c.ghl) return 'ghl not configured'
  const db = await getDb()
  const { rows } = await db.query('select * from enquiries where id = $1', [enquiryId])
  if (!rows[0]) return 'enquiry gone'
  const e = toEnquiry(rows[0])
  const contactId = await ghl.upsertEnquiryContact(c.ghl, e)
  await ghl.addTags(c.ghl, contactId, [TAGS.enquiry])
  await db.query('update enquiries set ghl_contact_id = $2 where id = $1', [e.id, contactId])
  return 'synced'
}

export const enquiries = {
  async list(status?: EnquiryStatus, limit = 200) {
    const db = await getDb()
    const { rows } = status
      ? await db.query('select * from enquiries where status = $1 order by created_at desc limit $2', [status, limit])
      : await db.query('select * from enquiries order by created_at desc limit $1', [limit])
    return rows.map(toEnquiry)
  },
  async counts() {
    const db = await getDb()
    const { rows } = await db.query<{ status: string; n: string }>('select status, count(*) as n from enquiries group by status')
    return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)])) as Partial<Record<EnquiryStatus, number>>
  },
  async setStatus(id: string, status: EnquiryStatus) {
    if (!(status in ENQUIRY_STATUS) || !/^[0-9a-f-]{36}$/i.test(id)) return false
    const db = await getDb()
    const r = await db.query('update enquiries set status = $2, updated_at = now() where id = $1 and status <> $2 returning id', [id, status])
    return r.rows.length > 0
  },
}

export { ENQUIRY_TOPICS }
