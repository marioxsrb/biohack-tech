# Biohack Tech: production launch runbook

Written 26 September 2026 against commit “Launch pass”; updated 29 September 2026 for phase 3/4 (product 4, advertising landings, attribution, returns) and phase 3.5 (homepage, promotions, post-purchase offer, contact form). Everything below refers to code that exists in this repository. Items marked **YOU** need an account, a credential or a business decision; nothing in them has been invented.

---

## 1. Current status

| Area | Status |
|---|---|
| Storefront (home, 4 product pages, cart page, checkout, order page, legal, 404) | Built, tested at 390/430/768/1024/1280/1440 |
| Prices | NEUROS Calm 6.380 lei, NEUROS Amber 315 lei (approved), NEUROS Focus 2.490 lei (from source, confirm), NEUROS Flow 12.900 / 14.900 / 13.900 lei for 1 / 4 / 13 zones (from the previous site, **confirm**, §28) |
| Advertising landings (4, one per product) | Built: `/lp/<slug>` locally, `<slug>.biohack-tech.ro` in production through host routing (§26); DNS not changed |
| Attribution (landing + UTM → order → GHL) | Built; `contact.bt_last_order_source` in GHL |
| Canonical orders (PostgreSQL) | Built and tested (PGlite + real PostgreSQL concurrency tests) |
| Card payments (Stripe Payment Element, own checkout) | Built; **verified in Stripe TEST mode** with real test payments and real webhooks (`scripts/stripe-e2e.mjs`, 19/19). Needs live keys + live webhook for production |
| Bank transfer | Built and tested end to end; real bank details verified locally (IBAN checksum, checkout, order page, instructions email). Production host needs the same `BANK_*` values |
| FGO invoices | Built to the official FGO API v7.1 spec; tested against a mock (idempotency, outage, rejection). **Needs FGO API credentials; never called against FGO yet** |
| GoHighLevel CRM + transactional email | Built on API v2 (2021-07-28); tested against a mock (idempotency, outage, permanent rejection, retry). **Needs token, location, pipeline, fields, sending domain; never called against GHL yet** |
| Operations (/admin) | Built: orders, payment confirmation for transfers, shipping + AWB, delivery, cancel, refunds for transfers, failed-sync retry |
| Courier integration | Manual provider behind an adapter boundary (`src/server/fulfillment/courier.ts`); no courier chosen, none invented. AWB entered by hand in /admin |
| Returns | Built: withdrawal → return requested (tag `bt-retur-solicitat`) → return received in /admin (email + tag `bt-retur-primit`) → refund (Stripe / recorded) → W7 (§29) |
| Cookie consent | Built: banner + preferences + real script blocking (GA4, Clarity, Meta registry), proof log; no tool configured yet |
| Email marketing consent, recovery, unsubscribe | Built: proof in DB, consent-gated recovery tag/link, unsubscribe page, GHL sync (§15) |
| Legal pages + online withdrawal | Built (§16); company data and legal review pending |
| GHL workflows W1–W7 | **Created in Kerrsid (NEUROS), folder “BiohackTech Ecommerce”, all Draft, 0 enrolled.** Missing actions isolated (§10.5) |

**The store is not live-ready until the P0 items in §24 are done.** Most of them are accounts and credentials, not code.

## 2. What is complete

- One source of truth for prices: `src/config/prices.ts` (integer bani, VAT included). Everything reads it: listings, product pages, cart, checkout, server total, Stripe amount, FGO lines, GHL value, emails, JSON-LD.
- Cart: `/cart` page (no drawer). Add to cart → check + “Adăugat în coș” → compact confirmation top right (desktop) / bottom card (phone), with “Finalizează comanda” and “Continuă cumpărăturile”. The cart persists in localStorage as ids + quantities only and is re-priced from the catalog on every load.
- Checkout: contact, billing (persoană fizică / juridică with CUI check digit), delivery (same address by default), payment (card or bank transfer), order summary, terms + optional marketing consent (separate, unticked, with proof stored). The draft survives a refresh (sessionStorage only).
- Server: the browser sends ids, quantities and the form; the server prices the order, stores a snapshot, and creates the Stripe PaymentIntent for exactly that total.
- Payment truth: only Stripe can mark a card order paid: the signed webhook, or the `stripe.reconcile` job (server-side retrieve, 10 minutes after the order and again before an order is marked abandoned) if the webhook was lost. The order page only reads; it never marks payments or starts workflows. Bank transfers become paid only when a person confirms the statement in /admin.
- Side effects (CRM, invoice, email) go through a database outbox with unique keys: retried with backoff, never duplicated, visible in /admin when they fail.
- Transactional emails are rendered by the site (HTML + text) and delivered through GoHighLevel.
- 200 automated tests + 4 on real PostgreSQL (promotion matrix and integer rounding, discounted orders across Stripe / transfer / FGO / GHL / email, post-purchase offer incl. double click, SCA, decline, card declined, expiry, access control, contact form incl. validation, spam, rate limit and CRM outage, landing host mapping and proxy, NEUROS Flow variants and server pricing, payment matrix per configuration and method, attribution, fulfillment and return lifecycle, recovery with a variant, consent, recovery eligibility, unsubscribe, cookie script blocking, withdrawal, money, cart, validation, order state machine, idempotency, webhook route and signatures, browser-closed payment, reconciliation, FGO/GHL mapping, email rendering, outbox retries and outages, abandonment, transfer expiry, admin authorization, the real four-product catalog end to end, concurrency on PostgreSQL) + `scripts/stripe-e2e.mjs` against Stripe test mode.
- /admin: HTTP Basic Auth in the proxy **and** inside every admin action (actions are HTTP endpoints; each verifies the credentials itself). Only bank transfers can be marked paid by a person; card money is confirmed by Stripe only.

## 3. What is blocked, and by what

| Blocked | By | Effect until provided |
|---|---|---|
| Any online order in production | `DATABASE_URL` | Checkout shows “comenzile online se activează în curând” with email/phone |
| Card payments | Stripe live account + 3 keys + webhook | “Card bancar” shows “În curând” |
| Bank transfer | Beneficiary, bank, IBAN | “Transfer bancar” shows “În curând” |
| Automatic invoices | FGO API user, private key, series, VAT rate | Orders show “Factură: Manual” in /admin |
| CRM + all customer emails | GHL token, location, pipeline, fields, sending domain | No confirmation emails (**P0**) |
| Legal readiness | Company data (`COMPANY_*`), legal review (OPEN-POINTS) | Pages exist; identification missing on the site (**P0**) |

## 3a. Operational lifecycle (what happens after each change)

Every change of an order or payment is one database transaction that also writes an event (`order_events`) and the resulting side effects as outbox jobs (`jobs`, unique `dedupe_key`). Integrations consume those jobs; nothing depends on the browser, the order page, localStorage or query parameters.

| Canonical change | Event | FGO | GoHighLevel | Email (site, via GHL) |
|---|---|---|---|---|
| Card order created | `order.created` | – | – (a card attempt reaches the CRM only when paid or abandoned) | – |
| Transfer order created | `order.created` | – | contact + opportunity in `Așteaptă transferul` | `transfer_instructions` (beneficiary, IBAN, bank, amount, order number as reference) |
| Card paid (Stripe webhook or `stripe.reconcile`) | `payment.confirmed` | invoice (`fgo.invoice`) | contact, tags, opportunity → `Plătită, de pregătit` (won) | `order_confirmed`; `invoice_issued` after FGO |
| Transfer confirmed by a person in /admin | `payment.confirmed` | invoice if `FGO_TRANSFER_INVOICE=on_payment` (default) | → `Plătită, de pregătit` | `payment_received`; `invoice_issued` after FGO |
| Card payment failed | `payment.failed` | – | – (the customer is still on the checkout and can retry) | – (failure is shown in the checkout; no email spam) |
| Card payment cancelled in Stripe | `payment.cancelled` | – | stage update only if an opportunity already exists | – |
| Unpaid card order after `ABANDON_AFTER_MINUTES` | `order.abandoned` | – | → `Plată nefinalizată` (status abandoned) | – from the site; the recovery decision is stored on the order; tag `bt-recuperare-eligibil` + GHL W2 only with marketing consent |
| Unpaid transfer after `TRANSFER_EXPIRY_DAYS` (off by default) | `order.cancelled` | – | → `Anulată` | `order_cancelled` |
| Shipped / delivered / cancelled / refunded in /admin or Stripe | `order.*` / `payment.refunded` | storno only with `FGO_AUTO_STORNO=true` | stage update | `order_shipped` / `order_cancelled` / `refund_issued` |

The team is notified by GHL workflow W1 (opportunity created / stage `Plătită, de pregătit`) and always sees everything in /admin.

**Idempotency.**
- Each side effect has a dedupe key, e.g. `fgo.invoice:<order>`, `email:order_confirmed:<order>`, `ghl.sync:<order>:<event>`. A repeated webhook, reconciliation or admin click finds the order already moved and queues nothing.
- **FGO:** never called again once an invoice number is stored; FGO itself refuses a second invoice for the same `IdExtern`.
- **GHL:** the contact is upserted; the opportunity is found by stored id or by the order number.
- **Emails:** sent once per template and order. Delivery is at least once: if a server dies after GHL accepted an email but before the job was marked done, the retry can send it again. This is rare, and preferred to losing a confirmation.

**Abandoned checkout policy.**
- A card order still unpaid `ABANDON_AFTER_MINUTES` (default 60) after it was created is checked by the `order.abandon_check` job.
- **Stripe first:** the job first asks Stripe (`stripe.reconcile`). A payment whose webhook was lost is confirmed instead, and an order that is paid is never abandoned.
- **Stripe unreachable:** the check retries rather than guessing.
- **Kept, not deleted:** abandoned orders stay for history and can still be paid later (`abandoned → confirmed`). If the same customer has paid another order since, the attempt is closed quietly (`order.superseded`).
- **Bank transfers** are never abandoned. They wait for the transfer, with the GHL W3 reminder at 48 h. Optionally, `TRANSFER_EXPIRY_DAYS` cancels them automatically after N days, with an email. It is off until you decide the number of days.

**Retries and failures.**
- **Retry state:** jobs retry with backoff (1, 2, 4… minutes, up to 6 h) for 8 attempts. Status, attempts and the last error are stored per job and shown in /admin.
- **Permanent errors are not retried blindly:** FGO refusals and GHL 4xx other than 401/404 stop at once, as `failed`, for a person.
- **Payments are never touched:** an FGO, GHL or email failure never changes a payment or order state.
- **Manual retry:** "Reîncearcă" in /admin (per job, per order, or all) puts failed jobs back. It is safe for the idempotency reasons above.

**Verified vs not yet verified (29.09.2026).**
- **Verified:**
  - Stripe test mode, with real test payments and webhooks;
  - bank transfer with the real bank details (locally: checkout, order page, instructions email content);
  - all job logic against HTTP-level mocks of FGO and GHL.
- **Not verified:** FGO and GoHighLevel have never been called with real credentials. Run §20 on staging with the FGO test account and a GHL sub-account before going live.

## 4. Required accounts

| Service | Why | Plan / access | Credential needed |
|---|---|---|---|
| **Railway** (recommended host; you already deploy there) | Runs the Next.js server and the job runner every minute | Hobby or Pro | GitHub repo access |
| **Railway PostgreSQL** | Canonical orders | Same project | `DATABASE_URL` (reference variable) |
| **Domain registrar / DNS** for biohack-tech.ro | Domain, email authentication | Existing | DNS edit access |
| **Stripe** | Card payments | Activated account (business verification done) | Secret key, publishable key, webhook secret |
| **FGO** | Invoices + e-Factura | **PRO or PREMIUM** (the API needs it in production) + a free test account on testuat.fgo.ro | CUI, API private key, series |
| **GoHighLevel** | CRM, pipeline, email sending, marketing automations | The sub-account you use for Biohack Tech | Private Integration token, location id, pipeline id |
| **Monitoring** (recommended: Better Stack, free tier) | Uptime check + alerts | Free | none in the app (external check of /api/health) |
| Courier (your existing contract) | Deliveries | Existing | Nothing in the app yet (manual AWB) |
| Google Tag Manager / GA4 / Meta (later) | Analytics, ads | Free | Container / measurement / pixel ids |

Not needed: a separate email provider (GHL sends), Redis, a queue service, a CMS.

## 5. Required credentials (checklist)

- [ ] `STRIPE_SECRET_KEY` (sk_live_), `STRIPE_PUBLISHABLE_KEY` (pk_live_), `STRIPE_WEBHOOK_SECRET` (whsec_)
- [ ] Test equivalents for staging: sk_test_, pk_test_, whsec_ of the test-mode endpoint
- [ ] `FGO_COD_UNIC`, `FGO_PRIVATE_KEY`, `FGO_SERIE`, `FGO_VAT_RATE` (production), plus the same for the FGO test account
- [ ] `GHL_PRIVATE_TOKEN`, `GHL_LOCATION_ID`, `GHL_PIPELINE_ID`
- [ ] `BANK_BENEFICIARY`, `BANK_NAME`, `BANK_IBAN` (+ `BANK_SWIFT` if you want it shown)
- [ ] `ADMIN_PASSWORD` (12+ characters, from a password manager), `CRON_SECRET` (random, 32+ characters)
- [ ] `EMAIL_FROM` (an address on the domain verified in GHL)

## 6. Required API keys, by integration

| Provider | Purpose | Auth | Stored in | Endpoint / webhook | Test mode | Status |
|---|---|---|---|---|---|---|
| Stripe | Card payments, refunds | Secret key (server), publishable key (browser) | `STRIPE_*` | Webhook → `https://biohack-tech.ro/api/webhooks/stripe` | Test keys + test cards | Built, **needs keys** |
| FGO | Invoices, storno | SHA-1 hash of CUI + private key + client name | `FGO_*` | Calls `https://api.fgo.ro/v1/factura/emitere` (test: `https://api-testuat.fgo.ro/v1`) | Separate FGO test account | Built, **needs credentials** |
| GoHighLevel | Contacts, tags, opportunities, emails | Private Integration token, `Version: 2021-07-28` | `GHL_*` | Calls `https://services.leadconnectorhq.com`; no inbound webhook needed | A test contact in your sub-account (or a test sub-account) | Built, **needs token + setup** |
| PostgreSQL | Orders, outbox | Connection string | `DATABASE_URL` | – | Local database / staging database | Built, **needs provisioning** |

## 7. Required environment variables

Full, commented list: `.env.example`.

| Variable | Needed for | Available now |
|---|---|---|
| `APP_ENV=production` | Guards (live keys only, no local DB) | ✅ decide at deploy |
| `NEXT_PUBLIC_SITE_URL=https://biohack-tech.ro` | Links, return URLs | ✅ |
| `DATABASE_URL` | Orders | ❌ provision |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | Card | ❌ |
| `BANK_BENEFICIARY`, `BANK_NAME`, `BANK_IBAN`, `BANK_SWIFT` | Transfer | ❌ |
| `FGO_COD_UNIC`, `FGO_PRIVATE_KEY`, `FGO_SERIE`, `FGO_VAT_RATE`, `FGO_ENV=production` | Invoices | ❌ |
| `GHL_PRIVATE_TOKEN`, `GHL_LOCATION_ID`, `GHL_PIPELINE_ID` | CRM + email | ❌ |
| `EMAIL_TRANSPORT=ghl`, `EMAIL_FROM` | Emails | ❌ `EMAIL_FROM` |
| `ADMIN_USER`, `ADMIN_PASSWORD` | /admin | ❌ create |
| `CRON_SECRET` | External job trigger (optional on Railway) | ❌ create |
| Optional: `FGO_TRANSFER_INVOICE`, `FGO_AUTO_STORNO`, `ABANDON_AFTER_MINUTES`, `DATABASE_SSL`, `JOBS_INTERVAL` | Tuning | defaults are fine |

## 8. Stripe setup

**Architecture.** Our checkout embeds Stripe’s Payment Element (card fields in a Stripe iframe; card data never touches our server). On “Plătește”, the browser validates the card fields, our server creates the order and a PaymentIntent (amount = order total, currency RON, metadata `order_id` + `order_number`, idempotency key per order), the browser confirms it (3-D Secure included), and Stripe returns to `/comanda/<token>`. The PaymentIntent is **card only** (`payment_method_types: card`; Apple Pay / Google Pay count as cards). The order becomes paid on `payment_intent.succeeded` (webhook), or, if the webhook never arrives, when the `stripe.reconcile` job retrieves the PaymentIntent server-side; both use the same idempotent transition. The order page (`/comanda/<token>`) only displays the database state and refreshes itself while the payment is being confirmed; a customer who closes the browser right after paying still gets a paid order. Reusing an attempt never offers a second payment: a PaymentIntent that is already `succeeded`/`processing` sends the customer to the order page, and one that does not match the order (amount, currency, `metadata.order_id`) is refused.

**Checklist (YOU):**
1. Stripe account activated (business details, bank account for payouts, identity verification). Settlement currency: RON.
2. Settings → Payment methods: enable **Cards**; optionally **Apple Pay** and **Google Pay**.
3. Settings → Payment method domains: add `biohack-tech.ro` (and `www` if used). Needed for Apple Pay.
4. Developers → Webhooks → Add endpoint `https://biohack-tech.ro/api/webhooks/stripe`, events **exactly**:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.refunded`
   Copy its signing secret → `STRIPE_WEBHOOK_SECRET`. Each processed event is stored in `webhook_events` with its outcome (`paid`, `failed`, `cancelled`, `refunded`, `amount_mismatch`, `intent_mismatch`, `order_not_found`, ...).
5. Developers → API keys → `STRIPE_SECRET_KEY` (secret) and `STRIPE_PUBLISHABLE_KEY` (the name `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is also accepted). A restricted key works too if it can write PaymentIntents and read PaymentIntents/Charges.
6. Repeat 4-5 in **test mode** for staging (separate endpoint on the staging URL, separate secret).
7. Settings → Emails: turn **off** Stripe’s own “successful payment” receipts (our confirmation already includes everything; avoids two emails).
8. Branding: logo/colours for the 3-D Secure screens (Settings → Branding).

**Refunds:** always from the Stripe Dashboard. The `charge.refunded` webhook updates the order (partial or full), moves the GHL opportunity to “Rambursată” on a full refund and emails the customer. See §16 for the invoice side.

## 9. FGO setup

**Architecture.** `src/server/integrations/fgo.ts`. One invoice per order, created by an outbox job:
- **Card orders:** after the payment is confirmed by Stripe.
- **Bank transfer:** after a person confirms the payment in /admin (`FGO_TRANSFER_INVOICE=on_payment`, default). Set `manual` if the accountant prefers issuing these by hand.
- Request: `Serie`, `Valuta=RON`, `TipFactura=Factura`, `IdExtern=<order number>` with `VerificareDuplicat=true` (FGO refuses a second invoice for the same order), client PF (name, county, city, address) or PJ (company, CUI, Reg. Com.), one line per product with `PretTotal` (VAT-inclusive total, so FGO computes the unit price and VAT exactly), `CotaTVA=FGO_VAT_RATE`, `UM=BUC`, `CodArticol=<product id>/<variant id>`.
- The invoice series/number/link are stored on the order; the job never calls FGO again once they exist. FGO allows 1 request/second; the client waits between calls.
- Temporary failures (network, FGO’s “timpul maxim… reîncercați”) retry with backoff (1, 2, 4… minutes, 8 attempts). A refusal (e.g. invalid data) marks the order **Factură: Eroare** in /admin for a person. The payment is never affected.
- After the invoice is issued the customer receives one email “Factura pentru comanda #…” with the FGO link (FGO does not email it through the API). The order page also shows “Descarcă factura”.

**Checklist (YOU):**
1. FGO subscription **PRO or PREMIUM** (API in production).
2. FGO → Setări → Utilizatori: create an **API user**, copy the private key → `FGO_PRIVATE_KEY`. `FGO_COD_UNIC` = your company CUI as registered in FGO.
3. FGO → Setări → Serii documente: a series for the online shop → `FGO_SERIE` (e.g. `BTW`). Registry defined for the API user.
4. VAT: confirm with the accountant that prices include 21% VAT → `FGO_VAT_RATE=21`. If the company is not a VAT payer, the value and the “TVA 21% inclus” text on the site (`src/config/site.ts`) must change together.
5. FGO → Setări → eCommerce → Setări API: enable search by external id (so repeated calls are recognised).
6. e-Factura: confirm in FGO that invoices are submitted to SPV automatically (B2B and B2C), per your accountant.
7. Articles: lines create/find articles by `CodArticol` (`balance-wave`, `brainlink-pro`, `ochelari-biohack/cat-eye-negru`…). If you use SAGA or a stock (gestiune), tell us the article codes and `CodGestiune` to send.
8. Test: create a free account on `https://testuat.fgo.ro/inregistrare`, use `FGO_ENV=test` on staging.

**Refunds / storno:** by default the accountant issues the storno in FGO (`FGO_AUTO_STORNO=false`). With `true`, a full Stripe refund triggers `factura/stornare` automatically. Partial refunds are always manual.

## 10. GoHighLevel setup

**Role.** GHL is the CRM, the sales pipeline, the team’s notification channel and the email sender. The website database stays the source of truth; GHL receives copies. Transactional emails are **rendered by the website** and sent through GHL (`POST /conversations/messages`), so they are triggered by real order events, exactly once. GHL workflows are used for internal notifications, reminders and marketing only.

### 10.1 Private Integration
Sub-account → Settings → **Private Integrations** → Create. Scopes:
- `contacts.readonly`, `contacts.write` (upsert contact, add tags)
- `opportunities.readonly`, `opportunities.write` (pipelines, search, create, update)
- `conversations.readonly`, `conversations.write`, `conversations/message.readonly`, `conversations/message.write` (send the emails)
- `locations/customFields.readonly`, `locations/tags.readonly` (optional, used only by `npm run ghl:check`)
Copy the token → `GHL_PRIVATE_TOKEN`. Location id (Settings → Business Profile) → `GHL_LOCATION_ID` (NEUROS: `xnf2JtFk46U23NG0lzwC`).

Then `npm run ghl:check` (read-only): it prints the pipeline id for `GHL_PIPELINE_ID` and checks stages, fields and tags.

Settings → General: **“Allow duplicate contact” off**, matching on email first. The site upserts by email/phone; with duplicates allowed GHL would create one contact per order. The NEUROS location is shared with courses and events: this setting is location-wide, so check with the owners of those funnels before changing it.

### 10.2 Pipeline “Comenzi Biohack Tech”
Create it with these stages **in this order and with these exact names** (the site finds stages by name; copy them from here):

| # | Stage (exact name) | Purpose | Entry (automatic, from the site) | Exit | Automation | Manual action | Order status | Payment status | Customer email (sent by the site) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `Așteaptă transferul` | Transfer orders waiting for money | Transfer order placed | Payment confirmed in /admin, or cancelled | W1 team notification; W3 reminder after 48 h, task at 5 days | Check the bank statement daily | pending | awaiting_transfer | “Comanda #…: datele pentru transfer” |
| 2 | `Plată nefinalizată` | Card checkout started, never paid | 60 min after an unpaid card order | Paid later → Plătită; closed if another order is paid | W2 recovery, only with the `bt-recuperare-eligibil` tag set by the site | none | abandoned | pending / failed | none from the site |
| 3 | `Plătită, de pregătit` | Paid, to pack | Stripe confirms, or transfer confirmed in /admin | Marked “în pregătire” or shipped | W1 team notification | Pack the order | confirmed | paid | Card: “Comanda ta Biohack Tech #…”. Transfer: “Am primit plata…”. Both: “Factura pentru comanda #…” |
| 4 | `În pregătire` | Being packed (optional) | “Marchează în pregătire” in /admin | Shipped | – | Create AWB at the courier | processing | paid | none |
| 5 | `Expediată` | At the courier | AWB entered in /admin | Delivered | – | – | shipped | paid | “Comanda #… a fost expediată” (courier, AWB, tracking link) |
| 6 | `Livrată` | Delivered | “Marchează livrată” in /admin | – | W6: P1 service email, specialist task (Calm/Focus), review request with consent only | – | delivered | paid | none from the site (GHL W6) |
| 7 | `Anulată` | Cancelled | Cancelled in /admin | – | – | Refund if it was paid | cancelled | any | “Comanda #… a fost anulată” (transfer or paid orders) |
| 8 | `Rambursată` | Fully refunded | Full refund in Stripe (webhook) or recorded in /admin | – | – | Storno in FGO | any | refunded | “Rambursare pentru comanda #…” |

Opportunity: name `BHT-20260929-0007 · Prenume Nume`, value = order total in lei (minus refunds), status `open` (waiting), `won` (paid and later), `lost` (cancelled/refunded), `abandoned`. One opportunity per order: its id is stored on the order, and a lost id is recovered by searching the order number, so retries never duplicate it. Copy the pipeline id → `GHL_PIPELINE_ID`.

### 10.3 Contact custom fields
Settings → Custom Fields → Contact, folder “BiohackTech Ecommerce” (all 15 exist in NEUROS since 29 Sep 2026; `npm run ghl:check` verifies). Create them so the **field keys** are exactly these (GHL derives the key from the name; name them `bt_customer_type` etc., then rename the label if you like; the key stays):

| Key | Type | Purpose | Source | Example |
|---|---|---|---|---|
| `contact.bt_customer_type` | Single line | PF / PJ | Checkout | Persoană juridică |
| `contact.bt_last_order_number` | Single line | Support, email merge | Order | BHT-20260929-0007 |
| `contact.bt_last_order_date` | Date (YYYY-MM-DD) | Timing of flows | Order | 2026-09-27 |
| `contact.bt_last_order_value` | Monetary / number | Value | Order total (lei) | 7010.00 |
| `contact.bt_last_order_products` | Multi-line | Segmentation, merge | Order lines | 1 x NEUROS Calm, 2 x NEUROS Amber (Unisex pătrat · Maro) |
| `contact.bt_last_payment_method` | Single line | Card / Transfer bancar | Order | Transfer bancar |
| `contact.bt_last_payment_status` | Single line | Stop conditions | Order | plătită |
| `contact.bt_last_order_status` | Single line | Stop conditions | Order | expediată |
| `contact.bt_lifetime_orders` | Number | Loyalty | Database (paid orders) | 2 |
| `contact.bt_lifetime_value` | Monetary / number | Loyalty | Database | 9500.00 |
| `contact.bt_marketing_consent` | Single line (Da/Nu) | Marketing filter | **Current** email marketing consent of the address, from our database (latest event: checkbox or unsubscribe) | Da |
| `contact.bt_last_order_url` | Single line | W3 link to the order page (opaque token) | Latest order | https://biohack-tech.ro/comanda/… |
| `contact.bt_recovery_url` | Single line | W2 link; **empty unless recovery is allowed** | Recovery decision | https://biohack-tech.ro/reluare/… |
| `contact.bt_unsubscribe_url` | Single line | Unsubscribe link in every marketing email | Consent subject | https://biohack-tech.ro/dezabonare/… |
| `contact.bt_last_order_source` | Single line | Where the latest order came from (reporting, segmentation) | Validated order attribution | landing brain-flow · facebook / paid / lansare (or `site`) |

Standard fields filled too: first/last name, email, phone, company name (PJ), address, city, county, postal code, country, source `biohack-tech.ro`.

**Verify on the first test order** that the custom fields are filled (GHL has changed the custom-field payload format between doc versions; the site sends `{ key, fieldValue }`). If they stay empty, the one place to change is `contactPayload()` in `src/server/integrations/ghl.ts`.

### 10.4 Tags (only these)
- `bt-client`: has at least one paid order.
- `bt-cumparat-calm`, `bt-cumparat-focus`, `bt-cumparat-amber`, `bt-cumparat-brain-flow`: bought that product (per-product education and cross-sell). A test fails if a catalog product has no tag.
- `bt-mesaj-contact`: wrote through the site's contact form (identity only; no order fields, no pipeline; starts nothing).
- `bt-retur-solicitat`: a withdrawal was declared for a paid order. `bt-retur-primit`: the returned product arrived back. Both set only by the site (§29).
- `bt-client-firma`: bought as a company (PJ).
- `bt-recuperare-eligibil`: **added and removed only by the site**. It is present only while a checkout recovery email is allowed (consent, still unpaid and abandoned, link valid). It starts W2. Never add it by hand or in a workflow.

All BiohackTech tags start with `bt-`: the NEUROS location is shared with other funnels (courses, events), so generic names are avoided.
Customer tags are added only after payment and never removed by the site; `bt-recuperare-eligibil` is the one tag the site also removes. Everything else is a field or a pipeline stage.

### 10.5 Workflows W1–W7 (GHL, folder “BiohackTech Ecommerce”)

**Status on 29 Sep 2026: all seven created in Kerrsid (NEUROS), folder “BiohackTech Ecommerce”, every one Draft, 0 enrolled.** Each is scoped to the pipeline “Comenzi Biohack Tech” or a `bt-` tag; none uses a generic trigger. Missing pieces are isolated in clearly named actions, to fill before publishing:

| # | Kerrsid id | Missing before ON |
|---|---|---|
| W1 | ad1361c6-91f6-4fba-953b-5a47af5fb00e | notification recipient (placeholder: opportunity owner, action named “DESTINATAR DE SETAT”) |
| W2 | 2cbd2762-3950-456a-8cf8-118f1fd64671 | email sender (`EMAIL_FROM`) |
| W3 | 74216fee-9c80-45af-aa38-6d8595594b21 | email sender; task assignee |
| W4 | 789ce616-1fc6-4c2a-a6a4-589af6db14f2 | notification recipient; task assignee |
| W5 | cc6fae1a-b4d1-4ded-bef5-f949d1fe513c | task assignee |
| W6 | 2249c005-0a58-408e-b1c3-03134aa84560 | email sender; specialist assignee; review link (placeholder `LINK-RECENZII-DE-SETAT`). Specialist branch already includes `bt-cumparat-brain-flow` |
| W7 | 310fe79b-24f5-4901-a663-210879186e98 | task assignees |

The build sheets below are what was built.

**Rules for every BiohackTech workflow**
- Transactional emails come from the site. No workflow sends an order confirmation, bank details, an invoice, a shipping notice, a cancellation or a refund email: the customer would get them twice.
- Every trigger is scoped to the pipeline “Comenzi Biohack Tech”, a `bt-` tag or a `contact.bt_*` field. **Never** use “Contact Created”, “Form Submitted” or a trigger without these filters. The NEUROS location also runs courses, events and other funnels.
- Marketing emails go out only when the **site** says so: `contact.bt_marketing_consent` = `Da` (from our database, where the consent proof is), or the tag `bt-recuperare-eligibil` for checkout recovery. GHL never decides legal eligibility because an email address exists.
- Every marketing email ends with `{{contact.bt_unsubscribe_url}}` (the site's own unsubscribe link). **Do not** add GHL's own unsubscribe link or set email DND to unsubscribe people: DND on email also blocks the site's order emails sent through GHL, and the order email job then fails (visible in /admin).
- Settings for each workflow: *Allow re-entry* **on** (a customer can place several orders; each stage move happens once per order, so there are no duplicates). Sender: `EMAIL_FROM` once the sending domain is verified (§11).
- GHL never changes payment truth. Paid, cancelled and refunded come from Stripe and the site's database. Workflows only read the stage and the fields.
- Stay **Draft** until the sending domain and `EMAIL_FROM` are verified, the recipients are set, and each one is tested with the test contact (§20).

Roles changed from the first version of this runbook. W1–W3 are the same. Getting started, review and specialist call moved into W6. W4, W5 and W7 are now the operational steps after payment, at shipping, and at cancellation or refund.

| # | Name | Type | Trigger (all: pipeline = Comenzi Biohack Tech) | Sends to customer | ON when |
|---|---|---|---|---|---|
| W1 | BT · Comandă nouă: notificare echipă | Internal | Opportunity created in stage *Așteaptă transferul* or *Plătită, de pregătit*; stage changed to *Plătită, de pregătit* | nothing | recipients set |
| W2 | BT · Recuperare checkout | Marketing, consent only | Tag added `bt-recuperare-eligibil` | 1 email (R1) | sending domain + legal review §16 |
| W3 | BT · Transfer: reamintire | Transactional reminder | Opportunity created in stage *Așteaptă transferul* | 1 email (T1) | sending domain |
| W4 | BT · Plătită: pregătire comandă | Internal | Opportunity created in, or stage changed to, *Plătită, de pregătit* | nothing | assignee set |
| W5 | BT · Expediată: urmărire livrare | Internal | Stage changed to *Expediată* | nothing | assignee set |
| W6 | BT · După livrare | Service + marketing (separated) | Stage changed to *Livrată* | P1 (service); REV (marketing, consent only) | sending domain + review link |
| W7 | BT · Anulare și rambursare | Internal | Stage changed to *Anulată* or *Rambursată* | nothing | assignee set |
| (W0) | BT · Dezabonare din GHL → site | Sync | Contact DND on Email turned on + filter: tag `bt-client` or field `bt_last_order_number` not empty | nothing | `GHL_WEBHOOK_SECRET` set |

#### W1 · Comandă nouă: notificare echipă
1. Triggers: *Opportunity Created*, filters Pipeline = Comenzi Biohack Tech, Stage is *Așteaptă transferul* or *Plătită, de pregătit*. Second trigger: *Pipeline Stage Changed*, Pipeline = Comenzi Biohack Tech, Stage = *Plătită, de pregătit*. Card orders appear in the pipeline already paid, and transfer orders appear waiting and then move to paid, so the team hears about both.
2. Action *Internal Notification* (email, or app notification), to **[BLOCKER: team recipients]**:
   - Subject: `Comandă {{contact.bt_last_order_number}}: {{opportunity.pipeline_stage_name}}`
   - Body: `{{opportunity.name}} · {{contact.bt_last_order_value}} lei · {{contact.bt_last_payment_method}} · {{contact.bt_last_order_products}}. Detalii și acțiuni: https://biohack-tech.ro/admin`
   - No address, phone or email in the notification: the team opens /admin.

#### W2 · Recuperare checkout (consent only)
The site adds `bt-recuperare-eligibil` only when all of these hold: the address has email marketing consent in our database, the card order is still unpaid and abandoned, and the recovery link is valid (7 days). The site removes the tag when the order is paid, cancelled or replaced by a paid order, or when the customer unsubscribes. Without consent the order is still in *Plată nefinalizată*, but there is no tag and no email.
1. Trigger: *Contact Tag Added* = `bt-recuperare-eligibil`.
2. *Wait* 30 minutes (the order is already 60 minutes old: `ABANDON_AFTER_MINUTES`).
3. *If/Else*: contact **has tag** `bt-recuperare-eligibil` **and** `bt_marketing_consent` = `Da` **and** `bt_recovery_url` is not empty. If not, end.
4. *Send Email* R1 (below). End. One email, no second reminder.

R1. Subject: `Comanda ta te așteaptă`
> Bună, {{contact.first_name}},
>
> Ai început o comandă pe biohack-tech.ro, dar plata nu s-a finalizat.
>
> Produsele te așteaptă. Poți relua comanda de aici:
>
> **[Reiau comanda]** → `{{contact.bt_recovery_url}}`
>
> Linkul funcționează 7 zile.
>
> Dacă ai avut o problemă la plată sau ai o întrebare, răspunde la acest email. Te ajutăm.
>
> Echipa Biohack Tech
>
> *Primești acest email pentru că ai acceptat, la comandă, emailuri de la Biohack Tech. Dezabonare: {{contact.bt_unsubscribe_url}}* · [company line, §16]

The recovery link only puts the products back in the cart. It shows no personal data and pays nothing; the customer completes a new checkout.

#### W3 · Transfer: reamintire
1. Trigger: *Opportunity Created*, Pipeline = Comenzi Biohack Tech, Stage = *Așteaptă transferul*.
2. *Wait* 2 days.
3. *If/Else*: opportunity stage is still *Așteaptă transferul* **and** `bt_last_payment_status` = `așteaptă transferul` **and** `bt_last_payment_method` = `Transfer bancar`. If not (paid, cancelled or expired), end.
4. *Send Email* T1 (below).
5. *Wait* 3 days. *If/Else*: stage still *Așteaptă transferul* → *Create Task* for **[assignee]**: `Transfer neprimit {{contact.bt_last_order_number}}: sună clientul sau anulează în /admin`. End.

T1. Subject: `Reamintire: comanda {{contact.bt_last_order_number}} așteaptă plata`
> Bună, {{contact.first_name}},
>
> Comanda {{contact.bt_last_order_number}} este înregistrată și așteaptă plata prin transfer bancar.
>
> Suma: {{contact.bt_last_order_value}} lei.
>
> Datele pentru transfer sunt pe pagina comenzii: **[Văd datele de plată]** → `{{contact.bt_last_order_url}}`
>
> Scrie {{contact.bt_last_order_number}} la detaliile plății. Așa potrivim transferul cu comanda.
>
> Ai plătit deja? Ignoră acest mesaj. Îți scriem când primim suma.
>
> Te-ai răzgândit? Răspunde la acest email și anulăm comanda.
>
> Echipa Biohack Tech

This is a payment reminder for an order already placed, not marketing, so it has no unsubscribe link and no offers. The bank details stay on the order page, which is protected by an opaque token, and in the site's first email. They are not copied into GHL.

#### W4 · Plătită: pregătire comandă
1. Triggers: *Opportunity Created* with Stage = *Plătită, de pregătit*, and *Pipeline Stage Changed* to *Plătită, de pregătit* (pipeline filter on both).
2. *Create Task* for **[BLOCKER: fulfilment person]**: `Pregătește coletul {{contact.bt_last_order_number}}` with the description `{{contact.bt_last_order_products}}. Marchează „în pregătire”, apoi „expediată” cu AWB în /admin.`, due in 1 day.
3. *Wait* 2 days. *If/Else*: stage still *Plătită, de pregătit* → *Internal Notification*: `Comanda {{contact.bt_last_order_number}} nu este încă la curier (termen 1-3 zile).`
No customer email: the site already sent the confirmation and the invoice.

#### W5 · Expediată: urmărire livrare
1. Trigger: *Pipeline Stage Changed* to *Expediată*.
2. *Wait* 5 days (transit 2-5 days).
3. *If/Else*: stage still *Expediată* → *Create Task*: `Verifică la curier livrarea {{contact.bt_last_order_number}}; marchează „livrată” în /admin.`
No customer email: the site sends the shipping email with courier and AWB. **Boundary (implementation 3/4):** there is no courier integration. The AWB is typed in /admin and *Livrată* is set by hand. W5 ends at that boundary and invents no statuses.

#### W6 · După livrare
1. Trigger: *Pipeline Stage Changed* to *Livrată*.
2. Service branch, for every customer:
   - *If/Else*: tag `bt-cumparat-calm` or `bt-cumparat-focus` → *Create Task* for **[specialist]**: `Apel de început {{contact.first_name}} ({{contact.bt_last_order_number}})`, due in 2 days.
   - *Wait* 1 day → *Send Email* P1 (below).
3. Marketing branch, consent only:
   - *Wait* 14 days.
   - *If/Else*: `bt_marketing_consent` = `Da` **and** stage still *Livrată* (not *Rambursată* or *Anulată*) → *Send Email* REV. Otherwise end.

P1 (service). Subject: `Comanda {{contact.bt_last_order_number}} a ajuns. Te ajutăm la început`
> Bună, {{contact.first_name}},
>
> Sperăm că produsele au ajuns bine.
>
> Ai o întrebare despre folosire sau ceva nu merge cum te aștepți? Răspunde la acest email sau sună la +40 757 890 707.
>
> Te ajutăm să pornești corect.
>
> Echipa Biohack Tech

REV (marketing). Subject: `Cum ți se pare?`
> Bună, {{contact.first_name}},
>
> Ai primit comanda acum două săptămâni. Ne-ar ajuta mult să aflăm cum ți se pare.
>
> **[Las o părere]** → **[BLOCKER: review link, e.g. Google Business profile]**
>
> Durează un minut.
>
> Echipa Biohack Tech
>
> *Primești acest email pentru că ai acceptat, la comandă, emailuri de la Biohack Tech. Dezabonare: {{contact.bt_unsubscribe_url}}*

Cross-sell is not part of the launch. If added later, it is a separate workflow with the same consent filter and unsubscribe link, and it states only true product facts.

#### W7 · Anulare și rambursare
1. Triggers: *Pipeline Stage Changed* to *Anulată*; *Pipeline Stage Changed* to *Rambursată*.
2. *Remove from Workflow*: W2, W3, W4, W5, W6. This is an explicit stop on top of their own checks.
3. *If/Else*: stage *Anulată* and `bt_last_payment_status` is `plătită` or `rambursată parțial` → *Create Task*: `Rambursează {{contact.bt_last_order_number}} (Stripe pentru card, transfer pentru transfer); refund-ul se vede apoi în /admin.`
4. *If/Else*: stage *Rambursată* → *Create Task*: `Verifică stornarea facturii în FGO pentru {{contact.bt_last_order_number}}.`
No customer email: the site sends the cancellation and refund emails. Failed integrations (FGO, GHL, email) are not a pipeline stage; they appear in /admin under “Sincronizări care au nevoie de atenție”.

#### W0 · Dezabonare din GHL → site (optional, recommended)
Trigger: *Contact DND* turned on for Email, filtered to BiohackTech contacts (tag `bt-client` or `bt_last_order_number` not empty). Action *Webhook*: `POST https://biohack-tech.ro/api/ghl/unsubscribe`, header `x-bt-webhook-secret: <GHL_WEBHOOK_SECRET>`, body `{"email": "{{contact.email}}"}`. The site records the withdrawal, and every future marketing decision reads it. Then remove the DND manually if the customer still needs order emails.

#### Testing each workflow (before ON)
Use one dedicated test contact with a mailbox you own. Do not use a customer or an `example.com` address, because GHL would try to deliver. Test with *Test Workflow* or by moving the test opportunity through the stages.
- W1: create a test transfer order, then confirm it in /admin → 2 notifications.
- W2: without consent: no tag, no email. With consent: tag → R1. Pay: tag removed → the pre-send check stops R1.
- W3: transfer order → T1 after 2 days (shorten the wait for the test). Confirm payment first → no T1.
- W4–W7: move the test order in /admin and check the tasks. W7 removes the contact from the others.

### 10.6 Email sending (see §11)
Settings → Email Services: dedicated sending domain on biohack-tech.ro, verified. `EMAIL_FROM` must be an address on it.

## 11. Email domain setup

1. GHL → Settings → Email Services → **Dedicated domain** → add `mail.biohack-tech.ro` (GHL suggests a subdomain). GHL shows the DNS records.
2. At the DNS provider add exactly the records GHL shows: **SPF** (TXT), **DKIM** (TXT/CNAME), the MX/CNAME for bounces if shown.
3. **DMARC** on the root domain, start in monitoring: `_dmarc.biohack-tech.ro TXT "v=DMARC1; p=none; rua=mailto:dmarc@biohack-tech.ro"`; move to `p=quarantine` after two clean weeks.
4. Verify in GHL (green). Set the sender name “Biohack Tech” and the from address → `EMAIL_FROM` (e.g. `comenzi@biohack-tech.ro`). Replies land in GHL Conversations: someone must monitor them daily.
5. Test (§20): Gmail (web + phone), Outlook/Hotmail, Yahoo; check it is not in spam, the layout on a phone, all links.

**Transactional templates (rendered by the site, `src/server/integrations/email/templates.ts`):**

| Template | Subject | Trigger | Variables | CTA | Type |
|---|---|---|---|---|---|
| `order_confirmed` | Comanda ta Biohack Tech #{nr} | Card payment confirmed | name, number, date, lines (product, variant, qty, unit, total), subtotal, shipping, total, VAT, payment method, delivery + billing address, phone, next step, support | Vezi comanda | Transactional |
| `transfer_instructions` | Comanda #{nr}: datele pentru transfer | Transfer order placed | as above + beneficiary, IBAN, bank, SWIFT, amount, reference | Vezi comanda | Transactional |
| `payment_received` | Am primit plata pentru comanda #{nr} | Transfer confirmed in /admin | number, lines, totals, next step | Vezi comanda | Transactional |
| `invoice_issued` | Factura pentru comanda #{nr} | FGO invoice issued | invoice series + number, total, link | Descarcă factura | Transactional |
| `order_shipped` | Comanda #{nr} a fost expediată | AWB saved in /admin | courier, AWB, tracking link, address | Urmărește coletul | Transactional |
| `order_cancelled` | Comanda #{nr} a fost anulată | Cancelled in /admin (transfer or paid orders) | number, refund note | – | Transactional |
| `refund_issued` | Rambursare pentru comanda #{nr} | Refund (Stripe webhook or /admin) | amount refunded | – | Transactional |
| `withdrawal_received` | Am primit cererea de retragere pentru comanda #{nr} | Online withdrawal statement matching an order (`/retragere`) | reference, date and time, name, order, products, message, next steps (return within 14 days, refund within 14 days) | – | Transactional (OUG 34/2014 art. 11^1 acknowledgement) |
| R1, T1, P1, REV | see §10.5 | GHL workflows | GHL merge fields | as designed | R1, REV marketing (consent + unsubscribe link); T1, P1 transactional/service |

Every site email: plain text version included, support line with the order number, no marketing blocks. They go out whatever the customer's marketing choice is: they are needed for the order. Unsubscribing never stops them.

## 12. Database setup

- **What:** PostgreSQL 14+. Tables: `orders` (canonical order + snapshot + all external references), `order_items`, `order_events` (audit trail), `jobs` (outbox), `webhook_events` (Stripe event dedupe), `schema_migrations`. Sequence `order_seq`.
- **Provider:** Railway PostgreSQL in the same project as the app (private network, daily backups on paid plans). Neon or Supabase work the same way via `DATABASE_URL`.
- **Steps (YOU):** Railway project → New → Database → PostgreSQL → in the app service add variable `DATABASE_URL = ${{Postgres.DATABASE_URL}}`.
- **Migrations:** run automatically on first request (advisory lock; safe with several instances). To run by hand: `DATABASE_URL=… npm run db:migrate` (Node 22.18+).
- **Backups:** enable Railway backups (daily) and keep at least 30 days. Before launch, restore one backup into a scratch database once to prove it works.
- **Security:** only the app connects (Railway private networking); do not expose the public proxy unless needed; the database contains personal data (GDPR): access limited to the owner.
- **Test database:** staging gets its own PostgreSQL (never share with production). Locally no setup is needed (embedded PGlite under `.data/`).

## 13. Bank details (YOU)

Provide: **beneficiary** (legal name of the company), **IBAN** (RON account), **bank name**, **SWIFT** (optional). Payment reference rule (built): the customer writes the order number `BT-2026-000123` in the payment details. Confirmation process: whoever reads the statement opens /admin → the order → “Plata a fost primită” (only after the exact amount with that reference appears). That triggers the email, the invoice (FGO) and the pipeline move. Decide (§16) how many days an unpaid transfer order is kept before cancelling (W3 creates the reminder task after 5 days).

## 14. Shipping setup

**Built:** shipping cost per order (`shippingMinor`, currently 0 lei: “livrare gratuită în România”, the rule on the current site), delivery address separate from billing, courier name + AWB + tracking URL + shipped/delivered dates per order, shipping email with tracking, pipeline stages. The rule lives in one function (`shippingFor` in `src/server/orders/service.ts`) to change later for a fixed fee or a free-shipping threshold.

**Courier boundary (built):** `src/server/fulfillment/courier.ts`. `COURIER_PROVIDER=manual` (the only provider): the team books the parcel in the courier's portal and types courier + AWB (+ optional tracking link) in /admin. A future API provider implements the same interface; the order still becomes “shipped” only through `markShipped()`, so emails, CRM and audit do not change.

**Decisions (YOU):** courier (Fan Courier, Sameday, Cargus…), confirm free shipping for all orders, pickup schedule, whether to offer easybox/lockers, Romania only (the checkout accepts only Romanian counties). **Not built:** automatic AWB generation (needs the courier’s API account; P2), delivery tracking sync (P2). Today: create the AWB in the courier’s portal, paste it into /admin.

## 15. Privacy, consent and analytics

### 15.1 Cookie consent (built)
- **Categories.** *Necessary* is always on: cart (`biohack-cart-v1`), checkout draft (sessionStorage), `bt-cart-cleared-*`, the choice itself (`bt-consent-v1`), and Stripe's fraud-prevention cookies on the checkout page only. *Analytics* and *Marketing* are off until the visitor says yes.
- **Banner.** It appears only when at least one optional tool is configured (`NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_CLARITY_ID`, `NEXT_PUBLIC_META_PIXEL_ID`) and there is no current choice. With no tool configured there is nothing to ask. The site then uses only strictly necessary storage, and “Setări cookies” says so.
  - The first layer has *Refuz opționalele* and *Accept toate* in the same style, plus *Aleg eu ce accept*.
  - The dialog has one switch per category, off by default, and *Salvez alegerea*.
- **Real blocking.** No optional script is in the HTML. `src/lib/consent/vendors.ts` adds a tool's script only after its category is allowed.
  - GA4 runs with advertising storage and signals denied.
  - Meta runs with `autoConfig` off, so it never reads form fields.
  - Clarity never runs on checkout, order, recovery, unsubscribe, withdrawal or admin pages.
  - `track()` sends nothing without consent and queues nothing for later.
  - Verified in the browser: before consent there is no gtag and no request to Google. *Accept toate* loads `gtag/js` and one `collect` with `gcs=G101`. Withdrawing reloads the page without it.
- **Withdrawal.** “Setări cookies” in every footer. Withdrawing a category deletes that tool's first-party cookies and reloads the page.
- **Storage and proof.** The browser keeps `{id, version, analytics, marketing, at, updatedAt}`, where `id` is random. `POST /api/consent` logs the same to `cookie_consents`, without IP or user agent. The choice lasts 12 months and is asked again if `COOKIE_POLICY_VERSION` changes, which you should do when a tool is added.
- **Adding a tool.** Add one entry in `VENDORS` (category, cookies) and one row in the cookie policy table in `src/content/legal.ts`. Bump `COOKIE_POLICY_VERSION`. A tag manager that loads arbitrary tags does not fit a single category, so it is not supported on purpose.

### 15.2 Email marketing consent (built)
- **Checkout checkbox.** It is optional, unticked, and separate from accepting the terms. The order works the same without it. Its text is in `src/lib/consent/marketing.ts` (version `mkt-2026-09-29`) and covers news, offers, recommendations and a reminder for an unfinished order.
- **Proof in our database.** `marketing_consent_events` is append-only and stores: granted true/false, time, exact text, text version, source, page and order. The current state of an address is its latest event.
  - An unticked box records nothing: it is not an objection and does not undo an earlier consent.
  - A withdrawal always wins until a new, explicit consent.
- **Cookie consent is not email consent.** They are stored and asked separately.
- **Unsubscribe.** The link `/dezabonare/<opaque token>` (one per address) confirms with one button. The withdrawal is recorded, then a `marketing.sync` job sets `bt_marketing_consent` = `Nu` in GHL, empties `bt_recovery_url` and removes `bt-recuperare-eligibil`. Opt-outs made inside GHL can come back through W0 → `POST /api/ghl/unsubscribe`.
- **Transactional emails are unaffected.** Confirmation, transfer details, payment received, invoice, shipping, cancellation, refund and withdrawal acknowledgement are not marketing.
- **Existing-customer exception (soft opt-in): not used.** Art. 12(2) of Legea 506/2004 requires that the customer be clearly offered a way to object when the address is collected. The checkout offers an opt-in instead, and an unticked opt-in cannot be read as “did not object”. All marketing therefore needs the checkbox. Enabling the exception would need a different checkout wording and a lawyer's approval (§16).

### 15.3 Checkout recovery (built)
- *Abandoned* is an order state. The job `order.abandon_check` sets it after `ABANDON_AFTER_MINUTES`, once Stripe has confirmed the payment is not there. *May we email about it* is a separate decision: `canSendAbandonedCheckoutEmail()` in `src/server/marketing/recovery.ts`.
  - It requires a card order, unpaid, still abandoned, marketing consent for the address, and a valid link.
  - The reason is stored on the order (`recovery_status`, `recovery_reason`) and in the `order.abandoned` event, without personal data.
  - It is re-checked at every CRM sync.
- **Without consent.** The order is in *Plată nefinalizată* in the CRM, with no tag, no link and no email.
- **With consent.** Tag `bt-recuperare-eligibil` and `bt_recovery_url` → W2.
  - The link `/reluare/<opaque token>` expires after 7 days and only puts the products back in the cart. It shows no name or address, and it confirms nothing.
- **Paid.**
  - Paying the same order removes the tag and kills the link.
  - Paying a new order closes earlier abandoned attempts of that address in the same transaction (`order.superseded`), then removes the tag.

### 15.4 Analytics tools (YOU)
Decide the tools and set their ids. Events sent with consent: `view_cart`, `begin_checkout`, `add_payment_info`, `purchase` (once per order, only when paid). They contain products and amounts only. Set Clarity's masking to *Strict*. In Meta Events Manager, keep automatic advanced matching off.

## 16. Legal pages and checkout information

**Built (29 Sep 2026)**
- Pages:
  - `/terms-of-service` (ordering steps, contract conclusion, prices, links, product disclaimer, complaints, ANPC, applicable law);
  - `/privacy-policy` (controller, purposes and legal bases table, marketing consent, recipients, transfers, retention, rights, ANSPDCP);
  - `/politica-cookies` (table generated from what is actually configured);
  - `/politica-livrare`;
  - `/politica-retur` (withdrawal right, how, return, refund, **model withdrawal form**);
  - `/garantie` (legal guarantee of conformity, OUG 140/2021; complaints; ANPC and SAL);
  - `/plati`.
- **Online withdrawal function** (OUG 34/2014 art. 11^1, in force since 19 June 2026). `/retragere` is linked from every footer as “Retrage-te din contract aici” and from the order page. The confirm button reads “Confirmați retragerea”.
  - The statement is stored in `withdrawal_requests`.
  - A statement that matches an order gets the email acknowledgement `withdrawal_received` (content, date and time).
  - Every statement shows in /admin.
- **Checkout.**
  - The transfer button reads “Comandă cu obligație de plată”; the card button reads “Plătește X lei”.
  - The terms checkbox (terms and the returns and withdrawal policy) is separate from the optional marketing checkbox.
  - A privacy notice with a link sits under the checkboxes.
  - “Drept de retragere 14 zile · garanție legală de conformitate 2 ani” is shown with links.
  - Products, variants, quantities, unit and line prices, VAT included, free delivery and the total are shown before the button.
- **Footer.** Company line (from `COMPANY_*`), “Setări cookies”, ANPC, and ANPC SAL (`reclamatiisal.anpc.ro`). The EU ODR platform closed on 20 July 2025, so there is no ODR link.
- **No placeholder text.** A missing company field is not shown. /admin lists it (error in production).

See the short **LEGAL REVIEW BEFORE GO-LIVE** list in `docs/OPEN-POINTS.md`.

## 17. Deployment

| Item | Value |
|---|---|
| Runtime | Node **22.18+** (set in `package.json` engines; Railway picks it up) |
| Install | `npm ci` |
| Build | `npm run build` |
| Start | `npm start` (listens on `$PORT`, default 3000) |
| Health check | `GET /api/health` → 200 when the database is reachable and at least one payment method is active; 503 otherwise (JSON lists what is missing, no secrets) |
| Background jobs | In-process every 60 s on a long-running host (Railway). On serverless hosts set `JOBS_INTERVAL=off` and call `POST /api/jobs/run` with `Authorization: Bearer $CRON_SECRET` every minute |
| Persistent storage | Only PostgreSQL. No local disk needed in production |
| Instances | 1 is enough; more are safe (outbox claims use `FOR UPDATE SKIP LOCKED`) |

Railway: New project → Deploy from GitHub repo → add PostgreSQL → set variables (§7) → Settings → Healthcheck path `/api/health` → Networking → custom domain.

## 18. DNS

1. Decide the canonical host: **`biohack-tech.ro`** (recommended) with `www` redirecting to it (or the opposite; then change `NEXT_PUBLIC_SITE_URL`).
2. Railway → Networking → add `biohack-tech.ro` and `www.biohack-tech.ro`; add the CNAME/ALIAS records Railway shows at your DNS provider. HTTPS certificates are issued automatically.
3. Email records from §11 (SPF, DKIM, DMARC).
4. After switching: check `https://biohack-tech.ro`, `http://` → `https://`, `www` → apex, old product URLs (`/products/balancewave` → `/products/calm`, `/brainlink` → `/focus`, `/glasses` → `/amber`).

**Company data to send us (for footer/terms, YOU):** legal name, CUI, Reg. Com., registered office, VAT status, support email (today `contact@neuros.ro` from the source: confirm or replace), phone (`+40 757 890 707`: confirm), return address, bank details (§13).

## 19. Webhooks to register

| From | URL | Events | Secret |
|---|---|---|---|
| Stripe (live) | `https://biohack-tech.ro/api/webhooks/stripe` | `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded` | `STRIPE_WEBHOOK_SECRET` |
| Stripe (test, staging) | `https://<staging-host>/api/webhooks/stripe` | same | staging `STRIPE_WEBHOOK_SECRET` |
| External cron (only if serverless) | `https://biohack-tech.ro/api/jobs/run` (POST) | every minute | `Authorization: Bearer $CRON_SECRET` |
| GoHighLevel | none needed | – | – |
| FGO | none (FGO has no webhooks; we call it) | – | – |
| Courier | future `/api/webhooks/courier` (P2) | – | – |

## 20. Test order procedure (staging, then production)

Use a staging deployment with `APP_ENV=staging`, Stripe **test** keys, the **FGO test** account (`FGO_ENV=test`) and your GHL sub-account with test contacts (emails like `test+1@biohack-tech.ro` so you receive them). No real money, no real fiscal documents.

| # | Flow | Steps | Verify |
|---|---|---|---|
| 1 | PF, card | NEUROS Calm → add → popup “Finalizează comanda” → PF → card `4242 4242 4242 4242`, any future date, any CVC | Order page “Plata este confirmată”; /admin: Plătită, Factură Emisă; GHL: contact, fields, tags `bt-client` + `bt-cumparat-calm`, opportunity in “Plătită, de pregătit”, value 6380; emails: confirmation + invoice (one each) |
| 2 | PJ, card + 3-D Secure | NEUROS Amber Unisex pătrat Maro ×2 + NEUROS Focus → PJ with a real CUI → card `4000 0027 6000 3184` → complete the challenge | FGO test invoice on the company with CUI, lines with the exact variant; totals 2.490 + 630 |
| 3 | Declined card | card `4000 0000 0000 0002` | Message in checkout, nothing charged; order stays “Card eșuat”; retry with 4242 on the same page → paid; one order, one invoice |
| 4 | Webhook without browser | Pay, then close the tab before the redirect | Order paid within seconds (webhook) |
| 5 | Webhook replay | Stripe Dashboard → the event → Resend | No second invoice, email or opportunity |
| 6 | PF, transfer | NEUROS Calm → transfer | Order page with bank details; email “datele pentru transfer”; GHL stage “Așteaptă transferul”; no invoice |
| 7 | Transfer paid | /admin → the order → “Plata a fost primită” | Email “Am primit plata”, invoice, stage “Plătită, de pregătit” |
| 8 | Ship + deliver | /admin → courier + AWB + tracking link → then “Marchează livrată” | Shipping email with the link; stages Expediată → Livrată; W5, then W6 start |
| 9 | Refund | Stripe → refund payment of flow 1 | Order “Rambursată”, email, GHL stage “Rambursată”; storno per your FGO setting |
| 10 | Cancel | Transfer order → /admin → Anulează | Email “anulată”, stage “Anulată” |
| 11 | Abandoned card | Start a card checkout, stop before paying, wait 60 min | Stage “Plată nefinalizată”; without the marketing box: no tag, no email; with it: tag `bt-recuperare-eligibil`, `bt_recovery_url` set, W2 |
| 12 | Phone | Repeat flow 1 and 6 on an iPhone and an Android | Popup at the bottom, Payment Element, Apple/Google Pay if enabled |

**Automated check (test mode):** with the app running on PostgreSQL and `stripe listen --forward-to <app>/api/webhooks/stripe` feeding it, `E2E_BASE_URL=<app> DATABASE_URL=<same db> node scripts/stripe-e2e.mjs` runs flows 1, 3, 4 and more against real Stripe test payments: paid with the browser gone, decline then retry, 3-D Secure pending, cancellation, double submit, invalid signature, bank transfer. It refuses live keys.

**Cleanup:** cancel test orders in /admin (production DB: none should exist; staging has its own DB), delete test contacts/opportunities in GHL, test invoices stay in the FGO test account only.

## 21. Go-live procedure

The ordered sequence:

1. Railway project + PostgreSQL; backups on.
2. Deploy the repo with `APP_ENV=staging`, test keys, FGO test, GHL (test contacts). Health = 200.
3. GHL: Private Integration, pipeline + 8 stages, 14 custom fields, 6 tags (`npm run ghl:check`), sending domain verified, W1, W3, W4, W7 built and tested (W2, W5, W6 can follow).
4. Stripe test webhook registered on the staging URL.
5. Run the test orders of §20 (at least 1, 2, 3, 5, 6, 7, 8, 9). Everything green in /admin (no failed syncs).
6. Legal texts + company data published (code change in `src/content/legal.ts`, `src/components/site/Footer.tsx`, `src/config/site.ts`).
7. Production service: same repo, `APP_ENV=production`, production `DATABASE_URL`, **live** Stripe keys + live webhook secret, `FGO_ENV=production` + production FGO credentials, GHL production values, bank details, `ADMIN_PASSWORD`, `CRON_SECRET`.
8. Stripe live webhook endpoint on `https://biohack-tech.ro/api/webhooks/stripe`.
9. DNS to Railway; HTTPS green; redirects checked.
10. `https://biohack-tech.ro/api/health` → `{ ok: true, payments: { card: true, transfer: true } }`.
11. One real order: NEUROS Amber 315 lei, your own card → confirm everything of flow 1 (real invoice, which you then storno in FGO + refund in Stripe) and one real transfer order you pay yourself.
12. Uptime monitor on `/api/health` with alerts to phone.
13. Announce.

## 22. Post-launch monitoring

- **Uptime:** Better Stack (or UptimeRobot) checks `https://biohack-tech.ro/api/health` every minute; alert on non-200 for 2 checks (SMS/phone to the owner).
- **Logs:** Railway logs are one JSON line per event. Alert (Better Stack log drain, or daily review in the first week) on: `job.failed`, `stripe.webhook_error`, `order.amount_mismatch`, `checkout.stripe_failed`, `checkout.order_failed`, `config.issue`, `db.pool_error`.
- **Stripe:** Stripe emails the account owner when webhook deliveries fail. Dashboard → Webhooks → endpoint should show 100% success.
- **Daily (first 2 weeks):** /admin top panel empty (no failed syncs); every paid order has an invoice; GHL pipeline matches /admin; transfer orders checked against the bank statement.
- **Error tracking (P1):** Sentry for Next.js if you want stack traces from the browser and server (needs a Sentry project + DSN).

## 23. Rollback / failure procedure

| Situation | What happens automatically | What you do |
|---|---|---|
| New deploy broken | – | Railway → Deployments → previous deployment → Redeploy. The database schema only grows; old code runs on it |
| Stripe down / Payment Element does not load | Checkout shows “Formularul pentru card nu s-a putut încărca. … alege transferul bancar” | Nothing; orders continue by transfer |
| Stripe webhook delayed or lost | The order page keeps showing “Se verifică plata”; the `stripe.reconcile` job asks Stripe after 10 minutes (and again before marking the order abandoned) and confirms the payment | Check the webhook endpoint in the Stripe Dashboard |
| Webhook endpoint failing | Stripe retries for 3 days; payments stay safe in Stripe | Fix, then Stripe → Resend failed events |
| FGO down or refusing | Order stays paid; invoice retried 8 times; then “Factură: Eroare” | /admin → Reîncearcă, or issue the invoice in FGO by hand with the order number in the text |
| GHL down | Order is saved; CRM/email jobs retry for hours | /admin → Reîncearcă tot. If emails failed permanently, email the customer from GHL by hand |
| GHL rejects a request (4xx, e.g. a custom field missing) | The job stops at once as `failed` (no blind retries); the order is untouched | Fix the GHL setup (§10), then /admin → Reîncearcă |
| Email not delivered | Job shows the error in /admin | Check the sending domain; resend via Reîncearcă |
| Bank payment received with no reference | – | Match by amount/name in /admin search → “Plata a fost primită” |
| Customer paid twice (two orders) | Both orders are paid | Refund the second in Stripe; cancel it in /admin |
| Database down | Checkout returns an error, nothing charged (the PaymentIntent is created only after the order is saved) | Railway status / restore from backup |
| Need to stop selling now | – | Remove `STRIPE_*` and `BANK_*` variables and redeploy: checkout switches to “comandă pe email / telefon” |

## 24. Where the team works (operations)

| Question | Answer |
|---|---|
| Where does the team see a new order? | GHL: opportunity in “Comenzi Biohack Tech” + W1 notification. Full detail: `/admin` |
| Where do they see payment status? | `/admin` (authoritative), GHL stage, Stripe Dashboard for card details |
| Where do they see the shipping address? | `/admin` → the order (delivery and billing addresses, phone, notes) |
| Where do they enter tracking? | `/admin` → the order → Expediere (courier, AWB, link). This emails the customer and moves the pipeline |
| Where do they see FGO status? | `/admin` (Factură column; link to the PDF) and in FGO |
| Where do they handle failed syncs? | `/admin` → “Sincronizări care au nevoie de atenție” → Reîncearcă (or per order) |
| Where do they confirm a bank transfer? | `/admin` → the order → “Plata a fost primită” |
| Where are refunds done? | Card: Stripe Dashboard (the site follows automatically). Transfer: bank, then `/admin` → “Înregistrează rambursarea” |

## 25. Launch priorities

**P0: cannot launch without**
1. PostgreSQL provisioned (`DATABASE_URL`) with backups.
2. At least one payment method working in production: Stripe live keys + live webhook, and/or bank details.
3. GoHighLevel: token, location, pipeline with the 8 stages, custom fields, **verified sending domain** (without it customers receive no confirmation).
4. Company identification (legal name, CUI, Reg. Com., office) on the site and full legal texts reviewed (terms, privacy, cookies, returns + withdrawal form).
5. Invoicing decided: FGO API credentials + series + VAT rate, **or** a written decision that invoices are issued by hand at first (then /admin shows “Factură: Manual” on every paid order).
6. `ADMIN_PASSWORD` set; domain + HTTPS; staging test orders §20 flows 1, 3, 5, 6, 7 passed.

**P1: fix before or immediately after launch**
1. Confirm the NEUROS Focus price (2.490 lei, from the source material).
2. GHL workflows W1, W3, W4 and W7 live on day one; W5 and W6 in the first week; W2 after the legal review.
3. Uptime monitor + log alerts (§22).
4. Courier choice and packing routine; free-shipping rule confirmed.
5. Legal review of the points in OPEN-POINTS “LEGAL REVIEW BEFORE GO-LIVE”.
6. Analytics tools chosen + consent banner, then load GTM.
7. “Ce primești în cutie” for each product (not in the source material).
8. CE/FCC documents for NEUROS Focus on file.
9. Stripe’s own receipts off; Apple Pay domain verified.

**P2: after launch**
1. Courier API: AWB creation and delivery status automatically (`/api/webhooks/courier`).
2. Server-side GA4 purchase event from the Stripe webhook.
3. Checkout-abandonment capture before the order is submitted (needs a consent decision).
4. Two-way GHL: stage changes in GHL update the order (today /admin is the control panel).
5. Push the AWB to the FGO invoice (`factura/awb`).
6. Stock tracking (today the store assumes availability and shows no stock claims).
7. Review collection and display (no reviews are shown until they exist).

---

## 26. ADVERTISING LANDING ARCHITECTURE

One landing per product, for paid traffic only. Same app, same catalog, same checkout, same database.

| Landing | Product | Production hostname | Local route |
|---|---|---|---|
| calm | NEUROS Calm (`balance-wave`) | `calm.biohack-tech.ro` | `/lp/calm` |
| focus | NEUROS Focus (`brainlink-pro`) | `focus.biohack-tech.ro` | `/lp/focus` |
| amber | NEUROS Amber (`ochelari-biohack`) | `amber.biohack-tech.ro` | `/lp/amber` |
| brain-flow | NEUROS Flow (`brain-flow`) | `brain-flow.biohack-tech.ro` | `/lp/brain-flow` |

**www.** `www.biohack-tech.ro` answers with a 308 to the same path on `NEXT_PUBLIC_SITE_URL`'s host (`wwwRedirect`), so the host only needs to point `www` at the app.

**Routing.** `src/proxy.ts` + `src/lib/landing-hosts.ts`. The Host header is compared with an explicit allowlist built from `LANDING_SLUGS` and `LANDING_BASE_DOMAIN` (default `biohack-tech.ro`); nothing else is recognized (a forged or unknown host is the main site). On a landing hostname:
- `/` is rewritten to `/lp/<slug>`;
- `/checkout`, `/comanda/<token>`, `/api/checkout`, `/api/consent`, `/api/contact`, the legal pages, `/retragere` and framework files are served on the same host, so consent, cart and the Stripe return stay on one origin;
- `/cart`, `/products` and `/products/<slug>` are also served on the landing host: the cart lives in that origin's storage, so the whole purchase path (landing → checkout → cart → product page for another frame or configuration → cart → checkout) stays on one origin;
- everything else (incl. `/admin`, `/api/webhooks/*`, `/api/jobs/*`, brand pages) gets a 308 to the same path on `NEXT_PUBLIC_SITE_URL`;
- every response carries `X-Robots-Tag: noindex, nofollow`.
Locally, `<slug>.localhost:3000` works outside production (Chrome resolves it to 127.0.0.1).

**Pages.** `src/app/(landing)/lp/[slug]/page.tsx` renders `components/landing/LandingPage.tsx`, which picks one page per product in `components/landing/pages/` (`CalmLanding`, `FocusLanding`, `AmberLanding`, `FlowLanding`). Each is a full sales page in the same order: hero (product, idea, price, action, above the fold) → what it is → how it works → how it is used → when / for whom → what you get (details) → offer (`LandingOffer`, `#comanda`) → questions → help (contact form, `/api/contact`) → final decision. All four use the main site's palette (mist page, white panels, ink text, the site's lines, the red button); only a small accent differs (the site's cyan; the infrared red for NEUROS Flow), and each page has at most one dark section. The pages share a kit (`components/landing/kit.tsx`: shell, header, legal footer, titles, steps, specs, FAQ, help, final CTA, an empty-by-default testimonial slot) and a theme per product from `content/landings.ts` (background, ink, accent as CSS variables; FAQ and meta per product). On phones, `StickyBuy` shows a bottom bar (name, price, action) whenever neither the hero nor the offer is on screen. NEUROS Flow uses the offer's `columns` layout (1 / 4 / 13 zones side by side, catalog prices, opens on 4 zones); NEUROS Amber shows the 2+1 calculation computed by the promotion engine. Names, variants and prices come only from the catalog. The main site uses the `(site)` route group (header + footer); landings have their own minimal header and a legal footer (company line, legal pages, cookie settings, ANPC, withdrawal link). Not linked from the menu, footer, product grid or sitemap.

**SEO.** `robots: noindex, nofollow`, canonical = the product page on the main domain, excluded from `sitemap.xml`, plus the header above. The main site's indexing is unchanged.

**Direct checkout.** One handoff for every purchase button (`src/lib/purchase.ts`): product id, variant id when the product has variants, quantity and the entry surface; never a price. The cart (`cart-store.ts`, localStorage `biohack-cart-v1`) is the canonical state. A landing's “Comandă” (`startCheckout` in `components/landing/checkout-link.ts`) first puts its selection in the cart (never doubling a line that is already there; other cart lines are kept), then opens `/checkout?item=<productId>[:<variantId>][*<qty>]&lp=<slug>&lp_host=<host>&utm_*`. The checkout reads `item` from the router's search params, applies it the same way (so the link also works alone: new tab, shared link, reload) and removes it from the URL. The server prices everything again (`resolveOrderLines`). NEUROS Flow requires a configuration (opens on 4 zones). NEUROS Amber is chosen as a set (`AmberSelector`, mix and match): every frame visible with its photo, name and price, “+ Adaugă” and a stepper per frame, a “Selecția ta” summary (lines, subtotal, 2+1, total, all from the promotion engine) and one button, “Continuă cu selecția”. The handoff carries one `item` per frame (`item=ochelari-biohack:cat-eye-bej&item=ochelari-biohack:patrat-maro*2`), each chosen line gets exactly its quantity (`cartStore.put`), other cart lines are kept, and every frame stays its own cart, order and invoice line. One or two pairs can be bought too; the set in progress survives a reload of the landing (sessionStorage, this tab only).

**Checkout layout.** `/checkout` has its own route group, `(checkout)`, for every visitor: a header with the brand (back to the landing when the checkout came from one, `lp`; otherwise the homepage), the help phone and “Plată securizată”, and a small footer with the company line, contact, the legal and help pages (terms, privacy, cookies, delivery, payments, returns, warranty, withdrawal, cookie settings, ANPC, ANPC SAL). No menu, product lists or “Vezi produsele”. The way back to the cart is “Modifică” in the order summary.

*Defect fixed 29 Sep 2026:* the checkout used to read `?item` from `window.location` during its first render; on a client-side navigation from the landing that still held the landing's URL, so the checkout showed “Coșul tău este gol.” with the product in the address bar. Regression tests: `tests/purchase-handoff.test.ts`.

**Attribution.** No cookie or localStorage is used for it. The URL carries `lp`, `lp_host` and `utm_source/medium/campaign/content/term` from the landing to the checkout; the cart ↔ checkout links (`CarryLink`) keep them. Click ids (gclid, fbclid) are not collected. The server keeps only a known landing, its real hostname (or the main host for `/lp/<slug>`), UTM values cleaned to a safe alphabet, max 100 characters, and `entry`: where the order's first product was added (`home`, `catalog`, `product`, `landing`, `cart_offer`, `recovery`, `link`; stored with the cart line, first touch wins). All in `orders.attribution` (jsonb), shown in /admin (“Sursa comenzii”), written to the `order.created` audit event, and synced to GHL as `contact.bt_last_order_source` (“landing calm · meta / cpc / toamna”, “site, pagina produsului”).

**Consent and analytics.** The landing uses the same `ConsentManager` and consent-gated `track()`: `view_item` on load, `select_variant` on each configuration/frame change (GA4 only), then the checkout's `begin_checkout`, `add_payment_info` and the order page's `purchase` (once per order, deduplicated). Nothing is sent without consent.

**Copy rules.** Romanian, short sentences, no dash punctuation, only facts already on the product pages; no reviews, counters, countdowns, discounts or health promises (enforced by `tests/landing.test.ts`).

**Extension point (documented only, not built): upsell / cross-sell.** A landing may later offer a second product on the offer panel. The only supported way: add `item` parameters to the same checkout link (`item=brain-flow:4-zone&item=ochelari-biohack:patrat-negru`); the checkout already accepts several, and the server prices each. No discount logic exists; any bundle price must first be a catalog price in `config/prices.ts`.

## 27. Phase 4: domains to connect (no DNS change made)

| Hostname | Points to | Purpose |
|---|---|---|
| `biohack-tech.ro` | the app | main store (canonical) |
| `www.biohack-tech.ro` | the app | redirect to apex |
| `calm.biohack-tech.ro` | the same app | NEUROS Calm landing |
| `focus.biohack-tech.ro` | the same app | NEUROS Focus landing |
| `amber.biohack-tech.ro` | the same app | NEUROS Amber landing |
| `brain-flow.biohack-tech.ro` | the same app | NEUROS Flow landing |

Add all six to the host (Railway → Networking) and the CNAME/ALIAS records it shows; set `LANDING_BASE_DOMAIN=biohack-tech.ro` (default). Stripe needs no change: the return URL is built from the page's own origin, and the webhook stays on the main domain. GHL links point to the main domain. Email DNS (SPF, DKIM, DMARC) is §11.

## 28. Product 4: NEUROS Flow (evidence, decisions, conflicts)

**Name (29 Sep 2026):** customer-facing name **NEUROS Flow** (sold on the previous site as “Brain Flow”). Technical identity unchanged on purpose: product id and slug `brain-flow` (URL `/products/brain-flow`, orders, Stripe metadata, FGO `CodArticol brain-flow/<variant>`), variant ids `1-zona` / `4-zone` / `13-zone`, GHL tag `bt-cumparat-brain-flow`, landing host `brain-flow.biohack-tech.ro`. Orders placed before the rename keep “Brain Flow” in their line snapshot.

**Identified from:** the previous rebuild repository (`~/neuros-ecom`, `src/content/brain-flow.ts`, commit 2d1eae6 “v0 rebuild from the original site”, 20 Sep 2026) and its audit of the old live site (`docs/audit.md`: NEUROS Flow pages public but hidden from the menus, 12.900 / 14.900 / 13.900 lei). Photographs: the same files as `laser-cap_*` in the source ZIP (`08_Nefolosite-pe-site`).

| Item | Value used | Source |
|---|---|---|
| Name | NEUROS Flow (no maker stated; not renamed to NEUROS) | source page |
| Kind | Cască de fotobiomodulare transcraniană, infraroșu 810 nm | source page |
| Variants (stable ids) | `1-zona` (1 zone), `4-zone` (4 zones), `13-zone` (13 zones) | source page |
| Prices (VAT incl.) | 12.900 / 14.900 / 13.900 lei | source page |
| Internal reference | `brain-flow/<variant>` (no supplier SKU exists in any source) | ours |
| Specs | 810 nm; zones, frequency and duration adjustable; remote included; rechargeable battery, wireless; initial consultation | source page |

**Conflicts, not resolved by us:**
1. 13 zones (13.900 lei) costs **less** than 4 zones (14.900 lei). Kept exactly as the source lists it; needs business confirmation.
2. `docs/CONTENT-DECISIONS.md` (earlier phase) says NEUROS Flow “nu se vinde”. Phase 3/4 makes it a sold product by instruction; confirm before ads run.
3. The source page listed medical study topics (mood, anxiety, sleep). **Not reused**: the product page and landing make no health claim.
4. Manufacturer, CE / regulatory status, GPSR data, box contents and warranty terms beyond the legal 2 years are unknown (OPEN-POINTS).

## 29. Returns lifecycle (built)

1. The customer declares withdrawal at `/retragere` (or by email/phone). A matching paid order gets `return_status = requested` automatically (`markReturnRequested`); the team can set it by hand in /admin for email/phone requests. CRM: tag `bt-retur-solicitat`.
2. The parcel arrives back and is checked: /admin → “Produsul returnat a fost primit” (`markReturnReceived`). The customer gets the `return_received` email; linked withdrawal statements become `received`; CRM: tag `bt-retur-primit`.
3. The refund is its own step: Stripe dashboard (card; the webhook records it) or “Înregistrează rambursarea” (transfer). The stage becomes *Rambursată*, W7 creates the FGO storno task.
Every step is idempotent (a second call changes nothing) and audited in the order history. The return address is not set (OPEN-POINTS): the withdrawal email says it will be sent to the customer.

## 29a. Homepage structure (29 Sep 2026, final pass)

Hero → **the four products** (one editorial shelf, the only product block: each tile states the moment, name, what it is, price, offer and one action, “Adaugă în coș” for Calm/Focus, “Alege rama” / “Alege configurația” for Amber/Flow, plus “Detalii”) → **De ce Biohack Tech** (three points, one photo) → **“Aceeași zi. Alt ritm.”** (four moments: without a routine vs. with one, typography only) → **Oferte** → 7 purchase questions (all on `/intrebari-frecvente`) → **contact** (support panel + form). The earlier “Ce vrei să schimbi?” chooser was removed (it repeated the products).

**Cart and checkout offer progress.** `promotionProgress()` (`src/lib/promotions.ts`) reports, per promotion touched by the cart: units, units missing, saving, and a state. `components/cart/OfferProgress.tsx` renders it: *far* (a quiet line), *one away* (“Mai adaugă un produs NEUROS Calm, Focus sau Flow” / “Mai adaugă o pereche de NEUROS Amber”, then the benefit in large type, “și primești 20% reducere.” / “și primești 2+1 gratis.”, the exact saving from the engine, “Economisești cel puțin X lei.” / “A treia pereche e gratuită: economisești 315 lei.”, and explicit teal buttons, “+ Adaugă NEUROS Calm”, “+ Adaugă NEUROS Focus”, “Alege NEUROS Flow”, “+ Adaugă încă o pereche”, so only “Finalizează comanda” is red), *active* (“Oferta este activă: …” and, large, “Economisești X lei.”). Nothing is added automatically. The checkout shows the same blocks without buttons.

## 30. Promotions (phase 3.5, built)

Defined once in `src/config/promotions.ts`, applied by the pure engine `src/lib/promotions.ts` (integer bani only):

| Id | Rule | Products |
|---|---|---|
| `trei-produse-20` | 3+ units in the order, any mix (same product counts) → 20% off those units | NEUROS Calm, NEUROS Focus, NEUROS Flow (any configuration) |
| `amber-2-plus-1` | in every complete group of 3 units, the cheapest is free (`floor(n/3)` free) | NEUROS Amber (any frame) |

- The rules touch separate products: Amber neither counts toward nor receives the 20%; no unit is discounted twice.
- **Server truth.** `resolveOrderLines` prices lines from the catalog and runs the engine; `placeOrder` runs it again. Nothing the browser sends about prices or discounts is read (tested with tampered payloads).
- **Order model.** `orders.subtotal_minor` (before promotions), `discount_minor`, `promotions` (jsonb: id, label, amount), `total_minor = subtotal − discount + shipping`; each line keeps `discount_minor` and `promotion_id` (migration 005).
- **Rounding.** 20% is rounded half-up in whole bani on the eligible subtotal, then split across lines by the largest-remainder method, so the parts always add up.
- **Amber 2+1 across frames.** The free units are always the cheapest Amber units in the order (safe if frame prices ever differ); that amount is split over the Amber lines in proportion to their totals, so three different frames at 315 lei each become three lines of 210 lei, never a line at 0 lei on the invoice.
- **Stripe** charges `total_minor`. **Bank transfer** instructions show `total_minor`. **Refunds** compare against `total_minor`.
- **FGO.** Each invoice line sends `PretTotal = line total − line discount` (VAT-inclusive), and its name states the promotion (“NEUROS Calm, 20% la 3 produse: -3828.00 lei”). The invoice total therefore equals the amount paid. Not called against FGO production.
- **GHL.** `bt_last_order_value` and the opportunity value are the discounted total.
- **Emails, order page, admin** show Subtotal, each promotion with its amount, and Total.
- **Customer-facing presentation.** Quiet badges beside prices (home cards, product listing, product page, landing offer), the offer section on the homepage, and the offer progress blocks in cart and checkout (§29a), with no countdowns and no struck prices. The terms are on /plati.

## 30a. Purchase entry points and segmentation data (29 Sep 2026)

**Entry points (all end in the same cart lines).** Homepage shelf: “Adaugă în coș” (Calm, Focus), “Alege rama” / “Alege configurația” (Amber, NEUROS Flow → product page picker). `/products` and product pages: variant picker + quantity + “Adaugă în coș”. Landings: hero “Comandă” (Calm, Focus: direct checkout), anchors to the offer (`#comanda`: header, mid-page, sticky bar on phones, final section), offer “Comandă …” (direct checkout with variant and, for Amber, quantity). Cart: offer actions (“+ Adaugă …”, “Alege NEUROS Flow”, “Altă ramă”). Recovery link `/reluare/<token>`: restores the unfinished order's lines. Post-purchase: server-side offer, a separate `kind='upsell'` order.

**What the order already answers** (no duplication; `src/lib/segments.ts` is the agreed reading, tested in `tests/segments.test.ts`):

| Question | Source |
|---|---|
| Bought Calm / Focus / Amber / NEUROS Flow | `order_items.product_id` (`balance-wave`, `brainlink-pro`, `ochelari-biohack`, `brain-flow`) on orders where `isConfirmedPurchase` |
| Frame / configuration | `order_items.variant_id` (`cat-eye-bej`…, `1-zona` / `4-zone` / `13-zone`) |
| Promotion eligible / reached / applied | items vs `config/promotions.ts` (eligible, qualified); `orders.promotions[].id` and `order_items.promotion_id` (applied, stable ids `trei-produse-20`, `amber-2-plus-1`) |
| Original or post-purchase order | `orders.kind` (`checkout` / `upsell`), `parent_order_id` |
| Landing, campaign, entry surface | `orders.attribution` (`landing`, `utm`, `entry`) |
| Purchase or abandoned intent | `purchaseState()`: confirmed / refunded / open / abandoned / cancelled from `status` + `payment_status` |
| Marketing consent | `orders.marketing_consent` and the consent ledger; never derived from a purchase |

`customerProfile(orders)` combines one customer's orders: products bought (confirmed only), configurations, promotions used, products left only in abandoned orders, upsell count, landings. GHL keeps its current fields and tags: `bt-cumparat-*` is added only for a confirmed purchase (the same `isConfirmedPurchase` rule; the id `bt-cumparat-brain-flow` stays for NEUROS Flow), `bt_last_order_products` / `bt_last_payment_status` show the last order including unfinished ones, `bt_marketing_consent` is separate. No new GHL fields or tags were added; configuration or promotion tags can be derived from the database when a campaign needs them.

## 30b. Suggestions and the NEUROS Amber 2+1 picker (29 Sep 2026)

**One engine** (`src/lib/recommend.ts`) for every placement: cart, checkout, post-payment (and the product page / homepage offers). Deterministic rules: (1) finish a promotion one step away (the next Amber pair, then a third product for the 20%; not after payment), (2) the complementary pairs of `config/upsell.ts`, (3) never what is already there unless a promotion needs it. NEUROS Flow is suggested only to complete the 20% in the cart/checkout, with its configuration picker; never as an impulse suggestion, never after payment. The post-payment offer (`upsellFor`) now calls the same engine; its map is unchanged.

**Where.** Cart: lines → summary (totals, offer progress, “Finalizează comanda”) → “Completează oferta” (finishing an offer) or “Completează rutina” (complementary), up to 3, below the button. Checkout: “Mai ai un pas până la ofertă” or “Completează rutina” (up to 2) after the summary and before the terms and the payment button; folded on phones, open from tablets up. Post-payment: “Comanda ta este confirmată.” first, then the one optional offer (two explicit steps, unchanged payment safety). Simple products are added in place; NEUROS Amber opens the 2+1 picker; NEUROS Flow its configuration picker. Adding keeps the checkout form, the payment method, the landing and UTM parameters; prices come from the catalog and the server prices the order again.

**NEUROS Amber 2+1 picker** (`components/offers/OfferSheets.tsx`, logic in `lib/amber-pairs.ts`): opens in place from the homepage offer, the product page offer, cart and checkout suggestions (full-screen sheet on phones). Three slots (“Perechea 1–3”), each a frame (Cat eye / Unisex pătrat, with photos) and a colour that exists for it (cat eye: negru, bej; pătrat: negru, maro). Totals from the promotion engine, including pairs already in the cart. One button adds all pairs at once (`cartStore.addMany`, all or nothing); identical pairs become one line with that quantity. Closing adds nothing. When the cart already has Amber, it asks only for the missing pairs.

**Entry sources and analytics.** Lines added from suggestions remember `cart_cross_sell` / `checkout_cross_sell` / `amber_configurator`; the order's acquisition (`attribution`: landing, UTM, and `entry` = the first line's source) is never replaced. GA4-only events, with analytics consent only: `view_cross_sell`, `select_cross_sell`, `add_cross_sell`, `open_amber_bundle_configurator`, `complete_amber_bundle_configurator` (`placement`, `product_id`, `variant_id`).

**Offer wording at every quantity** (`lib/offer-copy.ts`, from `promotionProgress`: `freeUnits`, `untilNext`): NEUROS Amber 0 → “Alege 3 perechi. Plătești 2.”, 1 → “Mai alege 2 perechi pentru 2+1.”, 2 → “Mai alege 1 pereche. A treia este gratuită.”, 3 → “2+1 activ” + saving, 4 → the same + a quiet “Încă 2 perechi până la următoarea pereche gratuită.”, 5 → a visible “Mai adaugă 1 pereche și primești încă una gratuită.”, 6 → “2 perechi gratuite”, and so on (9 → 3 free). The pickers never open by themselves.

**20% for 3 products picker** (`BundlePicker`, logic in `lib/bundle-picks.ts`): one slot per product the cart still needs (3, 2 or 1; none once the 20% applies), each NEUROS Calm, Focus or Flow (the same product may repeat), NEUROS Flow only with its configuration; totals from the promotion engine; “Adaugă selecția în coș” adds everything at once; closing adds nothing. Opens from the homepage offer (image and button), the product page offer (Calm, Focus, Flow) and the cart / checkout completion row.

## 30c. Isolated Stripe TEST environment (manual payment testing)

`npm run stripe:test` (add `-- --fresh` for an empty database) checks first and stops with a clear message if anything is missing: TEST keys only, the port free, `stripe listen` connected, the app healthy with card payments available and the checkout serving the TEST publishable key. It starts a second local instance on http://localhost:3100 with `ISOLATED_TEST=1`, enforced in `src/server/config.ts`: its own embedded database (`.data/stripe-test/db`), no FGO, no GoHighLevel, emails as files (`.data/stripe-test/emails`), Stripe TEST keys only (live keys are refused by the script and rejected by the app outside production). It starts `stripe listen` (Stripe CLI) with the matching signing secret and stops it on Ctrl+C. Keys: `STRIPE_TEST_SECRET_KEY` / `STRIPE_TEST_PUBLISHABLE_KEY` in `.env.local` if set, otherwise the normal Stripe keys when they are test keys. Admin: user `test`, password in `.data/stripe-test/admin-password`.

## 31. Post-purchase offer (phase 3.5, built)

**Flow.** Checkout → card payment confirmed by Stripe (webhook or reconcile, never by the page) → the order page shows “Comanda ta este confirmată.” first, then, below, one optional offer. The offer requires two explicit clicks: “Adaugă la comandă”, then “Da, plătește X lei” with the amount and the card stated. “Nu, mulțumesc” ends it. Bank-transfer orders never get it.

**What is offered.** `src/config/upsell.ts` (`UPSELL_MAP`): the first product in the list for what was bought that is not already in the order. Calm → Amber, Focus; Focus → Amber, Calm; Amber → Calm, Focus; NEUROS Flow → Amber, Calm. NEUROS Flow is never offered after a purchase (it is chosen with a specialist). Normal catalog price and normal promotion rules; no special upsell discount.

**Stripe.** Card checkout orders get a Stripe Customer, and the PaymentIntent uses `setup_future_usage=on_session`, so Stripe keeps the card for on-session reuse only. The checkout states it next to the card field and in /privacy-policy and /plati. The webhook/reconcile stores only `payment_method` and `customer` ids; card data never reaches us. The offer PaymentIntent is created and confirmed server-side with that customer + payment method, without `off_session`, so Stripe applies SCA: `requires_action` → the page opens Stripe's authentication step (`handleNextAction`) → the server re-reads the PaymentIntent from Stripe. The card is **detached** as soon as the offer is settled (paid, declined, failed) or after `UPSELL_WINDOW_MINUTES` (30) with no answer (`upsell.release` job).

**Order model.** A separate order, `kind='upsell'`, `parent_order_id` = the paid order, same buyer and addresses, its own number, PaymentIntent, FGO invoice, GHL opportunity (so W1/W4 prepare it like any paid order) and confirmation email. At most one per parent (unique index). The parent is never modified except `upsell_status` (offered / accepted / declined / expired). Admin shows “Comandă inițială ↳ BHT-…” and “↳ adăugată la BHT-…” so both ship together.

**Safety (tested).** Double click and concurrent requests → one PaymentIntent (row lock + Stripe idempotency key); refresh, back or opening the order URL → nothing charged (viewing never charges); another product, another variant or a tampered price → refused or ignored; unknown token → refused; unpaid, transfer or expired order → refused; card declined → the extra order is closed and its PaymentIntent cancelled, the parent stays paid; authentication closed → cancelled the same way; a repeated webhook → idempotent. A declined or failed offer is not an abandoned checkout: no abandonment job, no recovery.

**Verified against Stripe TEST (29 Sep 2026):** discounted card order charged exactly 12.830 lei with customer + on_session; one-click offer charged once (315 lei) despite a double click, parent card released afterwards; decline released the card with no charge; with an always-authenticate card, the offer returned `requires_action` and Stripe's 3DS step opened on our page (completing that nested step could not be automated in the browser; the completion and the abandonment paths are covered by tests).

## 32. Contact form (phase 3.5, built)

Homepage (last section before the footer) and /contact-us. Fields: name, email, optional phone, topic, message; a privacy line; no marketing consent. `POST /api/contact` validates again, drops bots (hidden field, minimum 2.5 s on the page) with the same “sent” answer, rate-limits 5 per 10 minutes per address, caps the body at 16 KB, and is idempotent per submission attempt. Stored in `enquiries` (reference `MSG-…`, status `new` / `in_progress` / `resolved`, source page, attribution). Operators work in /admin/mesaje (filters, status buttons, mailto/tel). The outbox (`ghl.enquiry`) upserts the sender in GHL with identity only and the tag `bt-mesaj-contact`; a GHL outage keeps the message and retries.
