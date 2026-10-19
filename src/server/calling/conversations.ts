/**
 * The agent's latest conversations for /admin/apeluri, inbound and outbound: read from ElevenLabs (the source of
 * truth for inbound calls, which have no lead) and joined with our calls table for the outbound ones (number,
 * outcome). Read-only; nothing is stored. The audio, when recording is on, stays in ElevenLabs.
 */
import 'server-only'
import type { ElevenLabsConfig } from '@/server/config'
import type { Queryable } from '@/server/db'
import { conversationUrl, elevenlabs } from '@/server/integrations/elevenlabs'

export type ConversationRow = {
  id: string
  at: Date
  phone: string | null
  durationSecs: number
  direction: 'inbound' | 'outbound' | null
  status: string
  result: string | null
  title: string | null
  url: string
}

export async function recentConversations(q: Queryable, c: ElevenLabsConfig, n = 25): Promise<ConversationRow[]> {
  const { conversations } = await elevenlabs.conversations(c, n)
  const ids = conversations.map((x) => x.conversation_id)
  const { rows } = ids.length
    ? await q.query('select provider_call_id, phone, outcome, error from calls where provider_call_id = any($1)', [ids])
    : { rows: [] as Record<string, unknown>[] }
  const ours = new Map(rows.map((r) => [r.provider_call_id as string, r]))
  return Promise.all(
    conversations.map(async (x) => {
      const mine = ours.get(x.conversation_id)
      let phone: string | null = (mine?.phone as string) ?? null
      let direction: ConversationRow['direction'] = x.direction ?? null
      let lineResult: string | undefined
      // Inbound calls (and outbound ones we did not place, e.g. tests from the dashboard): the number is only in the detail.
      if (!phone) {
        const d = await elevenlabs.conversation(c, x.conversation_id).catch(() => null)
        phone = d?.metadata?.phone_call?.external_number ?? null
        direction = direction ?? d?.metadata?.phone_call?.direction ?? null
        lineResult = d?.metadata?.phone_call?.call_result
      }
      return {
        id: x.conversation_id,
        at: new Date(x.start_time_unix_secs * 1000),
        phone,
        durationSecs: x.call_duration_secs,
        direction,
        status: x.status,
        result: (mine?.outcome as string) ?? (mine?.error as string) ?? lineResult ?? (x.call_successful !== 'unknown' ? x.call_successful : null),
        title: x.call_summary_title ?? null,
        url: conversationUrl(x.conversation_id),
      }
    }),
  )
}
