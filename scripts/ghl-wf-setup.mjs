// The Biohack Tech GHL sub-account for the email workflows: contact fields and tags (scripts/ghl-wf-spec.json, the same
// list as src/server/workflows/ghl-setup.ts). Dry run by default: lists what exists and what is missing, writes nothing.
//
//   node scripts/ghl-wf-setup.mjs            dry run (GHL_WF_TOKEN, GHL_WF_LOCATION_ID from .env.local)
//   node scripts/ghl-wf-setup.mjs --apply    creates only what is missing (fields, tags); never contacts or workflows
//
// Refuses the shared NEUROS locations (GHL_LOCATION_ID, GHL_BRAINEVENT_LOCATION_ID). Never prints the token.
import { existsSync, readFileSync } from 'node:fs'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')
const TOKEN = process.env.GHL_WF_TOKEN?.trim()
const LOCATION = process.env.GHL_WF_LOCATION_ID?.trim()
const BASE = process.env.GHL_API_BASE?.trim() || 'https://services.leadconnectorhq.com'
const apply = process.argv.includes('--apply')
if (!TOKEN || !LOCATION) {
  console.error('GHL_WF_TOKEN și GHL_WF_LOCATION_ID lipsesc: subcontul Biohack Tech nu este configurat. Nimic de făcut.')
  process.exit(1)
}
if ([process.env.GHL_LOCATION_ID, process.env.GHL_BRAINEVENT_LOCATION_ID].map((x) => x?.trim()).includes(LOCATION)) {
  console.error('GHL_WF_LOCATION_ID este locația comună NEUROS. Oprit: workflow-urile Biohack Tech merg doar în subcontul lor.')
  process.exit(1)
}
const spec = JSON.parse(readFileSync(new URL('./ghl-wf-spec.json', import.meta.url), 'utf8'))
const call = async (method, path, body) => {
  const res = await fetch(`${BASE}${path}`, { method, headers: { Authorization: `Bearer ${TOKEN}`, Version: '2021-07-28', Accept: 'application/json', ...(body && { 'Content-Type': 'application/json' }) }, body: body ? JSON.stringify(body) : undefined })
  return { status: res.status, body: await res.json().catch(() => null) }
}
const fields = await call('GET', `/locations/${LOCATION}/customFields`)
const tags = await call('GET', `/locations/${LOCATION}/tags`)
if (fields.status !== 200 || tags.status !== 200) {
  console.error(`Nu pot citi subcontul (câmpuri ${fields.status}, taguri ${tags.status}). Verifică scopurile tokenului: locations/customFields, locations/tags.`)
  process.exit(1)
}
const haveFields = new Set((fields.body.customFields ?? []).map((f) => f.fieldKey))
const haveTags = new Set((tags.body.tags ?? []).map((t) => t.name))
const missingFields = spec.fields.filter((f) => !haveFields.has(f.key))
const missingTags = spec.tags.filter((t) => !haveTags.has(t))
console.log(`Câmpuri: ${spec.fields.length - missingFields.length}/${spec.fields.length} există · taguri: ${spec.tags.length - missingTags.length}/${spec.tags.length} există`)
for (const f of missingFields) console.log(`  lipsește câmpul ${f.key}`)
for (const t of missingTags) console.log(`  lipsește tagul ${t}`)
if (!apply) {
  console.log('\nDry run: nimic creat. Rulează cu --apply ca să creezi doar ce lipsește.')
  process.exit(0)
}
for (const f of missingFields) {
  const r = await call('POST', `/locations/${LOCATION}/customFields`, { name: f.name, dataType: f.dataType, model: 'contact' })
  console.log(`${r.status < 300 ? 'creat' : `EROARE ${r.status}`}  câmp ${f.key}`)
}
for (const t of missingTags) {
  const r = await call('POST', `/locations/${LOCATION}/tags`, { name: t })
  console.log(`${r.status < 300 ? 'creat' : `EROARE ${r.status}`}  tag ${t}`)
}
