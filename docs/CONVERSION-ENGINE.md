# Conversion engine (leads, price-gated funnel, recovery, Meta)

Two funnels on one app, one database, one checkout:

| | Funnel A: visible price | Funnel B: price after a form |
|---|---|---|
| Where | biohack-tech.ro, calm./focus./amber. landings | acces.biohack-tech.ro (`/`, `/calm`, `/focus`, `/amber`) |
| Price | always visible | after name, email, phone (server HTML has no price) |
| Lead | checkout contact step (progressive) | the form, plus the checkout step |
| Order attribution | `funnel: visible_price` | `funnel: gated_price` |

The gate is a conversion experiment, not a secret: prices are public on the main site and in the JS bundle.

## Switches (Vercel env, Production; each independent, on only with `true`)

| Variable | Does | Notes |
|---|---|---|
| `PRICE_GATE_ENABLED` | serves acces.<domain> | off: its pages 307 to the same product on the main site; order/recovery/unsubscribe links keep working |
| `ABANDONED_CHECKOUT_ENABLED` | stores checkout contact steps as leads, marks abandonment | sends nothing by itself |
| `RECOVERY_EMAIL_ENABLED` | sends the 2 recovery emails (own SMTP) | only to leads with marketing consent; see checklist below |
| `META_PIXEL_ENABLED` | loads Meta Pixel 967887562483664 (since 15.10.2026) after marketing-cookie consent | build-time: change, then redeploy |
| `META_CAPI_ACCESS_TOKEN` | server Purchase (Conversions API) when an order is paid; same event id as the pixel | runtime; absent: skipped, orders still complete |
| `META_CAPI_TEST_EVENT_CODE` | optional; those server events show in Events Manager → Test Events | from Events Manager → Test Events |
| `RECOVERY_FIRST_MINUTES` / `RECOVERY_SECOND_HOURS` | delays (30 / 24) | second email waits at least half its delay after the first |
| `RECOVERY_TEST_RECIPIENTS` | activation test mode: only these addresses get recovery emails | remove (and redeploy) to send to every eligible lead; leads whose first step ran in test mode are never emailed later |

## Lead lifecycle

`lead` (form) → `checkout_started` → `ordered` (COD/transfer at placement, card when paid) → `purchased` (payment confirmed).
One row per (browser `bt_vid`, funnel, product); a checkout is product `cart`. Stage only moves forward; consent is never downgraded by a later unticked box.
Abandonment: `lead_abandoned` (saw the price, no checkout) or `checkout_abandoned`. Recorded even when no email may go out.

Recovery stops (rechecked at send time) when: the person ordered (any device, same email), withdrew consent / unsubscribed, the lead has an unpaid card order (the order's own recovery covers it), another lead of the same person got a recovery email in the last 7 days, the visitor is still active, or a switch is off. Never from GoHighLevel: the CRM only gets contact + tags (`bt-lead`, `bt-lead-acces|site`, `bt-lead-checkout`, `bt-lead-convertit`, `bt-interes-*`), no opportunity, no `bt-recuperare-eligibil`.

Retention: leads without an order are deleted 12 months after the last activity (cron `/api/jobs/run`).

## Before turning on RECOVERY_EMAIL_ENABLED

1. Place a test lead on acces with marioxsrb@gmail.com, tick consent, leave; check the email arrives after ~30 min (SMTP log `email.sent`), link opens the product unlocked, unsubscribe works.
2. Unsubscribe, start again: no email (admin → Leaduri shows "oprită").
3. Order with the same email: no further email.

## Meta Pixel

Events: PageView (on load, every host: main site, calm/focus/amber, acces), ViewContent (product page and each landing, including Amber), AddToCart, InitiateCheckout, AddPaymentInfo, Lead (only after the server stored it; eventID = lead id), Purchase (only a confirmed payment; eventID = order number; value in lei, currency RON, contents, content_ids, num_items). Custom: PriceRevealClick, LeadFormStart, PriceRevealed, OrderPlaced (COD / unpaid transfer, not a Purchase), RecoveryVisit.
The browser Purchase is not marked sent until marketing consent allows it, so accepting the cookie banner on the order page still fires it. Cash on delivery and an unpaid transfer do not send Purchase; the server sends it when the money is confirmed.
**Conversions API** (`META_CAPI_ACCESS_TOKEN`): on `payment.confirmed` (Stripe webhook, reconcile, or admin), one Purchase with the same event id, value and currency, hashed email and phone, and the checkout's fbp/fbc/IP/user agent. No token: the job is not queued. Set `META_CAPI_TEST_EVENT_CODE` to see it under Test Events.
**Meta Traffic permissions** (old pixel 826932839766824): on 14.10.2026 fbevents reported "826932839766824 is unavailable on this website due to its traffic permission settings" on biohack-tech.ro and acces.biohack-tech.ro. That id is ignored. The live pixel is 967887562483664. In Events Manager → the dataset → Settings → Traffic permissions, allow biohack-tech.ro and the subdomains acces., calm., focus., amber.

## A/B comparison

No automatic traffic split. Send comparable Meta ad sets (same budget/audience) to biohack-tech.ro/products/<p> and acces.biohack-tech.ro/<p>, then compare in admin → Leaduri (page loads, leads, reveals, checkouts, orders, paid, revenue). Meta's own split test can also randomize, but its attribution windows and modelled conversions will not match the admin numbers exactly.

## AI calling readiness (nothing calls)

Stored per lead: phone, `call_consent` (always false today: the form is not call consent), `contact_preference`, interest, funnel, stage, recovery status and last recovery. A future caller must only use leads with `call_consent = true` gathered by a separate, explicit opt-in.
