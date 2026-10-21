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

## 3. NEUROS Amber 2+1 + 30 lei per paid pair

Price of one pair: 315 lei. Example with 3 pairs: 315 + 315 + 0 − 30 − 30 = **570 lei**. The free pair never gets the 30 lei.

Tested from 1 to 7 pairs, with mixed frames. With frames at different prices, the cheapest pair is the free one.

`AMBER_PAIR_DISCOUNT` in `src/config/vouchers.ts`:
- `perPairMinor: 3000`
- `maxPairs: 2`: "60 lei reducere la comandă", as landing-amber-03 says.
- `audience: 'voucher'` (built): the 30 lei per paid pair is what the contact's **Amber voucher** gives on top of the automatic 2+1. So 1 pair = −30 and 3 pairs = 570 lei.
- `audience: 'all'`: every Amber order gets it automatically. This is a live price change. If an Amber voucher is also used, it adds nothing (never twice).

**YOU:** confirm `audience` and `maxPairs`. Six pairs with the cap at 2 = −60. Without the cap it is −30 per paid pair (4 paid pairs = −120).

**YOU:** confirm the mixed-cart reading. Calm + Amber with the Calm voucher gives 640 lei on Calm and the plain 2+1 on Amber. The 30 lei per pair would need the Amber voucher, and only one voucher fits an order. If the 30 lei per pair should come on top of another voucher, switch `audience` to `'all'`.

## 4. Decisions to confirm (**YOU**)

| Decision | Built default | Where |
|---|---|---|
| Amber per-pair audience and cap | voucher only, 2 pairs | `AMBER_PAIR_DISCOUNT` |
| Validity outside the landings (abandoned 7, win-back 14, nudge 14, Crăciun 10, Anul Nou 14, rewards 30 days) | as listed | `VOUCHER_VALIDITY_DAYS` |
| Delivery fee of a gift order (free delivery otherwise) | 12,10 lei (the book's fee) | `GIFT_SHIPPING_RON` |
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

## 9. Tests

New test files:
- `tests/vouchers-engine.test.ts`: engine, Amber 1–7 pairs, mixed carts, gifts.
- `tests/workflows-planner.test.ts`: 14 workflows / 59 emails, timings, rules, variables, GHL mapping.
- `tests/server/vouchers.test.ts`: checkout end to end, personal check, concurrency, release, late payment, refund, expiry, FGO, Stripe, gifts.
- `tests/server/workflows-rewards.test.ts`: mode off, Abandoned Cart vs failed payment, Post-Purchase dedupe, weekly limit, unsubscribe, Review Video, Referral, VIP, popup switch.
- `tests/server/postgres.test.ts`: voucher race on real PostgreSQL.
