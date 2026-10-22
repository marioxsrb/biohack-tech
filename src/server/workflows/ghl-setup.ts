/**
 * What the Biohack Tech GoHighLevel sub-account needs for the email workflows (ghl-map.ts), as data: its contact
 * fields and tags. `scripts/ghl-wf-setup.mjs` reads the same list from scripts/ghl-wf-spec.json (kept equal by a test)
 * and, only with --apply and the sub-account's own credentials, creates what is missing. Never the shared NEUROS
 * location: the script refuses a location id equal to GHL_LOCATION_ID or GHL_BRAINEVENT_LOCATION_ID.
 */
import { ALL_TEMPLATES } from '@/config/workflows'
import { INTEREST_SEGMENT, WORKFLOW_FIELDS, sendTag } from './ghl-map'

/** Events the store marks on the contact (purchase, abandonment, rewards, referral, VIP), beside the per-email tags. */
export const EVENT_TAGS = ['bt-wf-cumparat', 'bt-wf-abandon', 'bt-wf-plata-esuata', 'bt-wf-recompensa', 'bt-wf-recomandare', 'bt-wf-vip', 'bt-wf-dezabonat'] as const

export function ghlWorkflowSpec() {
  return {
    fields: Object.values(WORKFLOW_FIELDS).map((key) => ({ key, name: key.replace(/^contact\./, ''), dataType: 'TEXT' as const })),
    tags: [...ALL_TEMPLATES.map(sendTag), ...Object.values(INTEREST_SEGMENT), ...EVENT_TAGS],
  }
}
