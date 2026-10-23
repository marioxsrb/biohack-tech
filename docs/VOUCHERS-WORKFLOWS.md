# Vouchers, rewards and the 14 email workflows: infrastructure

Written 21 October 2026 on branch `feat/vouchers-workflows`. Nothing here is live. The branch was not pushed or deployed. Everything new is either additive (tables, modules) or behind a switch that is off by default.

Production behaviour does not change until:
- someone issues a voucher, or
- `POPUP_VOUCHERS` / `WORKFLOWS_MODE` is set.

Items marked **YOU** need a decision, a credential or approved copy.

## 1. What exists

| Area | Where | State |
|---|---|---|
| Personal fixed-value vouchers (Calm 640, Focus 325, Amber 30 lei per paid pair) and gifts | `src/config/vouchers.ts`, `src/server/vouchers.ts` | Built and tested. Issued only by a workflow, the popup switch or a person in `/admin/vouchere` |
| One code field for promo codes, vouchers and referral codes | `src/server/codes.ts`; used by `/api/promo` and `placeOrder` | Built. The existing codes behave exactly as before |
| Pricing engine: Amber 2+1 + 30 lei per paid pair, gifts at 0 lei, mixed carts | `src/lib/promotions.ts` (pure, integer bani) | Built. 1–7 pairs and mixed frames tested |
| Gift delivery (the product is free, the delivery is paid) | `src/lib/shipping.ts` (`gift` option), checkout preview | Built; **YOU**: the fee (§4) |
| Rewards: Review Video, Referral, VIP | `src/server/rewards.ts`, `src/server/referrals.ts` | Built, nothing granted by itself |
| Review video upload (direct to storage, signed URL) | `src/server/integrations/video-storage.ts` | Built. Off until **YOU** create the storage bucket (§6) |
| The 14 workflows / 59 emails (timings, stops, pauses, priorities, weekly limit) | `src/config/workflows.ts`, `src/server/workflows/planner.ts` | Built (pure, tested) |
| Workflow engine (enrollments, dry run) | `src/server/workflows/engine.ts`, cron `/api/jobs/run` | Off by default (`WORKFLOWS_MODE`). `dry_run` records what would be sent; nothing sends |
| Email variables (`{{cart_items}}`, `{{voucher_amount}}`...) | `src/server/workflows/variables.ts` | Built (data only, no new sentences) |
| GHL sub-account mapping (tag per email + fields) | `src/server/workflows/ghl-map.ts` | Built, never called. **YOU**: sub-account credentials (§7) |
| Landing popups: fixed voucher instead of 10% | `src/server/popup-vouchers.ts`, `welcomeSignup` | Behind `POPUP_VOUCHERS=on`, which is off. **YOU**: new popup and email text first |
| Admin `/admin/vouchere` | Vouchers with history, manual issue / revoke / restore (audited), rewards, review videos | Built (internal page, existing admin styles) |
| Fulfillment | Gift lines are marked "cadou (recompensă)" | Built (text only) |
| Database | Migration `032_vouchers_rewards_workflows` (new tables + `orders.voucher_id`) | Additive; applied on the next deploy |

## 2. Voucher rules (as built)

1. **Personal.** A voucher belongs to the email it was issued to. A different address gets "Codul este personal…" in the checkout and in the preview. The code (`BTV…` value, `BTG…` gift) is 8 random characters out of 31. The preview is rate-limited, and a code reveals nothing about the person.
2. **One product, one fixed value, once.** The value applies only to its product's lines, never below 0, and never to the book or another product.
3. **One code per order.** A voucher, a referral code and a promo code never add up.
   - The Amber 2+1 is automatic, not a code.
   - The business offer (25+ units) keeps its rule: whichever saves more.
4. **Server-side, inside the order's transaction.** The voucher row is locked. Ten simultaneous orders give it to one (tested on PGlite and on real PostgreSQL 17).
5. **Issued once.**
   - At most one active marketing voucher per contact and product; a second trigger reuses it (`reused` in the history).
   - The same `(source, source_ref)`, for example the abandoned checkout id, never issues twice.
   - It is not issued after the contact bought the product, or after they used a voucher for it.
6. **Expiry by workflow** (`VOUCHER_VALIDITY_DAYS`). Landing: 7 days, as the emails say. The others are proposals, **YOU** (§4). The expiry counts from issue, and an hourly sweep marks expired vouchers.
7. **Follows its order.** The history is in `voucher_events`.
   - **Released:** when the order is cancelled, an unpaid card attempt is abandoned or superseded, the PaymentIntent is cancelled, or the order is fully refunded. It is released back to active, or marked expired if past its date.
   - **Partial refund:** the voucher stays used.
   - **Late card payment:** the voucher is taken back if still free. Otherwise both orders keep their price and `voucher.conflict` is recorded on the voucher and the order.
8. **Lei only.** The international checkout refuses vouchers.
9. **Invoice.** The FGO line names it: "Voucher NEUROS Calm BTVC…: -640.00 lei", "Cadou NEUROS Amber BTGA…". Line totals still add up to what was paid.
10. **The old codes are untouched.** LONGEVITY10, BIOHACK10, CADOU1233 and CADOU100 keep working; nothing deactivates them.

**"Contul tău Biohack Tech".** The balance is the contact's active vouchers (`vouchersFor`). Nobody can see another person's vouchers by typing an email. The code reaches the customer only by email or by the link that brings it into the checkout (`/api/lead/resume?...&cod=` already exists). **YOU:** a customer-facing "my vouchers" page is a new visual component; it needs a design and copy decision. The data function exists.

## 3. NEUROS Amber 2+1 + 30 lei per paid pair (final rule, 21.10.2026)

The 2+1 offer and the 30 lei per paid pair add up. The 30 lei come with the contact's eligible **Amber voucher** (`audience: 'voucher'`). There is **no global cap**: `maxPairs: null`.

**Grouping rules (as built and tested):**
1. Every complete group of 3 pairs has one free pair. Free = floor(units / 3); a mixed selection counts together.
2. The free pairs are the cheapest units. Today all frames cost 315 lei, so any pair can be the free one.
3. Paid pairs = units − free. Each paid pair gets 30 lei off; the free pair never does.
4. The 2+1 amount and the voucher amount are spread over the Amber lines, so every invoice line adds up to what was paid.

**At 315 lei per pair:**

| Pairs | Free | Paid | Total |
|---|---|---|---|
| 1 | 0 | 1 | 285 lei |
| 2 | 0 | 2 | 570 lei |
| 3 | 1 | 2 | **570 lei** |
| 4 | 1 | 3 | 855 lei |
| 5 | 1 | 4 | 1.140 lei |
| 6 | 2 | 4 | 1.140 lei |
| 7 | 2 | 5 | 1.425 lei |
| 9 | 3 | 6 | 1.710 lei |

Tested in the engine (1–7 and 9 pairs, mixed frames, different prices), through the checkout (3, 4, 6 and 7 pairs: order, Stripe, FGO lines), and in Stripe TEST mode (3 pairs = 570 lei).

Without the voucher, Amber keeps the plain 2+1. `audience: 'all'` (every Amber order) exists, but it is a live price change and stays off.

Note for the copy (not changed): landing-amber-03 says "Și mai primești 60 lei reducere la comandă". That is exact for 3 pairs. For 4 or more pairs the reduction is higher (30 lei per paid pair).

## 4. Decisions to confirm (**YOU**)

| Decision | Built default | Where |
|---|---|---|
| Validity | **30 days from issue, every source (approved 22.10.2026)**. Note: landing-*-01 says "în următoarele 7 zile" (copy not changed: decision) | `VOUCHER_VALIDITY_DAYS` |
| Delivery fee of a gift order | **25 lei once per order (approved 22.10.2026)**; gift + book: 25 lei once (not 25 + 12,10: to confirm) | `GIFT_SHIPPING_RON` |
| A voucher on top of the quantity discount (2 Calm: 10% + 640 lei) | stacks, like today's 10% codes | engine |
| Referral friend discount: all products, stacking like the 10% codes | 10%, all products | `referralRule` |
| Same shipping address as the referrer | friend keeps 10%, no reward | `attributeReferral` |
| VIP total: paid or collected orders, net of refunds, any time | as described | `validPurchases` |
| Weekly limit 2 or 3 | 3 (`WORKFLOWS_WEEKLY_LIMIT`) | `config/workflows.ts` |
| Abandoned Cart exempt from the weekly limit (the customer's own action) | exempt | `capExempt` |
| Win-back second email 7–14 days | 7 days (per enrollment `secondAfterDays`) | planner |

## 5. Workflows (14 workflows, 59 emails)

**Timings.** They match Email Studio exactly; 59 distinct template ids are tested.

**Priority, from first to last:**
1. Abandoned Cart
2. Post-Purchase
3. Landing Calm / Focus / Amber
4. Referral and VIP
5. Welcome
6. Educație
7. Win-back and Nudge
8. Black Friday, Crăciun, Anul Nou

**Planner rules** (`planner.ts`, applied in this order):
1. A purchase stops what it should.
   - Abandoned Cart, Win-back and Nudge stop on any purchase.
   - A landing sequence stops only when its own product is bought.
2. No marketing consent, or an unsubscribe, stops the promotional emails. Post-Purchase 01–03 (guides, review request) still go.
3. Abandoned Cart pauses the landing, Welcome, Educație and seasonal sequences. Post-Purchase pauses Win-back and Nudge. They resume afterwards.
4. Win-back and Nudge never run together.
5. Black Friday 04 and 05 go only when the campaign says so. A calendar email is never sent after its day.
6. An email that states a voucher waits for it, or is skipped if the contact cannot have one.
7. The weekly limit defers the lower-priority emails. Welcome and Educație run in parallel within it.

**Abandoned Cart vs failed payment.**
- An abandoned card checkout enrolls Abandoned Cart once per checkout, with its products.
- A checkout whose card payment **failed** is kept apart: an enrollment `payment-failed`, paused with `copy_pending`. None of the 59 approved emails is for failed payments. **YOU:** copy for that flow.

**Post-Purchase.**
- One active sequence per contact. An order delivered inside it joins it: products are added, nothing restarts, nothing is sent twice.
- The values are built by `postPurchaseFacts`: products named in singular or plural, the book without "NEUROS", complementary products only if not owned, and an "owns everything" flag.
- **YOU:**
  - The real guides and usage tips per product (`{{product_first_steps}}`, `{{product_usage_tips}}`). The approved notes forbid inventing them.
  - The subject of post-purchase-01 ("NEUROS {{product_name}} a ajuns") for the book and for several products. It needs an editorial rule; the copy was not changed.

**Migration from the current 3 recovery emails (not done):**
1. Approve this branch, deploy it (migration 032), and keep `WORKFLOWS_MODE` unset.
2. Set `WORKFLOWS_MODE=dry_run` on Preview, then Production. For a week, read `email_sends` and `/admin/vouchere`: what would go, when, and why not.
3. Connect the GHL sub-account (§7) and test with internal addresses only (`RECOVERY_TEST_RECIPIENTS` exists for the current flow).
4. In one step: switch the current recovery emails off (`RECOVERY_EMAIL_ENABLED`) and the new sending on. A "live" mode does not exist in this code; it is a separate, approved change.
5. **Rollback:** unset `WORKFLOWS_MODE`. Enrollments stay recorded and nothing else depends on them. The vouchers already issued stay valid until they expire, or a person revokes them.

## 6. Review Video storage (**YOU**)

- Create a **private** Supabase Storage bucket, for example `review-videos`.
- Set `VIDEO_STORAGE_URL`, `VIDEO_STORAGE_KEY` (service key, server only) and `VIDEO_STORAGE_BUCKET`.
- Limits: MP4, MOV or WebM, up to 300 MB. The browser uploads directly to the storage, because a function's request body is limited to 4,5 MB.
- **Still to build (needs design and copy):** the upload page linked from post-purchase-03, and the advertising consent checkbox with its text and version. The server records the consent separately and it can be withdrawn.

## 7. GoHighLevel sub-account (**YOU**)

Credentials: `GHL_WF_TOKEN` and `GHL_WF_LOCATION_ID`. They are kept separate from the current `GHL_PRIVATE_TOKEN` / `GHL_LOCATION_ID`, which point to the location shared with NEUROS.

To create in the sub-account:
- **Contact fields:** the keys in `WORKFLOW_FIELDS`.
- **Tags:** `bt-wf-<template>`, one per email (59), plus `bt-interes-calm`, `bt-interes-focus`, `bt-interes-amber` and `bt-interes-carte`.
- **Workflows:** 59, each "tag added → send the approved email → remove the tag". The store decides order, waits, stops, the weekly limit and priorities, so GHL holds no sequence logic.
- Unsubscribes keep going through the site's `/dezabonare` (marketing consent in our database). GHL's DND is not used, so order emails are never blocked.

An email is never sendable while one of its variables has no value (`missingValues`). This covers, for example, Black Friday's `{{bf_discount_*}}`, whose amounts are not decided.

## 8. Not done in this stage

- Customer-facing pages: "my vouchers", choosing a reward, uploading the review video, the referral link page. Each needs design and copy.
- Copy for the voucher-specific checkout errors. The existing promo messages are reused: "Codul este personal", "a expirat", "Ai folosit deja", "nu mai este activ".
- FGO with a 0-lei line. The payload adds up (tested), but FGO's acceptance of a zero-value line was not verified against FGO. **YOU:** one test invoice in FGO's test environment.
- Stripe: no change. The amount is the order total, so a gift order charges the delivery only. A card order can never go below 2 lei: it is refused before Stripe.
- No deploy, no push, no GHL, Stripe, FGO or Meta call, no email, no real voucher.

## 9. Popups: what changes when vouchers replace the 10% (texts to approve, not changed)

**How it works today.**
- On the Calm, Focus and Amber pages (and their landings), the gate game leads to the 10% window: code LONGEVITY10 by email.
- Everywhere else on the Romanian site, three gift boxes: LONGEVITY10 10%, CADOU1233 12,33% or CADOU100 100 lei.
- On the English site: plain 10%.
- Once per address (`welcome_signups`).

**What switching on changes.**
- `POPUP_VOUCHERS=on` acts only on the three product popups, Romanian site only, and the gift boxes stay as they are.
- It takes effect only when the Biohack Tech GHL sub-account is configured too (`GHL_WF_TOKEN`, `GHL_WF_LOCATION_ID`). Without the sub-account, the customer would get a voucher and no email, so the 10% email goes as today.
- A contact who already bought the product, or used its voucher, gets the 10% email.

**Texts to approve before switching it on** (`src/components/site/WelcomePopup.tsx`, Romanian):
1. Title: „10% reducere la prima comandă” and the product variant „10% reducere la {produs}”.
2. Lead: „Lasă-ne adresa de email și îți trimitem imediat codul. Se adaugă peste ofertele din coș.” and the product variant „… Îl folosești la {produs} (și la orice alt produs), peste ofertele din coș.” The voucher is for that product only.
3. Done: „Gata! Ți-am trimis codul de 10% pe email…”.
4. Already sent: „Pe această adresă am trimis deja codul de 10%…”.
5. The badge „−10%”.
6. Optionally the voucher's own sentence on the popup. Today the voucher is stated only by landing-*-01, which is already approved: „Ți-am adăugat X lei în contul tău Biohack Tech.”
7. The checkout's messages for vouchers reuse the promo-code ones: „Codul este personal…”, „Codul a expirat.”, „Ai folosit deja acest cod.”, „Codul nu mai este activ.” Approve them as they are, or provide voucher-specific ones.

The codes already promised (LONGEVITY10, BIOHACK10, CADOU1233, CADOU100) stay valid either way.

## 10. Audit 21.10.2026 (second pass): fixed

| Area | Problem (confirmed in code) | Fix |
|---|---|---|
| Vouchers | A card payment arriving after the order was cancelled took the voucher back for a cancelled order | That money is refunded; the voucher stays free (test) |
| Amber | A cap of 2 paid pairs that was never decided | Removed: 30 lei on every paid pair (tests up to 9 pairs) |
| Popups | `POPUP_VOUCHERS=on` without a sender would have left a voucher with no email | Needs the GHL sub-account too (test) |
| Meta | InitiateCheckout / AddPaymentInfo on .net sent euro labelled RON | Value in lei, like Purchase |
| Meta | CAPI `event_source_url` of .net orders pointed to .ro | .net hosts kept (test) |
| Meta | A test event code left in production went unnoticed | Config warning in /api/health |
| Meta docs | Traffic Permissions omitted .net; the pixel switch was named wrong | Docs corrected |
| Admin | Order actions from the page (paid, collected, shipped, delivered, cancelled, refund) and promo code changes were not in `admin_audit` | Audited, like the API (test) |
| Admin | "Marchează livrată" was one irreversible click | Needs the ticked box, like cancel and refund (test) |
| Admin | A card refund could be recorded by hand, with no money moved in Stripe | Refused: Stripe reports card refunds |
| Admin | Basic Auth on /admin and /fulfillment had no limit on wrong passwords | 10 failures per address per 15 min, then 429 (test) |
| Admin | Money to settle showed euro refunds in lei; a received, unrefunded return disappeared from "Atenție" | Order currency; returns listed (and named "produs returnat") |
| Admin | Dashboard funnel, order count and cancelled count were capped at the 100 listed orders | Aggregated over the whole period (test with 104 orders) |
| Admin | Revenue by payment method ignored refunds; products counted at full price; vouchers absent from the codes card | Net of refunds and discounts; vouchers and gifts listed (test) |
| Admin | /admin/stats counted cancelled orders, and money paid after a cancellation, as sales | Excluded |
| Admin | The vouchers page never showed its result messages; the revoke reason was not required | Shown; required |
| Admin | Promo codes could be created in the shapes reserved for vouchers and referrals (BTV…, BTG…, BTR…) | Refused |
| Fulfillment | A gift on a line of ×2 marked the whole line | "1 din 2 cadou (recompensă)" |
| Print | Orders abroad (.net) printed no country | Country printed when not Romania; Romanian orders unchanged |
| Rewards | A review video of a cancelled, refunded or returned order could still earn a reward | Approval needs the order to stand |
| E2E script | `scripts/stripe-e2e.mjs` did not follow the private order link (token → cookie) | Follows it; 19/19 |

**Not changed (decisions or larger work):**
- Upsell orders are left out of dashboard revenue. Is that intended?
- `refunded` card orders still count as "comenzi valide".
- An AWB cannot be corrected after shipping.
- The admin login and the fulfillment login rate limits are separate and in memory per instance.
- CAPI sends hashed email and phone for every paid order, whatever the cookie choice. This needs a legal review.
- There is no Meta event for refunds.

## 11. Tests

New test files:
- `tests/vouchers-engine.test.ts`: engine, Amber 1–7 pairs, mixed carts, gifts.
- `tests/workflows-planner.test.ts`: 14 workflows / 59 emails, timings, rules, variables, GHL mapping.
- `tests/server/vouchers.test.ts`: checkout end to end, personal check, concurrency, release, late payment, refund, expiry, FGO, Stripe, gifts.
- `tests/server/workflows-rewards.test.ts`: mode off, Abandoned Cart vs failed payment, Post-Purchase dedupe, weekly limit, unsubscribe, Review Video, Referral, VIP, popup switch.
- `tests/server/postgres.test.ts`: voucher race on real PostgreSQL.

Results on 21.10.2026 (second pass):
- typecheck ok; lint 0 errors, 0 warnings; production build ok;
- vitest: 826 passed, 14 skipped (the real-PostgreSQL files, run separately);
- real PostgreSQL 17: 13 passed, including the voucher race (10 orders, one gets it);
- Stripe TEST mode against the built app (temporary PostgreSQL, FGO, GHL and SMTP off, emails to files):
  - `scripts/stripe-e2e.mjs`: 19/19;
  - voucher e2e: 16/16, covering Calm voucher, Amber 570 lei, a declined then retried card, the gift at 12,10 lei, PJ by transfer, partial and full refund, a forged webhook, idempotency and a cancelled PaymentIntent.
- A note on running both e2e back to back: on one database and one local address, the checkout's risk check flags the repeated test contacts (score ≥ 40). It then asks 3D Secure for every card, which the test cards don't complete. Run each suite on a fresh database, or clear `orders.risk_ip` between them.

## 12. Staging and activation, step by step

1. **Review.** You review and approve this branch.
2. **Preview deploy.** Push the branch and use the Preview deployment, on its own database (Preview is isolated). Migration 032 runs on boot. Set no switch.
3. **Verify on Preview.**
   - `/api/health` is ok.
   - `/admin/vouchere` opens.
   - A test voucher issued by hand on Preview works in the checkout with a Stripe TEST card.
   - The FGO test environment accepts a gift line at 0 lei (one test invoice there).
4. **Production deploy, switches off.** Merge to main; production deploys with every switch off. Nothing changes for customers. Check `/api/health`, one normal order and the cron.
5. **Dry run.** Set `WORKFLOWS_MODE=dry_run` on Production for a week. Read `email_sends` and the decisions; nothing is sent.
6. **GHL sub-account.** Create the sub-account, its fields, tags and the 59 email workflows (§7). Test with internal addresses only.
7. **Sending stage.** A separate change, approved by you: the sub-account sends what the planner decides. In the same step, the old recovery emails go off (`RECOVERY_EMAIL_ENABLED`).
8. **Popups.** Once the new texts (§9) are approved and the landing emails send: `POPUP_VOUCHERS=on`.
9. **Rollback at each step.** Unset the switch. Vouchers already issued stay valid until they expire, or a person revokes them in `/admin/vouchere`.

## 13. GO / NO-GO

| # | Check | State |
|---|---|---|
| 1 | Typecheck, lint, tests, build, real PostgreSQL, Stripe TEST e2e | GO |
| 2 | Migration 032 additive, applied on real PostgreSQL | GO |
| 3 | Every switch off by default (`WORKFLOWS_MODE`, `POPUP_VOUCHERS`, video storage, `audience: 'voucher'`) | GO |
| 4 | Antifraud unchanged; Roxana's order and the 4 flagged attempts untouched | GO (no data touched) |
| 5 | Validity days of the vouchers outside the landings | NO-GO until you decide (§4) |
| 6 | Gift delivery fee (12,10 lei proposed) | NO-GO until you decide |
| 7 | FGO accepts a 0-lei gift line | NO-GO until tested in FGO's test environment |
| 8 | GHL sub-account credentials, fields, tags, 59 workflows | NO-GO (not created) |
| 9 | Copy: popup texts (§9), failed-payment emails, post-purchase guides and the 01 subject rule | NO-GO until approved |
| 10 | Customer pages (my vouchers, reward choice, video upload, referral link) | NO-GO (design and copy needed) |
| 11 | Meta: Traffic Permissions include .net; deduplication and match quality checked in Events Manager | NO-GO until checked with Business Manager access |
| 12 | Legal: CAPI without cookie consent; review video advertising consent text | NO-GO until reviewed |

The infrastructure (items 1–4) is GO for a deploy with everything off. Activating vouchers and workflows for customers is NO-GO until items 5–12 are settled.


## 14. Finalization 22.10.2026 (branch `release/finalization`)

- **Legal identity.** NEUROS EUROPE S.R.L. is already the operator everywhere it is shown or used:
  - footer, legal pages, emails, print and checkout read `src/config/company.ts`; production has no override;
  - Stripe account acct_1PmfBwBd7uu5v7wn is NEUROS EUROPE SRL (live and test);
  - the FGO issuer is CUI 50323873;
  - the transfer beneficiary is NEUROS EUROPE S.R.L. at Banca Transilvania.

  No "BIONEUROS" exists in the code, the docs or the 59 emails. New: each order stores the seller's identity when placed (`orders.seller`, migration 033), and `SELLER_HISTORY` dates identities. A future change of operator gets an effective date and never rewrites old orders or their documents. Old orders are not touched.
- **Vouchers 30 days, gift delivery 25 lei:** see §4.
- **FGO.** Gift lines are 0 lei by default. `FGO_GIFT_LINES=discount` invoices the product at full price plus its own negative "Cadou (recompensă)" line, in case FGO / e-Factura refuse zero-value lines. Both modes are tested and the total equals what was paid. **Not verified against FGO:** it needs a free test account on testuat.fgo.ro.
- **GHL sub-account.** `scripts/ghl-wf-setup.mjs` runs as a dry run by default; `--apply` creates only the missing fields and tags. It refuses the shared NEUROS locations. The list is `scripts/ghl-wf-spec.json`, kept equal to the code by a test. Credentials `GHL_WF_TOKEN` and `GHL_WF_LOCATION_ID` don't exist yet: the sub-account was not found or created.
- **Upsell.** Part of the parent order:
  - its products join the parent's Post-Purchase sequence;
  - it never starts a sequence of its own;
  - its money counts in the dashboard, but not as a second order.
- **Dashboard.** Fully refunded orders are no longer "comenzi valide".
- **Admin.**
  - The AWB can be corrected after shipping, with a reason, a ticked box, history (old and new) and the admin audit.
  - The login limit is kept in the database (`auth_attempts`), shared across instances and by both logins that accept the admin password.
  - "Linkul de cont" for a customer can be generated in `/admin/vouchere` (audited).
- **Meta CAPI and consent.**
  - The checkout sends the cookie banner's marketing choice, and the order keeps it (`attribution.cookieMarketing`).
  - Without it, no browser signal is stored for Meta and the Purchase is never sent (job skipped).
  - Orders placed before this have no stored choice and are not sent either.
  - `META_CAPI_CONSENT=off` restores the previous behaviour, only after a legal decision.
  - **Effect after deploy:** fewer server Purchases for visitors who refused or ignored the banner.
- **Customer pages** (`/cont/<link>`, a signed link per email, 30 days, `ACCOUNT_LINK_SECRET` or `ADMIN_SESSION_SECRET`):
  - available vouchers, with "Folosește voucherul" (code into the checkout, product page);
  - voucher history;
  - choosing a reward, once;
  - the review video upload (direct to the private storage, one per delivered order, the advertising consent separate and versioned).

  Every item is checked against the address in the signature. **Texts on these pages are new: to approve.** There is no "send me my link" form yet: the link comes in the customer's emails, or from `/admin/vouchere`.
- **Video storage.** A replaced rejected video is deleted. **Still needed:** the private bucket and `VIDEO_STORAGE_*`.
- **Contradiction found (copy not changed):** landing-calm-01, landing-focus-01 and landing-amber-01 (body and preheader) say "în următoarele 7 zile", while vouchers now last 30 days. Choose: 7 days for the landing vouchers, or new copy.
- **Not integrated.** 8 remote branches `cursor/*` (15–20.10.2026: copy rewrites, Calm landing story, cookie banner, Clarity, mobile speed, Meta tracking, Focus price 1.800) are not in main and not merged here (design and copy freeze).

## 15. The five integrations, 22.10.2026 (second half)

- **Email Studio content** (26 emails changed, 33 untouched; backup in `~/biohack-email-studio-backups/<ts>-cta/`):
  - CTA links now point to `{{voucher_url}}`, the product pages, `/contact-us`, or the personal links `{{review_url}}`, `{{recommendation_url}}`, `{{referral_url}}` and `{{reward_url}}`.
  - landing-*-01 now says "30 de zile".
  - The 13 approved landing emails went back to "De aprobat" (re-approval needed).
  - Still open:
    - the Black Friday 03–05 CTA goes to `/products` (destination to confirm);
    - post-purchase-01/02 have no guide link (the guides don't exist);
    - the post-purchase-01 subject has the plural/book issue.
- **Links in the store:** `src/server/workflows/links.ts` builds all five personal links. `/api/recomandare` sets the promo cookie for a valid BTR code. ghl-map maps each variable to a `contact.bt_*` field.
- **FGO.** `FGO_GIFT_LINES=discount` follows spec v7.1: the gift is a negative article with a positive PretUnitar, NrProduse −1 and no PretTotal. The spec requires PretUnitar to be positive, so a 0-lei line is doubtful. The default is still `zero`. Mixed invoices are tested in both modes: gift with Calm, gift with Amber, and PJ. Still not tried against FGO itself.
- **Video storage.**
  - Private bucket `biohacktech-reviews` exists in the production Supabase project: 300 MB limit, mp4/mov/webm, no public access.
  - Vercel has `VIDEO_STORAGE_URL` and `VIDEO_STORAGE_BUCKET`. **Missing: `VIDEO_STORAGE_KEY`** (the service role key, set by a person).
  - "Trimis" now requires the file to exist in storage, to be a video and to be within the size limit.
  - Admin watches a review through a 10-minute signed link (`/api/admin/review-video/<id>`, audited).
- **GHL (existing location `xnf2JtFk46U23NG0lzwC`, no new sub-account).**
  - Folder "Biohack Tech": BT · W1–W7 moved here.
  - New subfolder "BT · Email 2026 · 14 workflow-uri (Draft)": E01–E14 as empty drafts (no trigger, no action, nobody enrolled).
  - 16 contact fields `bt_*` were created, in field folder "BiohackTech Ecommerce".
  - Tags are created on first use.
  - The current token can't read or write workflows, fields or tags (401). The script falls back to `GHL_PRIVATE_TOKEN` / `GHL_LOCATION_ID` and refuses the Brain Event location.
  - **Not built:** the 59 email actions and the triggers (they wait for the approved copy).
- **Staging.** A `DATABASE_URL` pointing to the production database is refused unless `APP_ENV=production`. The steps for a separate staging database and Stripe TEST keys are in `docs/STAGING.md` (credentials, done by a person).
- **Checks:**
  - 842 tests, 13 on a real Postgres;
  - build, tsc and lint pass;
  - Stripe TEST e2e: 19/19 and 16/16.

## 16. Approved 22.10.2026: gift + book delivery, upsell reporting, staging

- **Gift + book delivery: 25 lei in total per order** (never 25 lei plus the book's 12,10 lei). `lib/shipping.ts` charges the higher fee once. A test places an order with a gift and the book and checks the same 25 lei in:
  - the order total;
  - the Stripe amount;
  - the FGO lines (one transport line, in both gift modes);
  - the confirmation email ("Livrare: 25 lei").
- **Upsell reported separately.** The upsell stays linked to its parent order and is never counted as an order. Admin Stats now shows:
  - "Venit din comenzile inițiale";
  - "Venit din upsell";
  - "Venit total net" (each counted once, refunds deducted).

  The dashboard's "Valoare comenzi" card shows the same split.
- **Review video.** Tested end to end on the real staging storage and on the staging Preview, with synthetic files and orders:
  - a valid upload;
  - a wrong type (refused by the app and by the bucket);
  - over 300 MB (refused by the app, and the bucket limit is enforced);
  - another address;
  - no public access;
  - an expired link;
  - the admin preview (401 without login, a 10-minute link, audited);
  - replacement after rejection (the old file deleted);
  - one video per order.

  The key must be the legacy `service_role` JWT: Storage refuses the new `sb_secret_` keys ("Invalid Compact JWS").
- **Staging** (see `docs/STAGING.md`): a separate Supabase project, Stripe TEST webhook, its own secrets. On the staging URL:
  - card e2e 19/19;
  - vouchers, Amber 2+1, gift and refunds e2e 16/16;
  - review video 19/19;
  - upsell 6/6;
  - admin and fulfillment checked.

## 17. Finalization 23.10.2026

- **GHL: the 14 workflows are built, all still Draft** (nobody enrolled, nothing published). In the location `xnf2JtFk46U23NG0lzwC`, folder "BT · Email 2026 · 14 workflow-uri (Draft)". Each workflow:
  1. one trigger per email: "Contact tag added = `bt-wf-<template>`" (for example `bt-wf-welcome-03`), named with its day or date;
  2. an If/else "Ce email trimit" with one branch per tag;
  3. in each branch, "Send email" from the existing template "BT · <template> · rev N · …", sender Biohack Tech <contact@biohack-tech.ro>, with "Sync Edits to Template" on;
  4. then "Remove contact tag" for the same tag.

  The store still decides timing, stops, the weekly limit and priorities: it adds the tag at the right moment, GHL only sends.
- **Templates:** all 59 in the folder "BT · Email 2026 · 59 emailuri (Draft)". The 9 Welcome templates were already approved in Email Studio ("APROBAT"); the other 50 are "DE APROBAT". Nothing was approved in this pass.
- **Before turning any workflow on (YOU):** approve the copy in Email Studio, verify the GHL sending domain for biohack-tech.ro, set the Black Friday variables, then publish one workflow at a time and test it with internal addresses.
- **Legal (RO and EN):**
  - Terms and Conditions: section "Vouchere, cadouri și recompense" (`#vouchere`);
  - Privacy Policy: the processing table rows for Meta, vouchers and the video review; new sections "Reclame Meta" (`#meta`) and "Review video" (`#review-video`); Meta in the recipients; retention for vouchers and videos;
  - new page `/conditii-review-video` (reward, licence agreement `AD_CONSENT_TEXT`, version `AD_CONSENT_VERSION`, withdrawal, deletion).

  These texts need a lawyer's review before launch.
- **Review video licence:** the reward comes only with the separate ad-use agreement; the customer can withdraw it from the account (migration `034_video_consent_withdrawal`); the admin "vouchere" page shows consent, withdrawal and file deletion; a video is usable in ads only when approved, with consent and with the file present (`usableInAds`).
- **Prepared, off:** the voucher popup copy (`POPUP_VOUCHERS`), the two failed-payment emails (`config/payment-failed-emails.ts`, status draft: the engine pauses them with `copy_pending`).
- **Merged from `main`:** the card-testing block (commits 5016fca, 12720ed: blocklist, disposable emails refused, blocked network on `/api/*`, 3 failed payments then phone only).
