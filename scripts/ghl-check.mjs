// Read-only check of the GoHighLevel setup the app expects. Writes nothing to GHL and never prints the token.
//
//   node scripts/ghl-check.mjs          (reads GHL_PRIVATE_TOKEN and GHL_LOCATION_ID from .env.local)
//
// Finds the pipeline "Comenzi Biohack Tech" and prints its ID (the value for GHL_PIPELINE_ID), then checks the
// stage names, the contact fields and the tags. The names mirror src/server/integrations/ghl.ts: keep them in sync.
// Fields and tags need the optional scopes locations/customFields.readonly and locations/tags.readonly;
// without them those checks are skipped.
import { existsSync } from 'node:fs'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')
const TOKEN = process.env.GHL_PRIVATE_TOKEN?.trim()
const LOCATION = process.env.GHL_LOCATION_ID?.trim()
const BASE = process.env.GHL_API_BASE?.trim() || 'https://services.leadconnectorhq.com'
if (!TOKEN || !LOCATION) {
  console.error('GHL_PRIVATE_TOKEN and GHL_LOCATION_ID must be set in .env.local.')
  process.exit(1)
}

const PIPELINE = 'Comenzi Biohack Tech'
const STAGES = ['Așteaptă transferul', 'Plată nefinalizată', 'Plătită, de pregătit', 'În pregătire', 'Expediată', 'Livrată', 'Anulată', 'Rambursată']
const FIELDS = ['customer_type', 'last_order_number', 'last_order_date', 'last_order_value', 'last_order_products', 'last_payment_method',
  'last_payment_status', 'last_order_status', 'lifetime_orders', 'lifetime_value', 'marketing_consent', 'last_order_url', 'recovery_url',
  'unsubscribe_url'].map((f) => `contact.bt_${f}`)
const TAGS = ['bt-client', 'bt-client-firma', 'bt-cumparat-calm', 'bt-cumparat-focus', 'bt-cumparat-amber', 'bt-recuperare-eligibil']

const get = async (path) => {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${TOKEN}`, Version: '2021-07-28', Accept: 'application/json' } })
  return { status: res.status, body: res.ok ? await res.json() : null }
}
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}
const missing = (want, have) => want.filter((w) => !have.includes(w))

const pipelines = await get(`/opportunities/pipelines?locationId=${encodeURIComponent(LOCATION)}`)
check('token accepted, pipelines readable (opportunities.readonly)', pipelines.status === 200, `HTTP ${pipelines.status}`)
const pipeline = pipelines.body?.pipelines?.find((p) => p.name?.trim() === PIPELINE)
check(`pipeline "${PIPELINE}" exists`, !!pipeline)
if (pipeline) {
  console.log(`      GHL_PIPELINE_ID=${pipeline.id}${process.env.GHL_PIPELINE_ID?.trim() === pipeline.id ? '  (matches .env.local)' : ''}`)
  const gaps = missing(STAGES, pipeline.stages.map((s) => s.name.trim()))
  check('all 8 stages, exact names', gaps.length === 0, gaps.join(', '))
}

const fields = await get(`/locations/${encodeURIComponent(LOCATION)}/customFields?model=contact`)
if (fields.status === 200) {
  const gaps = missing(FIELDS, fields.body.customFields.map((f) => f.fieldKey))
  check(`${FIELDS.length} contact fields contact.bt_*`, gaps.length === 0, gaps.join(', '))
} else console.log(`SKIP  contact fields (HTTP ${fields.status}; scope locations/customFields.readonly)`)

const tags = await get(`/locations/${encodeURIComponent(LOCATION)}/tags`)
if (tags.status === 200) {
  const gaps = missing(TAGS, tags.body.tags.map((t) => t.name))
  check(`${TAGS.length} bt- tags`, gaps.length === 0, gaps.join(', '))
} else console.log(`SKIP  tags (HTTP ${tags.status}; scope locations/tags.readonly)`)

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
