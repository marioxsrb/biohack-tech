import { NextResponse, type NextRequest } from 'next/server'
import { applyCallResult, calls, resultFromConversation, type CallOutcome } from '@/server/calling/calls'
import { testCalls } from '@/server/calling/test-call'
import { getConfig } from '@/server/config'
import { getDb } from '@/server/db'
import { verifyWebhookSignature, type Conversation } from '@/server/integrations/elevenlabs'
import { kickJobs } from '@/server/jobs/runner'
import { errText, log } from '@/server/log'

export const runtime = 'nodejs'

type Payload = {
  type?: string
  event_timestamp?: number
  data?: Conversation & {
    agent_id?: string
    failure_reason?: string
    conversation_initiation_client_data?: { dynamic_variables?: Record<string, unknown> }
  }
}

const FAILURE: Record<string, CallOutcome> = { busy: 'busy', 'no-answer': 'no_answer' }

/**
 * ElevenLabs post-call webhook: the result of an AI call (post_call_transcription) or a call that never
 * connected (call_initiation_failure). Signed with ELEVENLABS_WEBHOOK_SECRET; each event is applied once
 * (a repeat or a late copy changes nothing). Only the outcome, timings and ids are kept: the transcript in
 * the payload is never stored. Other event types (audio) are acknowledged and ignored.
 */
export async function POST(req: NextRequest) {
  const c = getConfig()
  const secret = c.elevenlabs?.webhookSecret
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 404 })
  const raw = await req.text()
  if (!verifyWebhookSignature(raw, req.headers.get('elevenlabs-signature'), secret)) return NextResponse.json({ error: 'bad signature' }, { status: 401 })
  let event: Payload
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }
  const data = event.data
  const conversationId = data?.conversation_id
  if (!data || !conversationId || (event.type !== 'post_call_transcription' && event.type !== 'call_initiation_failure')) return NextResponse.json({ ok: true, ignored: event.type ?? 'unknown' })
  if (c.elevenlabs && data.agent_id && data.agent_id !== c.elevenlabs.agentId) return NextResponse.json({ ok: true, ignored: 'other agent' })

  try {
    const db = await getDb()
    // Found by ElevenLabs' id, or by ours (passed to the agent) when the webhook beats the dial response.
    const ours = data.conversation_initiation_client_data?.dynamic_variables?.call_id
    let call = await calls.byProviderId(db, conversationId)
    if (!call && typeof ours === 'string') {
      call = await calls.byId(db, ours)
      if (call && !call.providerCallId) await calls.update(db, call.id, { provider_call_id: conversationId })
    }
    if (!call) {
      // A test call from /admin/apeluri: only its own row gets the result.
      if (typeof ours === 'string' && ours.startsWith('test-')) {
        const failed = event.type === 'call_initiation_failure'
        const r = failed ? null : resultFromConversation(data)
        await testCalls.finish(db, ours.slice(5), {
          status: failed ? 'failed' : 'completed',
          outcome: failed ? (data.failure_reason ?? 'technical_failure') : String(data.analysis?.data_collection_results?.outcome?.value ?? r?.outcome ?? ''),
          durationSecs: r?.durationSecs ?? null,
          error: failed ? `initiation failed: ${data.failure_reason ?? 'unknown'}` : null,
        })
        return NextResponse.json({ ok: true, test: true })
      }
      log.warn('call.webhook_unknown', { type: event.type })
      return NextResponse.json({ ok: true, ignored: 'unknown call' })
    }
    // Recorded and applied in one transaction: a failure rolls both back, and ElevenLabs' retry applies it then.
    const found = call
    const applied = await db.tx(async (t) => {
      const fresh = await t.query(`insert into webhook_events (provider, event_id, type, outcome) values ('elevenlabs', $1, $2, 'received') on conflict do nothing returning event_id`, [`${event.type}:${conversationId}`, event.type])
      if (!fresh.rows.length) return null
      return event.type === 'call_initiation_failure'
        ? applyCallResult(t, c, found, { status: 'failed', outcome: FAILURE[data.failure_reason ?? ''] ?? 'technical_failure', error: `initiation failed: ${data.failure_reason ?? 'unknown'}` })
        : applyCallResult(t, c, found, resultFromConversation(data))
    })
    if (applied === null) return NextResponse.json({ ok: true, duplicate: true })
    if (applied) kickJobs()
    log.info('call.webhook', { callId: call.id, type: event.type, applied })
    return NextResponse.json({ ok: true, applied })
  } catch (e) {
    // A 500 makes ElevenLabs retry; nothing was half-applied that a retry would double.
    log.error('call.webhook_failed', { error: errText(e) })
    return NextResponse.json({ error: 'server' }, { status: 500 })
  }
}
