# AI calling (ElevenLabs)

An ElevenLabs voice agent calls leads who left a purchase unfinished, **only** if they ticked the optional
communications box, whose text names the AI calls explicitly. Supabase is the source of truth; GoHighLevel gets tags; nothing depends on /admin being open.

```
lead (Supabase) → eligibility (at run time) → call.attempt job → ElevenLabs outbound call
   → post-call webhook (or read-back) → calls table + lead state → ghl.call job (tags) → /admin/leaduri
```

## Legal basis (Romania / EU) — read before enabling

- **Legea 506/2004, art. 12**: commercial communications through automated calling systems without human
  intervention require the subscriber's **prior express consent**. An AI agent is such a system. Since
  14.10.2026 one optional box (`src/lib/consent/communications.ts`, version `comms-2026-10-14`) names both
  channels, email and AI calls, and records two separate consents; never pre-ticked, never required, never
  implied by the terms, an older email-only consent, the price form or an order. The conditions are the
  "Comunicări comerciale" section of the terms (`/terms-of-service#comunicari`, linked from the footer). Consent is logged by phone
  number (`call_consent_events`: text version, source, page, time); refusal during a call, an admin, or an
  email unsubscribe withdraw it.
- **GDPR**: consent (art. 6(1)(a)); privacy policy section "Apeluri de la asistentul AI"; ElevenLabs and
  Twilio as processors (DPAs and transfer safeguards must be in place in both accounts).
- **EU AI Act, art. 50(1)** (applies from 2 Aug 2026): people must be told they are talking to an AI. The
  first sentence of every call says so.
- **No recording**: the outbound call requests no recording; the agent is set to `record_voice: false` and
  30-day retention on ElevenLabs. The app stores outcome, timings and ids only — never the transcript.
- Calling window: weekdays 8–21 Europe/Bucharest (only +40 numbers are called), at most 3 attempts.
- **A lawyer should confirm** the consent text and the processor setup before real calls start.

## The two scenarios

| Scenario | Lead | First call after the last activity |
|---|---|---|
| A: cart (main site, or a checkout on acces) | checkout contact step with a cart, a phone and the calling box | `AI_CALL_DELAY_VISIBLE_MINUTES` (20) |
| B: price form (acces.biohack-tech.ro) | the price form with a phone and the calling box (no cart needed) | `AI_CALL_DELAY_GATED_MINUTES` (30) |

The agent is told which one it is (`abandonment_type`: `cos_nefinalizat` / `oferta_solicitata`) and opens with a
sentence built by the server (`opening_line`): for B it names the product asked for and never mentions a cart.

**Test mode**: `AI_CALLING_TEST_MODE=true` + `AI_CALLING_TEST_NUMBERS=+40…` → only listed numbers are called, and
only they get the 2-minute delay (`AI_CALLING_TEST_DELAY_MINUTES`, max 10). Test mode without a list calls nobody.

## The recovery offer (made by the server, never by the agent)

Just before dialing (`src/server/calling/offer.ts`): one personal code per lead (`BTxxxxxx`, 10%, valid 24 hours,
one use, only for the lead's email, dead once that address buys anything; like every promo code it adds to the
automatic promotions: 10% of the full price on top, so 3 × Calm is 20% + 10% = 30%). The code email goes out
at the same moment, only with email marketing consent in force (and `RECOVERY_TEST_RECIPIENTS`, if set); it counts
as the lead's first recovery email, so the regular sequence never sends one on top of it (its first step waits
while a call is due). The agent gets `recovery_email_sent` = da/nu and says "găsiți codul pe email" only for da.
Without consent the agent may offer to send it; a yes (`wants_link`) sends that one email after the call. The
email's link (`/api/lead/resume?t=…&cod=…`) restores the selection and fills the code into the checkout.
Personal codes are not listed in /admin/coduri; /admin/leaduri shows them per call.

## Server tools (`/api/calling/tools/<name>`)

`get_recovery_context`, `check_discount`, `recovery_email_status`, `record_outcome`, `request_human_follow_up`
(email to orders@), `record_opt_out` (call consent and email marketing withdrawn at once, pending jobs skipped).
Header `x-biohack-tool-secret` = `ELEVENLABS_TOOL_SECRET` (stored in ElevenLabs as a workspace secret by the
setup script; the route is 404 without it). Only a call that is ringing or in progress answers; `call_id: "test"`
returns sample data and writes nothing (for the dashboard test). The agent cannot touch orders, payments,
invoices or codes.

## Eligibility (checked when each attempt runs)

Calling on · lead not disabled · no order / purchase (any device, same email) · valid Romanian number ·
call consent in force · not unsubscribed from email · attempts left · not superseded by a later checkout
with its own consent · no other call for the same person in 7 days (the oldest lead owns the sequence) · never again after a real
conversation with the agent (same number or email, any lead) · test mode / test-number list · quiet for the
scenario's delay · inside the calling window
(otherwise the attempt waits for the next window).

After a call: `opted_out` → call consent and email marketing withdrawn, stop · `not_interested` / `invalid_number` → stop ·
`no_answer` / `busy` / `technical_failure` → second attempt after `AI_CALLING_RETRY_HOURS` (1 h), third the next day at the same time (each moved into the window),
then stop · a provider timeout or 5xx → status `unknown`, **never redialed automatically** (an admin decides).

## Outcomes

`interested`, `more_info`, `human_follow_up`, `not_interested`, `opted_out`, `no_answer`, `busy`,
`invalid_number`, `technical_failure` (+ `follow_up`, `opted_out`, `wants_link` flags). `wants_link` sends
the product (or restored cart) link by email, on request.

GHL tags: `bt-apel-ai`, `bt-apel-ai-<outcome>`, `bt-apel-ai-urmarire`, `bt-apel-ai-refuz`, `bt-interes-*`.
Contact upsert by email (no duplicates), no opportunity.

## The agent

`src/server/calling/agent.ts` builds the instructions and the knowledge (catalog prices and variants,
approved product content, promotions, payment, delivery, returns and warranty pages). The generated payload
is `docs/ai-calling/agent.json`, kept in sync by a test (`UPDATE_AGENT_JSON=1 npx vitest run
tests/server/calling.test.ts` after a content change).

## Activation steps (nothing is bought by the app)

1. ElevenLabs account with an API key (`ELEVENLABS_API_KEY`, in `.env.local` for the script and in Vercel
   Production). The free plan's credits do not include telephony; calls cost per minute.
2. `node scripts/elevenlabs-agent.mjs voices` → the Romanian voice → `ELEVENLABS_VOICE_ID`; a random
   `ELEVENLABS_TOOL_SECRET` (≥ 24 chars, also in Vercel Production); `node scripts/elevenlabs-agent.mjs push`
   creates the voice, tools, knowledge base and the agent "BiohackTech — AI Recovery Agent" (matched by exact name; no other agent is touched) →
   `ELEVENLABS_AGENT_ID`. Run `push` again after a content change (it then updates that agent).
3. The number already connected in ElevenLabs: `node scripts/elevenlabs-agent.mjs phone-numbers` →
   `ELEVENLABS_PHONE_NUMBER_ID` and `ELEVENLABS_PHONE_PROVIDER` (`twilio` or `sip_trunk`).
4. ElevenLabs → Agents settings → post-call webhook `https://biohack-tech.ro/api/webhooks/elevenlabs`
   (events: transcription and call initiation failure; no audio) → `ELEVENLABS_WEBHOOK_SECRET`.
5. Vercel Production: `AI_CALLING_ENABLED=true`, keep `AI_CALLING_DRY_RUN=true` first; check
   /admin/leaduri shows "simulat (dry run)" for a test lead.
6. Controlled test: `AI_CALLING_TEST_MODE=true`, `AI_CALLING_TEST_NUMBERS=+40…` (the approved test number),
   `AI_CALLING_DRY_RUN=false`; a cart on biohack-tech.ro (A) and the price form on acces (B) with that number and
   the call box ticked; each call comes after 2 minutes. Verify the call, the code email, the outcome in admin
   and the GHL tags.
7. Only after legal confirmation: remove `AI_CALLING_TEST_MODE` and `AI_CALLING_TEST_NUMBERS`.
