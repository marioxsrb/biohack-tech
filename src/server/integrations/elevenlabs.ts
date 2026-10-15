/**
 * ElevenLabs Agents: the outbound call through the agent's Twilio number, the conversation read-back (for
 * results whose webhook never arrived) and the post-call webhook signature. The API key is sent only in
 * the xi-api-key header and never logged.
 */
import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { ElevenLabsConfig } from '@/server/config'

export class ElevenLabsError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    /** True when the request may have reached ElevenLabs (timeout, dropped connection): a call may exist. */
    readonly uncertain = false,
  ) {
    super(message)
  }
}

const TIMEOUT_MS = 15_000

async function call<T>(c: ElevenLabsConfig, method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${c.apiBase}${path}`, {
      method,
      headers: { 'xi-api-key': c.apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    throw new ElevenLabsError(`ElevenLabs unreachable: ${(e as Error).name}`, null, true)
  }
  const text = await res.text()
  if (!res.ok) {
    let detail = text.slice(0, 300)
    try {
      const j = JSON.parse(text) as { detail?: unknown }
      detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail ?? j).slice(0, 300)
    } catch {}
    throw new ElevenLabsError(`ElevenLabs ${res.status}: ${detail}`, res.status, res.status >= 500)
  }
  return (text ? JSON.parse(text) : {}) as T
}

export type OutboundResult = { success: boolean; message: string; conversation_id: string | null; callSid: string | null }

export type Conversation = {
  conversation_id: string
  status: string
  metadata?: { start_time_unix_secs?: number; call_duration_secs?: number; termination_reason?: string }
  analysis?: { call_successful?: string; data_collection_results?: Record<string, { value?: unknown }> }
}

export const elevenlabs = {
  /**
   * Places the call from the agent's number (a Twilio number or a SIP trunk, as imported in ElevenLabs). No
   * recording: neither the provider's recording nor audio is requested.
   */
  async outboundCall(c: ElevenLabsConfig, to: string, dynamicVariables: Record<string, string | number | boolean>): Promise<OutboundResult> {
    const body = { agent_id: c.agentId, agent_phone_number_id: c.phoneNumberId, to_number: to, conversation_initiation_client_data: { dynamic_variables: dynamicVariables } }
    if (c.phoneProvider === 'sip_trunk') {
      const r = await call<{ success: boolean; message: string; conversation_id: string | null; sip_call_id?: string | null }>(c, 'POST', '/v1/convai/sip-trunk/outbound-call', body)
      return { success: r.success, message: r.message, conversation_id: r.conversation_id, callSid: r.sip_call_id ?? null }
    }
    return call<OutboundResult>(c, 'POST', '/v1/convai/twilio/outbound-call', { ...body, call_recording_enabled: false })
  },

  conversation(c: ElevenLabsConfig, conversationId: string) {
    return call<Conversation>(c, 'GET', `/v1/convai/conversations/${encodeURIComponent(conversationId)}`)
  },
}

/** Webhooks older (or newer) than this are refused, like ElevenLabs' own SDK does. */
export const WEBHOOK_TOLERANCE_SECS = 30 * 60

/**
 * The ElevenLabs-Signature header: "t=<unix seconds>,v0=<hex HMAC-SHA256 of "<t>.<raw body>">" (several v0
 * values may be present; any one matching is enough). Returns false for anything else.
 */
export function verifyWebhookSignature(rawBody: string, header: string | null, secret: string, now = Date.now()): boolean {
  if (!header) return false
  const parts = header.split(',').map((p) => p.trim())
  const t = parts.find((p) => p.startsWith('t='))?.slice(2)
  const sigs = parts.filter((p) => p.startsWith('v0=')).map((p) => p.slice(3))
  if (!t || !/^\d+$/.test(t) || !sigs.length) return false
  if (Math.abs(now / 1000 - Number(t)) > WEBHOOK_TOLERANCE_SECS) return false
  const expected = Buffer.from(createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex'))
  return sigs.some((s) => {
    const given = Buffer.from(s)
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}

/** Signs a payload the same way (tests and local tools). */
export function signWebhook(rawBody: string, secret: string, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v0=${createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')}`
}
