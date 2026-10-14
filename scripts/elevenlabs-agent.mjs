#!/usr/bin/env node
// Sets up the Biohack Tech AI calling agent on ElevenLabs. Reads ELEVENLABS_API_KEY (and the optional ids)
// from the environment or .env.local; never prints the key. Spends no call credits.
//
//   node scripts/elevenlabs-agent.mjs voices          Romanian voices from the voice library (pick one)
//   node scripts/elevenlabs-agent.mjs push            create the agent, or update ELEVENLABS_AGENT_ID
//                                                     (needs ELEVENLABS_VOICE_ID); prints the agent id
//   node scripts/elevenlabs-agent.mjs phone-numbers   phone numbers imported in ElevenLabs (their ids)
//
// The agent definition is docs/ai-calling/agent.json, generated from the site's catalog and approved content
// (src/server/calling/agent.ts; `UPDATE_AGENT_JSON=1 npx vitest run tests/server/calling.test.ts` refreshes it).
import { existsSync, readFileSync } from 'node:fs'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')
const KEY = process.env.ELEVENLABS_API_KEY?.trim()
const BASE = (process.env.ELEVENLABS_API_BASE?.trim() || 'https://api.elevenlabs.io').replace(/\/$/, '')
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

const cmd = process.argv[2]
if (cmd === 'voices') {
  const r = await api('GET', '/v1/shared-voices?language=ro&page_size=30')
  for (const v of r.voices ?? []) console.log(`${v.voice_id}  ${v.name}  ${v.gender ?? ''} ${v.age ?? ''} ${v.accent ?? ''}  ${v.use_case ?? ''}`)
  console.log('\nAlege o voce și pune-o în ELEVENLABS_VOICE_ID. O voce din bibliotecă trebuie adăugată întâi în contul tău (My Voices).')
} else if (cmd === 'push') {
  const voice = process.env.ELEVENLABS_VOICE_ID?.trim()
  if (!voice) throw new Error('ELEVENLABS_VOICE_ID lipsește: rulează întâi `voices`.')
  const def = JSON.parse(readFileSync('docs/ai-calling/agent.json', 'utf8').replaceAll('${ELEVENLABS_VOICE_ID}', voice))
  const id = process.env.ELEVENLABS_AGENT_ID?.trim()
  if (id) {
    await api('PATCH', `/v1/convai/agents/${encodeURIComponent(id)}`, def)
    console.log(`Agent actualizat: ${id}`)
  } else {
    const r = await api('POST', '/v1/convai/agents/create', def)
    console.log(`Agent creat: ${r.agent_id}\nPune-l în ELEVENLABS_AGENT_ID (Vercel Production).`)
  }
} else if (cmd === 'phone-numbers') {
  const r = await api('GET', '/v1/convai/phone-numbers')
  for (const n of Array.isArray(r) ? r : (r.phone_numbers ?? [])) console.log(`${n.phone_number_id}  ${n.phone_number}  ${n.provider ?? ''}  ${n.label ?? ''}`)
  console.log('\nPune id-ul numărului în ELEVENLABS_PHONE_NUMBER_ID. Fără un număr Twilio (sau SIP) importat, apelurile ieșite nu sunt posibile.')
} else {
  console.error('Folosire: node scripts/elevenlabs-agent.mjs voices | push | phone-numbers')
  process.exit(1)
}
