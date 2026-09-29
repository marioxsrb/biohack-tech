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
- **Needed:** Private Integration token, location id, pipeline with 8 stages, 11 custom fields, verified sending domain + `EMAIL_FROM`.
- **Used in:** CRM, pipeline, **all customer emails**.
- **If missing:** no confirmation emails (launch blocker).

### Company identification and legal texts
- **Needed:** legal name, CUI, Reg. Com., registered office, VAT status, return address; full terms, privacy, cookies, shipping, returns + withdrawal form, reviewed by your lawyer.
- **Used in:** footer, legal pages, invoices.
- **If missing:** not legally ready to sell.

### Decisions
- **Courier** and whether shipping stays free for all orders (today: free, from the current site).
- **Unpaid transfer orders:** after how many days to cancel them automatically. Today: GHL reminder at 2 days, task at 5 days, cancellation by hand. Set `TRANSFER_EXPIRY_DAYS` to automate it (the customer gets the cancellation email).
- **Card checkout abandonment:** `ABANDON_AFTER_MINUTES` (default 60) before an unpaid card order counts as “Plată nefinalizată”.
- **Marketing consent:** may checkout recovery and usage emails go to customers who did not tick the box?
- **Analytics:** GA4 / GTM / Meta ids, and a consent banner.
- **Support contact:** keep `contact@neuros.ro` and `+40 757 890 707` (from the source) or use Biohack Tech’s own.
- **What’s in the box** for each product.

### Admin access
- **Needed:** `ADMIN_PASSWORD` (12+ characters; `ADMIN_USER` optional, default `admin`).
- **Used in:** /admin (orders, transfer confirmation, shipping, retries).
- **If missing:** /admin does not exist (404), so nobody can confirm a bank transfer or see failed syncs.
