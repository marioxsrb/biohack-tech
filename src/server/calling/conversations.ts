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
  /** The lead's name and the funnel of the call (outbound calls we placed); null for inbound or dashboard calls. */
  client: string | null
  funnel: string | null
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
    ? await q.query(
        `select c.provider_call_id, c.phone, c.outcome, c.error, c.funnel, c.scenario, l.name, l.landing_host
           from calls c left join leads l on l.id = c.lead_id where c.provider_call_id = any($1)`,
        [ids],
      )
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
        client: (mine?.name as string) ?? null,
        funnel: mine ? funnelLabel(mine) : null,
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

/** "biohack-tech.ro · coș nefinalizat", "acces.biohack-tech.ro · preț ascuns, ofertă cerută", or the landing host. */
function funnelLabel(r: Record<string, unknown>) {
  const site = (r.landing_host as string) || (r.funnel === 'gated_price' ? 'acces.biohack-tech.ro' : 'biohack-tech.ro')
  const what = r.scenario === 'cart' ? 'coș nefinalizat' : r.scenario ? 'ofertă cerută' : ''
  return [site, r.funnel === 'gated_price' ? 'preț ascuns' : '', what].filter(Boolean).join(' · ')
}
