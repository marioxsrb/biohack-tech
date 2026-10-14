/**
 * AI calling, decided at the moment a call would be placed, from the current data (like the recovery
 * emails): a lead is called only with its own, separate call consent in force, a Romanian number, no
 * purchase, no refusal or unsubscribe, inside the calling window, at most `maxAttempts` times, and never
 * twice for the same person at once. Supabase holds every attempt and its result; ElevenLabs places the
 * call and reports back (webhook, or a read-back when the webhook is late); GoHighLevel gets tags.
 *
 * Nothing here stores a transcript or a recording: only the outcome the agent recorded, the timings and
 * provider ids.
 */
import 'server-only'
import { randomUUID } from 'node:crypto'
import { getProduct } from '@/content/catalog'
import { romanianE164 } from '@/lib/consent/calling'
import type { CallingConfig, Config } from '@/server/config'
import type { Queryable, Row } from '@/server/db'
import { ElevenLabsError, elevenlabs, type Conversation } from '@/server/integrations/elevenlabs'
import { jobs } from '@/server/jobs/outbox'
import { CART_INTEREST, leads, type Lead } from '@/server/leads'
import { log } from '@/server/log'
import { marketing } from '@/server/marketing/consent'
import { callConsent } from './consent'

/** What a call ended with. The first four come from the conversation, the rest from the line. */
export const CALL_OUTCOMES = ['interested', 'more_info', 'human_follow_up', 'not_interested', 'opted_out', 'no_answer', 'busy', 'invalid_number', 'technical_failure'] as const
export type CallOutcome = (typeof CALL_OUTCOMES)[number]

/** Outcomes after which another attempt makes sense (nobody really talked). */
const RETRYABLE: CallOutcome[] = ['no_answer', 'busy', 'technical_failure']
/** One sequence per person in this window. */
export const CALL_PERSON_DAYS = 7

export type Call = {
  id: string
  leadId: string
  phone: string
  productId: string
  attempt: number
  status: 'scheduled' | 'dry_run' | 'dialing' | 'completed' | 'failed' | 'unknown' | 'cancelled'
  providerCallId: string | null
  outcome: CallOutcome | null
  followUp: boolean
  optedOut: boolean
  wantsLink: boolean
  error: string | null
  startedAt: Date | null
  endedAt: Date | null
  durationSecs: number | null
  createdAt: Date
}

const dt = (v: unknown) => (v ? new Date(v as string) : null)
const toCall = (r: Row): Call => ({
  id: r.id as string,
  leadId: r.lead_id as string,
  phone: r.phone as string,
  productId: r.product_id as string,
  attempt: Number(r.attempt),
  status: r.status as Call['status'],
  providerCallId: (r.provider_call_id as string) ?? null,
  outcome: (r.outcome as CallOutcome) ?? null,
  followUp: !!r.follow_up,
  optedOut: !!r.opted_out,
  wantsLink: !!r.wants_link,
  error: (r.error as string) ?? null,
  startedAt: dt(r.started_at),
  endedAt: dt(r.ended_at),
  durationSecs: r.duration_secs == null ? null : Number(r.duration_secs),
  createdAt: new Date(r.created_at as string),
})

export const calls = {
  async byId(q: Queryable, id: string) {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null
    const { rows } = await q.query('select * from calls where id = $1', [id])
    return rows[0] ? toCall(rows[0]) : null
  },
  async byProviderId(q: Queryable, conversationId: string) {
    const { rows } = await q.query('select * from calls where provider_call_id = $1', [conversationId])
    return rows[0] ? toCall(rows[0]) : null
  },
  async forLeads(q: Queryable, leadIds: string[]) {
    if (!leadIds.length) return []
    return (await q.query('select * from calls where lead_id = any($1::uuid[]) order by created_at desc', [leadIds])).rows.map(toCall)
  },
  update: (q: Queryable, id: string, patch: Record<string, unknown>) => {
    const keys = Object.keys(patch)
    return q.query(`update calls set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() where id = $1`, [id, ...keys.map((k) => patch[k])])
  },
}

/** The product a lead is about: its own, or the first product of its checkout. */
export function leadProduct(lead: Pick<Lead, 'productId' | 'cart'>) {
  const id = lead.productId && lead.productId !== CART_INTEREST ? lead.productId : lead.cart?.[0]?.productId
  return id ? getProduct(id) : undefined
}

// ─── calling window ────────────────────────────────────────────────────────────

const WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

/** Local weekday (1 = Monday) and minutes since midnight in `timezone`. */
export function localTime(at: Date, timezone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at).map((p) => [p.type, p.value]),
  )
  return { day: WEEKDAY[parts.weekday] ?? 0, minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}

export function inCallingWindow(at: Date, c: Pick<CallingConfig, 'hours' | 'days' | 'timezone'>) {
  const t = localTime(at, c.timezone)
  return c.days.includes(t.day) && t.minutes >= c.hours.start * 60 && t.minutes < c.hours.end * 60
}

/** `at` itself when allowed, otherwise the start of the next allowed window (5-minute steps, up to 8 days). */
export function nextCallingWindow(at: Date, c: Pick<CallingConfig, 'hours' | 'days' | 'timezone'>): Date {
  if (inCallingWindow(at, c)) return at
  const step = 5 * 60_000
  let t = Math.ceil(at.getTime() / step) * step
  for (let i = 0; i < (8 * 24 * 60) / 5; i++, t += step) if (inCallingWindow(new Date(t), c)) return new Date(t)
  return new Date(at.getTime() + 24 * 3_600_000)
}

// ─── eligibility ─────────────────────────────────────────────────────────────

export type CallFacts = {
  phone: string | null
  /** The number's AI calling consent: null = never given. */
  consentGranted: boolean | null
  /** The address unsubscribed from (or withdrew) email marketing: calls stop too. */
  unsubscribed: boolean
  converted: boolean
  /** A checkout of the same person, with its own call consent, started after this lead. */
  superseded: boolean
  /** Another lead of the same person was called recently, or an older one still has its call to come. */
  otherCall: boolean
}

export type CallCheck = { call: true; phone: string } | { call: false; reason: string; status?: 'stopped' | 'disabled'; later?: Date }

/** Should attempt `attempt` be placed now? Pure; checked in this order, the cheapest refusals first. */
export function callDecision(lead: Lead, ctx: { attempt: number; now: Date; calling: CallingConfig } & CallFacts): CallCheck {
  const c = ctx.calling
  if (!c.enabled) return { call: false, reason: 'calling off', status: 'disabled' }
  if (lead.callDisabled) return { call: false, reason: 'calling disabled for this lead', status: 'disabled' }
  if (lead.stage === 'ordered' || lead.stage === 'purchased' || ctx.converted) return { call: false, reason: 'converted', status: 'stopped' }
  if (lead.orderId) return { call: false, reason: 'order placed', status: 'stopped' }
  if (!ctx.phone) return { call: false, reason: 'no valid Romanian phone number', status: 'stopped' }
  if (ctx.consentGranted === null) return { call: false, reason: 'no call consent', status: 'stopped' }
  if (!ctx.consentGranted) return { call: false, reason: 'call consent withdrawn', status: 'stopped' }
  if (ctx.unsubscribed) return { call: false, reason: 'unsubscribed', status: 'stopped' }
  if (ctx.attempt > c.maxAttempts) return { call: false, reason: 'maximum attempts reached', status: 'stopped' }
  if (lead.callAttempts !== ctx.attempt - 1) return { call: false, reason: `attempt ${ctx.attempt} after ${lead.callAttempts}` }
  if (!leadProduct(lead)) return { call: false, reason: 'no product to talk about', status: 'stopped' }
  if (ctx.superseded) return { call: false, reason: 'went on to the checkout' }
  if (ctx.otherCall) return { call: false, reason: 'another call for this person', status: 'stopped' }
  if (c.testNumbers && !c.testNumbers.includes(ctx.phone)) return { call: false, reason: 'calling in test mode', status: 'disabled' }
  const quietUntil = lead.lastActivityAt.getTime() + c.firstDelayMinutes * 60_000
  if (ctx.attempt === 1 && ctx.now.getTime() < quietUntil) return { call: false, reason: 'still active', later: nextCallingWindow(new Date(quietUntil), c) }
  if (!inCallingWindow(ctx.now, c)) return { call: false, reason: 'outside calling hours', later: nextCallingWindow(ctx.now, c) }
  return { call: true, phone: ctx.phone }
}

export async function callFacts(q: Queryable, lead: Lead): Promise<CallFacts> {
  const phone = romanianE164(lead.phone)
  const [consent, mkt, conv, sup, other] = await Promise.all([
    phone ? callConsent.state(q, phone) : null,
    marketing.state(q, lead.email),
    q.query(
      `select 1 from orders where (id = $3 and (payment_status in ('paid','partially_refunded','refunded') or payment_method <> 'card'))
         or (email = $1 and created_at >= $2 and (payment_status in ('paid','partially_refunded','refunded') or payment_method <> 'card')) limit 1`,
      [lead.email, lead.createdAt, lead.orderId],
    ),
    lead.productId === CART_INTEREST
      ? { rows: [] }
      : q.query(`select 1 from leads where email = $1 and product_id = '${CART_INTEREST}' and id <> $2 and call_consent and coalesce(checkout_started_at, created_at) >= $3 limit 1`, [lead.email, lead.id, lead.createdAt]),
    q.query(
      `select 1 from calls where phone = $1 and lead_id <> $2 and status <> 'cancelled' and created_at >= $3
       union all
       select 1 from leads l where l.email = $4 and l.id <> $2 and l.created_at < $5 and l.call_status not in ('stopped', 'disabled') and exists (
         select 1 from jobs j where j.kind = 'call.attempt' and j.payload->>'leadId' = l.id::text and j.status in ('pending', 'retry', 'running'))
       limit 1`,
      [phone ?? '', lead.id, new Date(Date.now() - CALL_PERSON_DAYS * 86_400_000), lead.email, lead.createdAt],
    ),
  ])
  return {
    phone,
    consentGranted: consent ? consent.granted : null,
    unsubscribed: mkt ? !mkt.granted : false,
    converted: conv.rows.length > 0,
    superseded: sup.rows.length > 0,
    otherCall: other.rows.length > 0,
  }
}

// ─── placing a call ──────────────────────────────────────────────────────────

export type StepResult = { skip: string } | { note: string }

/** What the agent is told about this lead (first name and product only: no email, no address). */
export function callVariables(lead: Lead, callId: string, productUrl: string) {
  const p = leadProduct(lead)!
  return {
    call_id: callId,
    customer_first_name: lead.name?.split(' ')[0]?.slice(0, 40) ?? '',
    product_name: p.name,
    product_id: p.id,
    product_url: productUrl,
    funnel: lead.funnel,
  }
}

export function productUrlFor(lead: Lead, c: Pick<Config, 'siteUrl'>, gatedOrigin: string) {
  const p = leadProduct(lead)!
  return lead.funnel === 'gated_price' ? `${gatedOrigin}/${p.slug}` : `${c.siteUrl}/products/${p.slug}`
}

/** One `call.attempt` job: decide, record the attempt, place the call (or pretend to, in dry run). */
export async function runCallAttempt(q: Queryable, c: Config, payload: { leadId: string; attempt: number }, gatedOrigin: string, dedupeKey: string): Promise<StepResult> {
  const lead = await leads.byId(q, payload.leadId)
  if (!lead) return { skip: 'lead gone' }
  const attempt = Math.max(1, Math.floor(payload.attempt))
  const now = new Date()
  const d = callDecision(lead, { attempt, now, calling: c.calling, ...(await callFacts(q, lead)) })
  if (!d.call) {
    if (d.later) {
      await jobs.enqueue(q, { kind: 'call.attempt', dedupeKey: `${dedupeKey}:${d.later.getTime()}`, payload, runAt: d.later })
      if (lead.callStatus === 'none') await leads.update(q, lead.id, { call_status: 'scheduled' })
    } else if (d.status && lead.callStatus !== d.status) await leads.update(q, lead.id, { call_status: d.status, call_outcome: lead.callOutcome ?? d.reason })
    return { skip: d.reason }
  }
  const id = randomUUID()
  const product = leadProduct(lead)!
  const { rows } = await q.query(
    `insert into calls (id, lead_id, phone, product_id, attempt, status, provider) values ($1, $2, $3, $4, $5, 'scheduled', $6)
     on conflict (lead_id, attempt) do nothing returning id`,
    [id, lead.id, d.phone, product.id, attempt, c.calling.provider],
  )
  if (!rows.length) return { skip: `attempt ${attempt} already recorded` }
  await leads.update(q, lead.id, { call_attempts: attempt, last_call_at: now })

  if (c.calling.dryRun) {
    await calls.update(q, id, { status: 'dry_run', started_at: now })
    await leads.update(q, lead.id, { call_status: 'dry_run' })
    log.info('call.dry_run', { callId: id, leadId: lead.id, attempt, product: product.id })
    return { note: `dry run ${id}` }
  }
  if (!c.elevenlabs) {
    await calls.update(q, id, { status: 'failed', outcome: 'technical_failure', error: 'ElevenLabs not configured' })
    await leads.update(q, lead.id, { call_status: 'failed', call_outcome: 'technical_failure' })
    return { note: `not configured ${id}` }
  }
  await calls.update(q, id, { status: 'dialing', started_at: now })
  try {
    const r = await elevenlabs.outboundCall(c.elevenlabs, d.phone, callVariables(lead, id, productUrlFor(lead, c, gatedOrigin)))
    if (!r.success || !r.conversation_id) throw new ElevenLabsError(`ElevenLabs refused the call: ${r.message}`.slice(0, 300), 200)
    await calls.update(q, id, { provider_call_id: r.conversation_id, provider_call_sid: r.callSid })
    await leads.update(q, lead.id, { call_status: 'dialing' })
    // If the webhook never comes, the result is read back from ElevenLabs.
    await jobs.enqueue(q, { kind: 'call.check', dedupeKey: `call.check:${id}:1`, payload: { callId: id, round: 1 }, runAt: new Date(now.getTime() + 20 * 60_000) })
    log.info('call.placed', { callId: id, leadId: lead.id, attempt })
    return { note: `call ${r.conversation_id}` }
  } catch (e) {
    const err = e instanceof ElevenLabsError ? e : new ElevenLabsError(String(e), null, true)
    if (err.uncertain) {
      // The request may have reached ElevenLabs: never dial again on our own; a person checks it in /admin.
      await calls.update(q, id, { status: 'unknown', error: err.message.slice(0, 300) })
      await leads.update(q, lead.id, { call_status: 'failed', call_outcome: 'technical_failure' })
      log.error('call.uncertain', { callId: id, leadId: lead.id, error: err.message })
      return { note: `uncertain ${id}` }
    }
    const invalid = err.status === 422 && /number|phone/i.test(err.message)
    await applyCallResult(q, c, (await calls.byId(q, id))!, { outcome: invalid ? 'invalid_number' : 'technical_failure', error: err.message, status: 'failed' })
    log.error('call.failed', { callId: id, leadId: lead.id, error: err.message })
    return { note: `failed ${id}` }
  }
}

// ─── results ─────────────────────────────────────────────────────────────────

export type CallResultInput = {
  status: 'completed' | 'failed'
  outcome: CallOutcome
  followUp?: boolean
  optedOut?: boolean
  wantsLink?: boolean
  startedAt?: Date | null
  durationSecs?: number | null
  error?: string | null
}

/**
 * Records a call's result once (a duplicate or late report changes nothing) and decides what follows: a
 * refusal withdraws the number's consent, a missed call gets one more attempt later (within the limit),
 * every result goes to the CRM, and a link the person asked for goes out by email.
 */
export async function applyCallResult(q: Queryable, c: Config, call: Call, r: CallResultInput): Promise<boolean> {
  if (call.status === 'completed' || (call.status === 'failed' && call.outcome)) return false
  const optedOut = !!r.optedOut || r.outcome === 'opted_out'
  const ended = r.startedAt && r.durationSecs != null ? new Date(r.startedAt.getTime() + r.durationSecs * 1000) : new Date()
  await calls.update(q, call.id, {
    status: r.status,
    outcome: r.outcome,
    follow_up: !!r.followUp || r.outcome === 'human_follow_up',
    opted_out: optedOut,
    wants_link: !!r.wantsLink,
    error: r.error?.slice(0, 300) ?? null,
    ...(r.startedAt && { started_at: r.startedAt }),
    ended_at: ended,
    duration_secs: r.durationSecs ?? null,
  })
  const lead = await leads.byId(q, call.leadId)
  if (!lead) return true
  if (optedOut) await callConsent.withdraw(q, { phone: call.phone, email: lead.email, source: 'call', leadId: lead.id })
  let status = 'completed'
  if (optedOut || r.outcome === 'not_interested' || r.outcome === 'invalid_number') status = 'stopped'
  else if (RETRYABLE.includes(r.outcome)) {
    if (call.attempt < c.calling.maxAttempts) {
      status = 'scheduled'
      const at = nextCallingWindow(new Date(Date.now() + c.calling.retryHours * 3_600_000), c.calling)
      await jobs.enqueue(q, { kind: 'call.attempt', dedupeKey: `call.attempt:${lead.id}:${call.attempt + 1}`, payload: { leadId: lead.id, attempt: call.attempt + 1 }, runAt: at })
    } else status = 'stopped'
  }
  await leads.update(q, lead.id, { call_status: status, call_outcome: r.outcome })
  if (c.ghl) await jobs.enqueue(q, { kind: 'ghl.call', dedupeKey: `ghl.call:${call.id}`, payload: { callId: call.id } })
  if (r.wantsLink && !optedOut) await jobs.enqueue(q, { kind: 'call.link', dedupeKey: `call.link:${call.id}`, payload: { callId: call.id } })
  return true
}

const asBool = (v: unknown) => v === true || v === 'true'

/** The agent's recorded answers (data collection) → our result. Unknown or missing values are safe defaults. */
export function resultFromConversation(conv: Pick<Conversation, 'metadata' | 'analysis'>): CallResultInput {
  const dc = conv.analysis?.data_collection_results ?? {}
  const raw = String(dc.outcome?.value ?? '').trim()
  const map: Record<string, CallOutcome> = { voicemail: 'no_answer', wrong_person: 'invalid_number' }
  const outcome = (CALL_OUTCOMES as readonly string[]).includes(raw) ? (raw as CallOutcome) : (map[raw] ?? (Number(conv.metadata?.call_duration_secs ?? 0) < 10 ? 'no_answer' : 'more_info'))
  return {
    status: 'completed',
    outcome,
    followUp: asBool(dc.follow_up_required?.value),
    optedOut: asBool(dc.opted_out?.value),
    wantsLink: asBool(dc.wants_link?.value),
    startedAt: conv.metadata?.start_time_unix_secs ? new Date(conv.metadata.start_time_unix_secs * 1000) : null,
    durationSecs: conv.metadata?.call_duration_secs ?? null,
  }
}

/** A call still "dialing" well after it started: read its result from ElevenLabs (the webhook was lost or late). */
export async function runCallCheck(q: Queryable, c: Config, payload: { callId: string; round: number }): Promise<StepResult> {
  const call = await calls.byId(q, payload.callId)
  if (!call) return { skip: 'call gone' }
  if (call.status !== 'dialing') return { skip: `already ${call.status}` }
  if (!c.elevenlabs || !call.providerCallId) return { skip: 'nothing to check' }
  const conv = await elevenlabs.conversation(c.elevenlabs, call.providerCallId)
  if (conv.status === 'done' || conv.status === 'failed') {
    await applyCallResult(q, c, call, conv.status === 'failed' ? { status: 'failed', outcome: 'technical_failure', error: 'conversation failed' } : resultFromConversation(conv))
    return { note: `result read back: ${conv.status}` }
  }
  if (payload.round >= 4) {
    await calls.update(q, call.id, { status: 'unknown', error: `still ${conv.status} after ${payload.round} checks` })
    return { note: 'left for review' }
  }
  await jobs.enqueue(q, { kind: 'call.check', dedupeKey: `call.check:${call.id}:${payload.round + 1}`, payload: { callId: call.id, round: payload.round + 1 }, runAt: new Date(Date.now() + 15 * 60_000) })
  return { skip: `still ${conv.status}` }
}

/** The link the person asked for during the call: a plain service email, no offer, no tracking. */
export function renderCallLink(x: { firstName: string | null; productName: string; link: string; company: string | null }) {
  const subject = `Linkul pentru ${x.productName}`
  const lines = [x.firstName ? `Bună, ${x.firstName}.` : 'Bună.', `Cum ai cerut la telefon, acesta este linkul pentru ${x.productName}:`, x.link, '', 'Pentru întrebări, răspunde la acest email.', '', 'Echipa Biohack Tech']
  const text = [...lines, ...(x.company ? ['', x.company] : [])].join('\n')
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const html = `<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>${esc(subject)}</title></head><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0b1316;background:#f2f5f6;margin:0;padding:24px"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:28px">${lines
    .filter(Boolean)
    .map((l) => (l === x.link ? `<p><a href="${esc(l)}" style="color:#0b1316;font-weight:600">${esc(x.productName)}</a></p>` : `<p style="font-size:16px;line-height:1.5">${esc(l)}</p>`))
    .join('')}${x.company ? `<p style="font-size:12px;color:#5a6870">${esc(x.company)}</p>` : ''}</div></body></html>`
  return { subject, text, html }
}
