# Open points: what only you can provide

Short on purpose. The full runbook is `docs/PRODUCTION-LAUNCH.md`.

### NEUROS Focus price
- **Needed:** confirmation of 2.490 lei (taken from the source material, the only price given in lei there).
- **Used in:** `src/config/prices.ts` → site, cart, checkout, Stripe, FGO, GHL.
- **If missing:** the product sells at 2.490 lei.

### Bank details
- **Status:** provided in the local `.env.local` (IBAN valid). Set the same `BANK_*` values on the production host; `BANK_SWIFT` still optional.
- **Used in:** checkout, order page, transfer email (`BANK_*`).
- **If missing:** “Transfer bancar” shows “În curând”.

### Stripe live account
- **Status:** test mode works end to end locally (test keys + Stripe CLI webhook secret).
- **Needed:** activated account, live keys, live webhook endpoint secret (§8 of the runbook).
- **Used in:** card payments.
- **If missing:** “Card bancar” shows “În curând”.

### Database
- **Needed:** a PostgreSQL database (Railway recommended) → `DATABASE_URL`.
- **Used in:** every order.
- **If missing:** checkout offers email/phone ordering only.

### FGO
- **Needed:** PRO/PREMIUM subscription, API user private key, invoice series, VAT rate (accountant), e-Factura setting.
- **Used in:** automatic invoices after payment.
- **If missing:** paid orders show “Factură: Manual” in /admin; invoice by hand.

### GoHighLevel
- **Status:** API configured locally; `npm run ghl:check` passes (pipeline, 8 stages, 14 fields, 6 `bt-` tags in NEUROS).
- **Needed:**
  - sending domain on biohack-tech.ro verified in GHL + `EMAIL_FROM` + `EMAIL_TRANSPORT=ghl` (planned for 30 Sep);
  - workflows W1–W7 built in the folder “BiohackTech Ecommerce” from the build sheets in PRODUCTION-LAUNCH §10.5 (not created yet: the GHL workflow builder did not respond while the browser was in the background, and the API cannot create workflows).
- **Needed for the workflows:**
  - W1 team recipients;
  - W4, W5, W7 assignee;
  - W6 specialist and review link (e.g. Google Business profile);
  - optional `GHL_WEBHOOK_SECRET` for W0.
- **If missing:** no customer emails (launch blocker); orders still reach the pipeline.

### Company identification (site footer, legal pages)
- **Needed:** `COMPANY_LEGAL_NAME`, `COMPANY_CUI`, `COMPANY_REG_COM`, `COMPANY_ADDRESS` (+ `COMPANY_RETURN_ADDRESS` if returns go elsewhere), set on the host at build time.
- **Used in:** footer, terms, privacy policy (controller), withdrawal form.
- **If missing:** the pages say “Biohack Tech” with no legal identity (not legally ready to sell; /admin shows it as an error in production).

### Legal and product information still to provide
- **ANPC SAL pictogram** (Ordin ANPC 449/2022 as amended by Ordin 270/2026): the official image (from anpc.ro) on the home page, linked to https://reclamatiisal.anpc.ro. Today the footer has a text link only.
- **Harmonised legal-guarantee notice** (Reg. (EU) 2025/1960, since 27 Sep 2026): the official label, displayed visibly. Today the checkout and `/garantie` state the 2-year legal guarantee in text.
- **GPSR** (Reg. (EU) 2023/988 art. 19), on each product page:
  - manufacturer name and postal + electronic address;
  - EU responsible person if the manufacturer is outside the EU;
  - product identifier;
  - safety warnings in Romanian.
- **Returns:**
  - who pays the direct return cost (if not stated, the law puts it on the seller);
  - the return address;
  - any withdrawal exceptions (e.g. sealed hygiene items).
- **Guarantee:** the site says “Garanție 2 ani”, which is the legal guarantee. Is there also a manufacturer's commercial guarantee? If so, its certificate content (OUG 140/2021 art. 15).

### Decisions
- **Courier** and whether shipping stays free for all orders (today: free, from the current site).
- **Unpaid transfer orders:**
  - Today: GHL W3 reminder at 2 days, task at 5 days, cancellation by hand.
  - `TRANSFER_EXPIRY_DAYS` automates the cancellation; the customer gets the cancellation email.
- **Card checkout abandonment:** `ABANDON_AFTER_MINUTES` (default 60) before an unpaid card order counts as “Plată nefinalizată”. Recovery emails go only to addresses with marketing consent.
- **Analytics:** GA4 / Clarity / Meta ids (`NEXT_PUBLIC_*`). The consent banner appears as soon as one is set.
- **Support contact:** keep `contact@neuros.ro` and `+40 757 890 707` (from the source) or use Biohack Tech’s own.
- **What’s in the box** for each product.

### Admin access
- **Needed:** `ADMIN_PASSWORD` (12+ characters; `ADMIN_USER` optional, default `admin`).
- **Used in:** /admin (orders, transfer confirmation, shipping, retries).
- **If missing:** /admin does not exist (404), so nobody can confirm a bank transfer or see failed syncs.

## LEGAL REVIEW BEFORE GO-LIVE

Only what needs a person's legal judgement; everything else is built and documented.

1. **Checkout recovery and the marketing checkbox.** Recovery emails rely on express consent. Its wording covers “un memento dacă nu finalizez comanda”. Confirm that the wording is valid consent for recovery. The existing-customer exception (Legea 506/2004 art. 12(2)) is **not** used; decide whether to add it for completed purchases, which needs an explicit opt-out at checkout.
2. **Order button and contract conclusion** (OUG 34/2014 art. 8(2), as amended by OUG 18/2026):
   - labels: “Comandă cu obligație de plată” (transfer), “Plătește X lei” (card);
   - the moment the contract is concluded, as stated in the terms (card: payment confirmed; transfer: confirmation email).
3. **Wellness claims and the devices' regulatory status** (MDR 2017/745): product copy, the “nu înlocuiește sfatul medicului” disclaimer, CE documentation for each device.
4. **Privacy policy specifics:**
   - international transfer mechanism for Stripe and GoHighLevel/LeadConnector (DPF or SCCs) and the processor agreements;
   - retention periods (accounting/fiscal, consent proofs, CRM);
   - whether the courier and hosting must be named.
5. **Company (PJ) buyers:** which consumer rights (withdrawal, legal guarantee) the terms extend to them.
6. **Service emails without consent:** the after-delivery help email (W6 P1) and the transfer payment reminder (W3 T1) are treated as non-marketing. Confirm.
