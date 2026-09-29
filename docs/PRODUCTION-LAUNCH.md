# Biohack Tech: production launch runbook

Written 26 September 2026 against commit “Launch pass”. Everything below refers to code that exists in this repository. Items marked **YOU** need an account, a credential or a business decision; nothing in them has been invented.

---

## 1. Current status

| Area | Status |
|---|---|
| Storefront (home, 3 product pages, cart page, checkout, order page, legal, 404) | Built, tested at 390/430/768/1024/1280/1440 |
| Prices | NEUROS Calm 6.380 lei, NEUROS Amber 315 lei (approved), NEUROS Focus 2.490 lei (from source, confirm) |
| Canonical orders (PostgreSQL) | Built and tested (PGlite + real PostgreSQL concurrency tests) |
| Card payments (Stripe Payment Element, own checkout) | Built; **verified in Stripe TEST mode** with real test payments and real webhooks (`scripts/stripe-e2e.mjs`, 19/19). Needs live keys + live webhook for production |
| Bank transfer | Built and tested end to end; real bank details verified locally (IBAN checksum, checkout, order page, instructions email). Production host needs the same `BANK_*` values |
| FGO invoices | Built to the official FGO API v7.1 spec; tested against a mock (idempotency, outage, rejection). **Needs FGO API credentials; never called against FGO yet** |
| GoHighLevel CRM + transactional email | Built on API v2 (2021-07-28); tested against a mock (idempotency, outage, permanent rejection, retry). **Needs token, location, pipeline, fields, sending domain; never called against GHL yet** |
| Operations (/admin) | Built: orders, payment confirmation for transfers, shipping + AWB, delivery, cancel, refunds for transfers, failed-sync retry |
| Courier integration | Not built (no courier chosen). AWB entered by hand in /admin |
| Analytics | Event layer built (GA4 format); no tracker installed (needs IDs + consent) |

**The store is not live-ready until the P0 items in §24 are done.** Most of them are accounts and credentials, not code.

## 2. What is complete

- One source of truth for prices: `src/config/prices.ts` (integer bani, VAT included). Everything reads it: listings, product pages, cart, checkout, server total, Stripe amount, FGO lines, GHL value, emails, JSON-LD.
- Cart: `/cart` page (no drawer). Add to cart → check + “Adăugat în coș” → compact confirmation top right (desktop) / bottom card (phone), with “Finalizează comanda” and “Continuă cumpărăturile”. The cart persists in localStorage as ids + quantities only and is re-priced from the catalog on every load.
- Checkout: contact, billing (persoană fizică / juridică with CUI check digit), delivery (same address by default), payment (card or bank transfer), order summary, terms + optional marketing consent. The draft survives a refresh (sessionStorage only).
- Server: the browser sends ids, quantities and the form; the server prices the order, stores a snapshot, and creates the Stripe PaymentIntent for exactly that total.
- Payment truth: only Stripe can mark a card order paid: the signed webhook, or the `stripe.reconcile` job (server-side retrieve, 10 minutes after the order and again before an order is marked abandoned) if the webhook was lost. The order page only reads; it never marks payments or starts workflows. Bank transfers become paid only when a person confirms the statement in /admin.
- Side effects (CRM, invoice, email) go through a database outbox with unique keys: retried with backoff, never duplicated, visible in /admin when they fail.
- Transactional emails are rendered by the site (HTML + text) and delivered through GoHighLevel.
- 105 automated tests (money, cart, validation, order state machine, idempotency, webhook route and signatures, browser-closed payment, reconciliation, FGO/GHL mapping, email rendering, outbox retries and outages, abandonment, transfer expiry, admin authorization, the real three-product catalog end to end, concurrency on PostgreSQL) + `scripts/stripe-e2e.mjs` against Stripe test mode.
- /admin: HTTP Basic Auth in the proxy **and** inside every admin action (actions are HTTP endpoints; each verifies the credentials itself). Only bank transfers can be marked paid by a person; card money is confirmed by Stripe only.

## 3. What is blocked, and by what

| Blocked | By | Effect until provided |
|---|---|---|
| Any online order in production | `DATABASE_URL` | Checkout shows “comenzile online se activează în curând” with email/phone |
| Card payments | Stripe live account + 3 keys + webhook | “Card bancar” shows “În curând” |
| Bank transfer | Beneficiary, bank, IBAN | “Transfer bancar” shows “În curând” |
| Automatic invoices | FGO API user, private key, series, VAT rate | Orders show “Factură: Manual” in /admin |
| CRM + all customer emails | GHL token, location, pipeline, fields, sending domain | No confirmation emails (**P0**) |
| Legal compliance | Company data, full legal texts | Footer and legal pages incomplete (**P0**) |

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
| Unpaid card order after `ABANDON_AFTER_MINUTES` | `order.abandoned` | – | → `Plată nefinalizată` (status abandoned) | – from the site; GHL W2 recovery, consent only |
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
- `locations/customFields.readonly` (optional, for checking the fields)
Copy the token → `GHL_PRIVATE_TOKEN`. Location id (Settings → Business Profile) → `GHL_LOCATION_ID`.

Settings → General: **“Allow duplicate contact” off**, matching on email first. The site upserts by email/phone; with duplicates allowed GHL would create one contact per order.

### 10.2 Pipeline “Comenzi Biohack Tech”
Create it with these stages **in this order and with these exact names** (the site finds stages by name; copy them from here):

| # | Stage (exact name) | Purpose | Entry (automatic, from the site) | Exit | Automation | Manual action | Order status | Payment status | Customer email (sent by the site) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `Așteaptă transferul` | Transfer orders waiting for money | Transfer order placed | Payment confirmed in /admin, or cancelled | W1 team notification; W3 reminder after 48 h | Check the bank statement daily | pending | awaiting_transfer | “Comanda #…: datele pentru transfer” |
| 2 | `Plată nefinalizată` | Card checkout started, never paid | 60 min after an unpaid card order | Paid later → Plătită; closed if another order is paid | W2 recovery (consent only) | none | abandoned | pending / failed | none from the site |
| 3 | `Plătită, de pregătit` | Paid, to pack | Stripe confirms, or transfer confirmed in /admin | Marked “în pregătire” or shipped | W1 team notification | Pack the order | confirmed | paid | Card: “Comanda ta Biohack Tech #…”. Transfer: “Am primit plata…”. Both: “Factura pentru comanda #…” |
| 4 | `În pregătire` | Being packed (optional) | “Marchează în pregătire” in /admin | Shipped | – | Create AWB at the courier | processing | paid | none |
| 5 | `Expediată` | At the courier | AWB entered in /admin | Delivered | – | – | shipped | paid | “Comanda #… a fost expediată” (courier, AWB, tracking link) |
| 6 | `Livrată` | Delivered | “Marchează livrată” in /admin | – | W4 getting started, W5 review, W7 specialist call | – | delivered | paid | none (GHL W4) |
| 7 | `Anulată` | Cancelled | Cancelled in /admin | – | – | Refund if it was paid | cancelled | any | “Comanda #… a fost anulată” (transfer or paid orders) |
| 8 | `Rambursată` | Fully refunded | Full refund in Stripe (webhook) or recorded in /admin | – | – | Storno in FGO | any | refunded | “Rambursare pentru comanda #…” |

Opportunity: name `BHT-20260929-0007 · Prenume Nume`, value = order total in lei (minus refunds), status `open` (waiting), `won` (paid and later), `lost` (cancelled/refunded), `abandoned`. One opportunity per order: its id is stored on the order, and a lost id is recovered by searching the order number, so retries never duplicate it. Copy the pipeline id → `GHL_PIPELINE_ID`.

### 10.3 Contact custom fields
Settings → Custom Fields → Contact. Create them so the **field keys** are exactly these (GHL derives the key from the name; name them `bt_customer_type` etc., then rename the label if you like; the key stays):

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
| `contact.bt_marketing_consent` | Single line (Da/Nu) | Marketing filter | Checkout checkbox | Da |

Standard fields filled too: first/last name, email, phone, company name (PJ), address, city, county, postal code, country, source `biohack-tech.ro`.

**Verify on the first test order** that the custom fields are filled (GHL has changed the custom-field payload format between doc versions; the site sends `{ key, fieldValue }`). If they stay empty, the one place to change is `contactPayload()` in `src/server/integrations/ghl.ts`.

### 10.4 Tags (only these)
- `client`: has at least one paid order.
- `cumparat-calm`, `cumparat-focus`, `cumparat-amber`: bought that product (per-product education and cross-sell).
- `client-firma`: bought as a company (PJ).
Tags are added only after payment and never removed by the site. Everything else is a field or a pipeline stage.

### 10.5 Workflows to create in GHL
Transactional emails come from the site. **Do not** add workflow steps that email order confirmations, bank details, shipping or refunds; the customer would get them twice.

| # | Name | Trigger | Filters | Steps / delays | Email | Fields / pipeline | Exit / stop | Duplicate prevention | Type |
|---|---|---|---|---|---|---|---|---|---|
| W1 | Comandă nouă: notificare echipă | Opportunity created **or** stage changed to `Plătită, de pregătit`, pipeline “Comenzi Biohack Tech” | – | Internal notification (email/SMS/app) to the team with `{{opportunity.name}}`, value, link | Internal only | – | – | “Allow re-entry” off | Internal |
| W2 | Recuperare plată nefinalizată | Stage changed to `Plată nefinalizată` | `bt_marketing_consent` = Da (pending legal decision, §16) | Email R1 now → wait 23 h → if stage is still `Plată nefinalizată` and `bt_last_payment_status` ≠ plătită → Email R2 → end | R1 “Comanda ta te așteaptă”, R2 optional | – | Stage changes (paid/closed) → exit | Re-entry off | Marketing |
| W3 | Transfer: reamintire | Stage changed to `Așteaptă transferul` | – | Wait 48 h → if still in stage → Email T1 (order number, amount, link to order page `{{contact.bt_last_order_number}}`) → wait 3 days → if still in stage → internal task “sună clientul sau anulează” | T1 “Reamintire: comanda #… așteaptă plata” | – | Stage changes → exit | Re-entry off | Transactional (payment reminder) |
| W4 | După livrare: primii pași | Stage changed to `Livrată` | Branch by tag `cumparat-calm` / `-focus` / `-amber` | Wait 1 day → product “primii pași” email | Per product (content to write, no medical advice) | – | – | Re-entry off | Service |
| W5 | Cerere recenzie | Stage changed to `Livrată` | `bt_marketing_consent` = Da | Wait 14 days → review request email | Link to your chosen review page (decide: Google Business profile) | – | Stage `Rambursată`/`Anulată` → exit | Re-entry off | Marketing |
| W6 | Cross-sell (inactive at launch) | Stage `Livrată` | consent = Da; e.g. has `cumparat-calm` and not `cumparat-amber` | Wait 30 days → one email | Product suggestion | – | Purchase of that product → exit | Re-entry off | Marketing |
| W7 | Specialist: primul apel | Stage changed to `Livrată` | tag `cumparat-calm` or `cumparat-focus` | Create task for the specialist: “Apel de început” due in 2 days | none | – | – | Re-entry off | Internal (the “ajutor la început” promised on the site) |

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
| R1/R2, T1, W4, W5, W6 | see §10.5 | GHL workflows | GHL merge fields | as designed | see §10.5 |

Every email: plain text version included, support line with the order number, no marketing blocks.

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

**Decisions (YOU):** courier (Fan Courier, Sameday, Cargus…), confirm free shipping for all orders, pickup schedule, whether to offer easybox/lockers, Romania only (the checkout accepts only Romanian counties). **Not built:** automatic AWB generation (needs the courier’s API account; P2), delivery tracking sync (P2). Today: create the AWB in the courier’s portal, paste it into /admin.

## 15. Analytics setup

**Built:** `src/lib/analytics.ts` pushes GA4-format ecommerce events to `window.dataLayer`: `view_cart`, `begin_checkout`, `add_payment_info`, `purchase` (order page, only when the server says the order is paid, once per order per browser, `transaction_id` = order number, value/currency RON). Nothing is loaded; no cookies are set by analytics today.

**To do (YOU, P1):** decide the tools (GTM + GA4 recommended; Meta Pixel if you run Meta ads), provide the ids, and add a consent banner (Google Consent Mode v2) before loading any of them. `add_to_cart` and `view_item` are the next two events to wire when GTM goes in. A server-side purchase event (GA4 Measurement Protocol from the Stripe webhook) is P2.

## 16. Legal requirements (YOU + your lawyer/accountant)

Must exist before launch (the site does not invent them):
1. **Company identification** in the footer and on the terms page: legal name, CUI, Reg. Com. number, registered office, share capital if applicable, contact. (§ 18 lists what to send.)
2. **Full Terms and conditions**, **Privacy policy** (the processors are listed: Stripe, FGO, GoHighLevel, courier, hosting), **Cookie policy** (the site uses only functional browser storage for the cart; Stripe.js sets its own fraud-prevention cookies on checkout; analytics would need consent), **Shipping** and **Returns** policies. The published pages are short versions and say so.
3. **Right of withdrawal** (OUG 34/2014): 14 days + the model withdrawal form.
4. **ANPC / SAL** link: present in the footer. (The EU ODR platform closed in July 2025; no link needed.)
5. **Marketing consent:** the checkbox is optional and unticked. Decide whether W2 (checkout recovery) and W4 (usage emails) may go to customers without marketing consent, under legitimate interest. Until then the site stores the consent and the workflows filter on it.
6. **Wellness claims:** the product copy is conservative (“poate ajuta”, “nu înlocuiește sfatul medicului”). Have it reviewed; keep the CE/FCC documents for NEUROS Focus on file.
7. **Data retention:** decide how long orders are kept (accounting: 10 years for invoices) and how an erasure request is handled (delete in GHL, anonymise in the database except fiscal data).

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
| 1 | PF, card | NEUROS Calm → add → popup “Finalizează comanda” → PF → card `4242 4242 4242 4242`, any future date, any CVC | Order page “Plata este confirmată”; /admin: Plătită, Factură Emisă; GHL: contact, fields, tags `client` + `cumparat-calm`, opportunity in “Plătită, de pregătit”, value 6380; emails: confirmation + invoice (one each) |
| 2 | PJ, card + 3-D Secure | NEUROS Amber Unisex pătrat Maro ×2 + NEUROS Focus → PJ with a real CUI → card `4000 0027 6000 3184` → complete the challenge | FGO test invoice on the company with CUI, lines with the exact variant; totals 2.490 + 630 |
| 3 | Declined card | card `4000 0000 0000 0002` | Message in checkout, nothing charged; order stays “Card eșuat”; retry with 4242 on the same page → paid; one order, one invoice |
| 4 | Webhook without browser | Pay, then close the tab before the redirect | Order paid within seconds (webhook) |
| 5 | Webhook replay | Stripe Dashboard → the event → Resend | No second invoice, email or opportunity |
| 6 | PF, transfer | NEUROS Calm → transfer | Order page with bank details; email “datele pentru transfer”; GHL stage “Așteaptă transferul”; no invoice |
| 7 | Transfer paid | /admin → the order → “Plata a fost primită” | Email “Am primit plata”, invoice, stage “Plătită, de pregătit” |
| 8 | Ship + deliver | /admin → courier + AWB + tracking link → then “Marchează livrată” | Shipping email with the link; stages Expediată → Livrată; W4/W7 start |
| 9 | Refund | Stripe → refund payment of flow 1 | Order “Rambursată”, email, GHL stage “Rambursată”; storno per your FGO setting |
| 10 | Cancel | Transfer order → /admin → Anulează | Email “anulată”, stage “Anulată” |
| 11 | Abandoned card | Start a card checkout, stop before paying, wait 60 min | Stage “Plată nefinalizată”; W2 only if consent |
| 12 | Phone | Repeat flow 1 and 6 on an iPhone and an Android | Popup at the bottom, Payment Element, Apple/Google Pay if enabled |

**Automated check (test mode):** with the app running on PostgreSQL and `stripe listen --forward-to <app>/api/webhooks/stripe` feeding it, `E2E_BASE_URL=<app> DATABASE_URL=<same db> node scripts/stripe-e2e.mjs` runs flows 1, 3, 4 and more against real Stripe test payments: paid with the browser gone, decline then retry, 3-D Secure pending, cancellation, double submit, invalid signature, bank transfer. It refuses live keys.

**Cleanup:** cancel test orders in /admin (production DB: none should exist; staging has its own DB), delete test contacts/opportunities in GHL, test invoices stay in the FGO test account only.

## 21. Go-live procedure

The ordered sequence:

1. Railway project + PostgreSQL; backups on.
2. Deploy the repo with `APP_ENV=staging`, test keys, FGO test, GHL (test contacts). Health = 200.
3. GHL: Private Integration, pipeline + 8 stages, 11 custom fields, sending domain verified, W1 + W3 created (W2/W4/W5/W7 can follow).
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
2. GHL workflows W1 (team notification) and W3 (transfer reminder) live on day one; W4, W7 in the first week.
3. Uptime monitor + log alerts (§22).
4. Courier choice and packing routine; free-shipping rule confirmed.
5. Marketing-consent decision for W2/W4 (§16).
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
