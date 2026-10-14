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
| `META_PIXEL_ENABLED` | loads Meta Pixel 826932839766824 after marketing-cookie consent | build-time: change, then redeploy |
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

Events: PageView (on load), ViewContent (product/landing), AddToCart, InitiateCheckout, AddPaymentInfo, Lead (only after the server stored it; eventID = lead id), Purchase (only a confirmed payment; eventID = order number). Custom: PriceRevealClick, LeadFormStart, PriceRevealed, OrderPlaced (COD / unpaid transfer, `payment_method`), RecoveryVisit.
**Meta Traffic permissions:** on 14.10.2026 fbevents reported "826932839766824 is unavailable on this website due to its traffic permission settings" on biohack-tech.ro and acces.biohack-tech.ro: the pixel loads (after consent) but sends nothing. Fix in Events Manager → the dataset → Settings → Traffic permissions: allow biohack-tech.ro (and its subdomains acces., calm., focus., amber.), or remove the blocklist entry. No redeploy needed.
Not yet: server-side Conversions API (so ad blockers and missing consent lose events), Purchase for COD at delivery. Verify in Events Manager → Test events before relying on it.

## A/B comparison

No automatic traffic split. Send comparable Meta ad sets (same budget/audience) to biohack-tech.ro/products/<p> and acces.biohack-tech.ro/<p>, then compare in admin → Leaduri (page loads, leads, reveals, checkouts, orders, paid, revenue). Meta's own split test can also randomize, but its attribution windows and modelled conversions will not match the admin numbers exactly.

## AI calling readiness (nothing calls)

Stored per lead: phone, `call_consent` (always false today: the form is not call consent), `contact_preference`, interest, funnel, stage, recovery status and last recovery. A future caller must only use leads with `call_consent = true` gathered by a separate, explicit opt-in.
