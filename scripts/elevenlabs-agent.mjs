#!/usr/bin/env node
// Sets up the "BiohackTech — Recuperare Comenzi" agent on ElevenLabs. Reads ELEVENLABS_API_KEY (and the optional
// ids) from the environment or .env.local; never prints a key or a secret. Places no call, spends no call credits.
//
//   node scripts/elevenlabs-agent.mjs agents          the account's agents (nothing is changed)
//   node scripts/elevenlabs-agent.mjs voices          the account's voices (pick the Romanian one)
//   node scripts/elevenlabs-agent.mjs phone-numbers   numbers imported in ElevenLabs (id, number, provider)
//   node scripts/elevenlabs-agent.mjs push            the voice (added from the library if needed), the server
//                                                     tools, the knowledge base and the agent "BiohackTech — AI
//                                                     Recovery Agent": updated when an agent with that exact name
//                                                     exists, otherwise created (no other agent is ever touched);
//                                                     needs ELEVENLABS_TOOL_SECRET; prints the ids
//
// The agent definition is docs/ai-calling/agent.json and the tools docs/ai-calling/tools.json, generated from the
// site's catalog and approved content (src/server/calling/agent.ts; `UPDATE_AGENT_JSON=1 npx vitest run
// tests/server/calling.test.ts` refreshes them). The tools' secret header is stored as an ElevenLabs workspace
// secret, never in the agent's configuration.
import { existsSync, readFileSync } from 'node:fs'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')
const KEY = process.env.ELEVENLABS_API_KEY?.trim()
const BASE = (process.env.ELEVENLABS_API_BASE?.trim() || 'https://api.elevenlabs.io').replace(/\/$/, '')
const SECRET_NAME = 'biohack-tool-secret'
const HEADER = 'x-biohack-tool-secret'
if (!KEY) {
  console.error('ELEVENLABS_API_KEY lipsește (în .env.local sau în mediu). Nu fac nimic.')
  process.exit(1)
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, { method, headers: { 'xi-api-key': KEY, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 400)}`)
  return text ? JSON.parse(text) : {}
}

/** The workspace secret holding the tools' header value (created once, its value updated on every push). */
async function toolSecretId(value) {
  const list = await api('GET', '/v1/convai/secrets')
  const found = (list.secrets ?? []).find((s) => s.name === SECRET_NAME)
  if (found) {
    await api('PATCH', `/v1/convai/secrets/${found.secret_id}`, { type: 'update', name: SECRET_NAME, value })
    return found.secret_id
  }
  return (await api('POST', '/v1/convai/secrets', { type: 'new', name: SECRET_NAME, value })).secret_id
}

/** Creates or updates each server tool (matched by name); returns their ids. */
async function pushTools(secretId) {
  const tools = JSON.parse(readFileSync('docs/ai-calling/tools.json', 'utf8'))
  const existing = (await api('GET', '/v1/convai/tools')).tools ?? []
  const ids = []
  for (const t of tools) {
    const tool_config = { ...t, api_schema: { ...t.api_schema, request_headers: { [HEADER]: { secret_id: secretId } } } }
    const same = existing.find((e) => e.tool_config?.name === t.name && e.tool_config?.api_schema?.url === t.api_schema.url)
    if (same) {
      await api('PATCH', `/v1/convai/tools/${same.id}`, { tool_config })
      ids.push(same.id)
    } else ids.push((await api('POST', '/v1/convai/tools', { tool_config })).id)
    console.log(`Tool ${t.name}: ${ids.at(-1)}`)
  }
  return ids
}

/** A voice from the ElevenLabs library is added to the account once (agents use the account's voices). */
async function ensureVoice(id) {
  const res = await fetch(`${BASE}/v1/voices/${id}`, { headers: { 'xi-api-key': KEY } })
  if (res.ok) return console.log(`Voce: ${(await res.json()).name} (${id}), deja în cont`)
  const found = ((await api('GET', `/v1/shared-voices?search=${id}&page_size=5`)).voices ?? []).find((v) => v.voice_id === id)
  if (!found) throw new Error(`Vocea ${id} nu e nici în cont, nici în bibliotecă.`)
  await api('POST', `/v1/voices/add/${found.public_owner_id}/${id}`, { new_name: found.name })
  console.log(`Voce adăugată în cont: ${found.name} (${id})`)
}

const KB_TEXT = 'BiohackTech — produse, prețuri, livrare, retur, garanție, plăți (site)'
// The public sites are not attached: a search on every turn slows the answers, and the approved text has it all.
const KB_URLS = []

/**
 * The knowledge base: the site's approved content (docs/ai-calling/knowledge.md, always in the prompt) and the four
 * public sites (searched when needed). A changed text gets a new document; the old one is detached.
 */
async function pushKnowledge() {
  const docs = (await api('GET', '/v1/convai/knowledge-base?page_size=100')).documents ?? []
  const text = readFileSync('docs/ai-calling/knowledge.md', 'utf8')
  const stamp = `${KB_TEXT} · ${text.length}`
  let main = docs.find((d) => d.name === stamp)
  if (!main) main = await api('POST', '/v1/convai/knowledge-base/text', { text, name: stamp })
  const out = [{ type: 'text', name: stamp, id: main.id, usage_mode: 'prompt' }]
  for (const url of KB_URLS) {
    let d = docs.find((x) => x.name === url || x.url === url)
    if (!d) d = await api('POST', '/v1/convai/knowledge-base/url', { url, name: url })
    out.push({ type: 'url', name: url, id: d.id, usage_mode: 'auto' })
  }
  for (const k of out) console.log(`Knowledge base: ${k.name} (${k.id}, ${k.usage_mode})`)
  return out
}

const cmd = process.argv[2]
if (cmd === 'agents') {
  const r = await api('GET', '/v1/convai/agents?page_size=100')
  for (const a of r.agents ?? []) console.log(`${a.agent_id}  ${a.name}`)
} else if (cmd === 'voices') {
  const r = await api('GET', '/v2/voices?page_size=100')
  for (const v of r.voices ?? []) console.log(`${v.voice_id}  ${v.name}  ${v.labels?.language ?? ''} ${v.labels?.accent ?? ''} ${v.labels?.gender ?? ''}  ${v.category ?? ''}`)
} else if (cmd === 'phone-numbers') {
  const r = await api('GET', '/v1/convai/phone-numbers')
  for (const n of Array.isArray(r) ? r : (r.phone_numbers ?? [])) console.log(`${n.phone_number_id}  ${n.phone_number}  ${n.provider ?? ''}  ${n.label ?? ''}  agent=${n.assigned_agent?.agent_id ?? '-'}`)
  console.log('\nPune id-ul în ELEVENLABS_PHONE_NUMBER_ID și providerul (twilio sau sip_trunk) în ELEVENLABS_PHONE_PROVIDER.')
} else if (cmd === 'push') {
  const def = JSON.parse(readFileSync('docs/ai-calling/agent.json', 'utf8'))
  const secret = process.env.ELEVENLABS_TOOL_SECRET?.trim()
  if (!secret || secret.length < 24) throw new Error('ELEVENLABS_TOOL_SECRET lipsește sau e prea scurt (minimum 24 de caractere).')
  await ensureVoice(def.conversation_config.tts.voice_id)
  def.conversation_config.agent.prompt.tool_ids = await pushTools(await toolSecretId(secret))
  def.conversation_config.agent.prompt.knowledge_base = await pushKnowledge()
  // Matched by its exact name: never another agent, whatever ELEVENLABS_AGENT_ID says.
  const agents = (await api('GET', `/v1/convai/agents?page_size=100&search=${encodeURIComponent(def.name)}`)).agents ?? []
  const same = agents.find((a) => a.name === def.name)
  if (same) {
    await api('PATCH', `/v1/convai/agents/${encodeURIComponent(same.agent_id)}`, def)
    console.log(`Agent actualizat: ${same.agent_id}`)
  } else {
    const r = await api('POST', '/v1/convai/agents/create', def)
    console.log(`Agent creat: ${r.agent_id}\nPune-l în ELEVENLABS_AGENT_ID (Vercel Production).`)
  }
} else {
  console.error('Folosire: node scripts/elevenlabs-agent.mjs agents | voices | phone-numbers | push')
  process.exit(1)
}
