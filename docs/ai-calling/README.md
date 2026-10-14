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
- Calling window: weekdays 10–19 Europe/Bucharest (only +40 numbers are called), at most 2 attempts.
- **A lawyer should confirm** the consent text and the processor setup before real calls start.

## Eligibility (checked when each attempt runs)

Calling on · lead not disabled · no order / purchase (any device, same email) · valid Romanian number ·
call consent in force · not unsubscribed from email · attempts left · not superseded by a later checkout
with its own consent · no other call for the same person in 7 days (the oldest lead owns the sequence) ·
test-number list (if set) · quiet for `AI_CALLING_FIRST_DELAY_MINUTES` · inside the calling window
(otherwise the attempt waits for the next window).

After a call: `opted_out` → consent withdrawn, stop · `not_interested` / `invalid_number` → stop ·
`no_answer` / `busy` / `technical_failure` → one more attempt after `AI_CALLING_RETRY_HOURS` (in the window),
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
2. `node scripts/elevenlabs-agent.mjs voices` → pick a Romanian voice, add it to the account, set
   `ELEVENLABS_VOICE_ID`; `node scripts/elevenlabs-agent.mjs push` → set `ELEVENLABS_AGENT_ID`.
3. A phone number able to call Romania: a Twilio number (purchased in Twilio, imported in ElevenLabs →
   Phone numbers) or a SIP trunk. `node scripts/elevenlabs-agent.mjs phone-numbers` → `ELEVENLABS_PHONE_NUMBER_ID`.
4. ElevenLabs → Agents settings → post-call webhook `https://biohack-tech.ro/api/webhooks/elevenlabs`
   (events: transcription and call initiation failure; no audio) → `ELEVENLABS_WEBHOOK_SECRET`.
5. Vercel Production: `AI_CALLING_ENABLED=true`, keep `AI_CALLING_DRY_RUN=true` first; check
   /admin/leaduri shows "simulat (dry run)" for a test lead.
6. Controlled test: `AI_CALLING_TEST_NUMBERS=+40…` (the approved test number), `AI_CALLING_DRY_RUN=false`;
   create a test lead with that number and the call box ticked; verify the call, the outcome in admin and
   the GHL tags.
7. Only after legal confirmation: remove `AI_CALLING_TEST_NUMBERS`.
