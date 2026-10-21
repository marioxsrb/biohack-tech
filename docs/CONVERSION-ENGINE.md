# Conversion engine (checkout leads, recovery, Meta)

One funnel: biohack-tech.ro and the calm./focus./amber. landings, one database, one checkout. Prices are always
visible; a lead is the checkout's contact step (progressive).

The price-gated funnel on acces.biohack-tech.ro was closed on 20.10.2026: the hostname only 308-redirects to the
same path on the main site (old `/<slug>` addresses go to `/products/<slug>`), so order, recovery and unsubscribe
links already sent keep working. Its leads (stage `lead`) stay as history: no recovery email and no AI call for
them (migration `028_close_acces_funnel`). The DNS record and the Vercel domain can be removed once those links
no longer matter.

## Switches (Vercel env, Production; each independent, on only with `true`)

| Variable | Does | Notes |
|---|---|---|
| `ABANDONED_CHECKOUT_ENABLED` | stores checkout contact steps as leads, marks abandonment | sends nothing by itself |
| `RECOVERY_EMAIL_ENABLED` | sends the 3 recovery emails of an abandoned cart (own SMTP) | only to leads with marketing consent; see checklist below |
| `META_PIXEL_ENABLED` | loads Meta Pixel 967887562483664 (since 15.10.2026) after marketing-cookie consent | build-time: change, then redeploy |
| `META_CAPI_ACCESS_TOKEN` | server Purchase (Conversions API) when an order is paid; same event id as the pixel | runtime; absent: skipped, orders still complete |
| `META_CAPI_TEST_EVENT_CODE` | optional; those server events show in Events Manager → Test Events | from Events Manager → Test Events |
| `RECOVERY_FIRST_MINUTES` / `RECOVERY_SECOND_HOURS` | delays (30 / 24) | second email waits at least half its delay after the first |
| `RECOVERY_TEST_RECIPIENTS` | activation test mode: only these addresses get recovery emails | remove (and redeploy) to send to every eligible lead; leads whose first step ran in test mode are never emailed later |

## Lead lifecycle

`checkout_started` → `ordered` (COD/transfer at placement, card when paid) → `purchased` (payment confirmed).
One row per browser (`bt_vid`) checkout (product `cart`). Stage only moves forward; consent is never downgraded by a later unticked box.
Abandonment: `checkout_abandoned`, recorded even when no email may go out. (`lead` / `lead_abandoned` exist only on the old acces rows.)

Recovery stops (rechecked at send time) when: the person ordered (any device, same email), withdrew consent / unsubscribed, the lead has an unpaid card order (the order's own recovery covers it), another lead of the same person got a recovery email in the last 7 days, the visitor is still active, or a switch is off. Never from GoHighLevel: the CRM only gets contact + tags (`bt-lead`, `bt-lead-site`, `bt-lead-checkout`, `bt-lead-convertit`, `bt-interes-*`), no opportunity, no `bt-recuperare-eligibil`.

Retention: leads without an order are deleted 12 months after the last activity (cron `/api/jobs/run`).

## Before turning on RECOVERY_EMAIL_ENABLED

1. Start a checkout with marioxsrb@gmail.com, tick consent, leave; check the email arrives after ~30 min (SMTP log `email.sent`), the link puts the cart back, unsubscribe works.
2. Unsubscribe, start again: no email (admin → Leaduri shows "oprită").
3. Order with the same email: no further email.

## Meta Pixel

Events: PageView (on load, every host: main site, calm/focus/amber), ViewContent (product page and each landing, including Amber), AddToCart, InitiateCheckout, AddPaymentInfo, Purchase (only a confirmed payment; eventID = order number; value in lei, currency RON, contents, content_ids, num_items). Custom: OrderPlaced (COD / unpaid transfer, not a Purchase), RecoveryVisit.
The browser Purchase is not marked sent until marketing consent allows it, so accepting the cookie banner on the order page still fires it. Cash on delivery and an unpaid transfer do not send Purchase; the server sends it when the money is confirmed.
**Conversions API** (`META_CAPI_ACCESS_TOKEN`): on `payment.confirmed` (Stripe webhook, reconcile, or admin), one Purchase with the same event id, value and currency, hashed email and phone, and the checkout's fbp/fbc/IP/user agent. No token: the job is not queued. Set `META_CAPI_TEST_EVENT_CODE` to see it under Test Events.
**Meta Traffic permissions** (old pixel 826932839766824): on 14.10.2026 fbevents reported "826932839766824 is unavailable on this website due to its traffic permission settings" on biohack-tech.ro and acces.biohack-tech.ro. That id is ignored. The live pixel is 967887562483664. In Events Manager → the dataset → Settings → Traffic permissions, allow biohack-tech.ro, www.biohack-tech.ro, the subdomains calm., focus., amber., and the international site biohack-tech.net and www.biohack-tech.net (the pixel runs there too). InitiateCheckout and AddPaymentInfo report their value in lei on every site, like Purchase (21.10.2026); the Conversions API reports a .net Purchase with its own .net address.

## AI calling

Stored per lead: phone, `call_consent` (only from the explicit communications box in the checkout), interest, stage, recovery status and last recovery. The caller only uses leads with `call_consent = true` (see docs/ai-calling/README.md).
