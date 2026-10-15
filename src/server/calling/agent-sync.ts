/**
 * After a price or stock change in /admin/setari, the ElevenLabs agent gets the same numbers: its instructions
 * (prices and conditions) and its knowledge document are rebuilt from the catalog as it is now and sent to the
 * agent. Nothing else of the agent changes (voice, tools, settings stay as the setup script left them).
 */
import 'server-only'
import type { ElevenLabsConfig } from '@/server/config'
import { AGENT_INSTRUCTIONS_NOW, agentKnowledge } from './agent'

async function api<T>(c: ElevenLabsConfig, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${c.apiBase}${path}`, {
    method,
    headers: { 'xi-api-key': c.apiKey, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${text.slice(0, 200)}`)
  return (text ? JSON.parse(text) : {}) as T
}

export async function syncAgentPrices(c: ElevenLabsConfig, siteUrl: string) {
  const text = agentKnowledge(siteUrl)
  const name = `BiohackTech — produse, prețuri, livrare, retur, garanție, plăți (site) · ${new Date().toISOString().slice(0, 16)}`
  const doc = await api<{ id: string }>(c, 'POST', '/v1/convai/knowledge-base/text', { text, name })
  await api(c, 'PATCH', `/v1/convai/agents/${encodeURIComponent(c.agentId)}`, {
    conversation_config: { agent: { prompt: { prompt: AGENT_INSTRUCTIONS_NOW(), knowledge_base: [{ type: 'text', name, id: doc.id, usage_mode: 'prompt' }] } } },
  })
  return doc.id
}
