# Open points

Updated 29 September 2026 (phase 3/4). Everything that is code is built; what is left needs an account, a credential, a person's decision or a production host. The full runbook is `docs/PRODUCTION-LAUNCH.md`.

## MUST FIX BEFORE PRODUCTION

1. **Production host and database.** A PostgreSQL database (`DATABASE_URL`) on the production host, with every variable from `.env.example` set there (the local `.env.local` is not deployed). Without it, checkout offers email/phone ordering only.
2. **Stripe live.** Activated account, live keys, live webhook endpoint `https://biohack-tech.ro/api/webhooks/stripe` and its secret (runbook §8). Test mode works end to end today. Do not switch before the go-live procedure (§21).
3. **Email: switch to our own SMTP** (runbook §11a). Needs the `contact@biohack-tech.ro` mailbox password in Vercel (`SMTP_USER`, `SMTP_PASSWORD`, Production only), then `EMAIL_TRANSPORT=smtp` and `NOTIFY_EMAIL=orders@biohack-tech.ro`. Until then emails go through GHL with the NEUROS sender and the team gets no notifications.
4. **W1–W7 stay Draft** (runbook §10.6): the application replaces W1, W3–W7. W2 waits for the abandoned-checkout phase. W6 review link still missing.
5. **FGO API credentials** in production (`FGO_*`). Without them every paid order is “Factură: Manual”.
6. **Bank details on the host.** `BANK_BENEFICIARY`, `BANK_NAME`, `BANK_IBAN` (valid locally; set the same values in production).
7. **`ADMIN_PASSWORD`** on the host (12+ characters). Without it /admin does not exist, so nobody can confirm a transfer or mark a shipment.
8. **Domains (phase 4).** Connect `biohack-tech.ro`, `www`, and the four landing hostnames (runbook §27). No DNS has been changed.
9. **Legal review** (items below under NEEDS BUSINESS INPUT, “Legal”), in particular the marketing-consent wording used for recovery, the order-button labels and the devices' regulatory status, before ads or marketing emails run.
10. **GPSR product information** (per product, none of it exists in the sources; not invented):
    - NEUROS Calm: manufacturer name, postal and electronic address; EU responsible person if the manufacturer is outside the EU; model / type identifier; safety warnings and instructions in Romanian; box contents; regulatory status (wellness vs MDR).
    - NEUROS Focus: the same; the source names the hardware model “BrainLink Pro” and “CE, FCC” but not the manufacturer, the certificates or the declaration of conformity; tablet requirement is stated.
    - NEUROS Amber: manufacturer and address; EU responsible person; model identifiers per frame; lens / filter specification; care and safety notes; box contents (case, cloth?).
    - NEUROS Flow: manufacturer and address; EU responsible person; model identifier per configuration; safety warnings (infrared light, eyes, contraindications as the manufacturer states them); instructions; box contents (the photos show goggles and a remote; only the remote is claimed); CE / regulatory documentation.
   Original wording of this item: on each product page (Reg. (EU) 2023/988 art. 19): manufacturer name, postal and electronic address; EU responsible person if the manufacturer is outside the EU; product identifier; safety warnings in Romanian. None of it exists in the sources for any product, including NEUROS Flow.

## NEEDS BUSINESS INPUT

**Prices and product 4**
- **NEUROS Focus price:** decided 30.09.2026: 790 lei (canonical list price, no comparison price).
- **NEUROS Flow prices:** confirm 12.900 / 14.900 / 13.900 lei for 1 / 4 / 13 zones. The source lists 13 zones cheaper than 4 zones; kept as listed (`src/config/prices.ts`).
- **NEUROS Flow is for sale:** an earlier content decision said it “nu se vinde”; phase 3/4 made it a sold product. Confirm before ads run.
- **NEUROS Flow:** manufacturer, CE / regulatory documentation, what's in the box (the photos show goggles next to the remote; not claimed), supplier SKU if any, whether configurations change delivery time.

**Promotions and the post-purchase offer (phase 3.5)**
- Confirm the two promotions as built: 20% for 3+ units of Calm / Focus / NEUROS Flow (Amber excluded), and Amber 2+1 gratis; how long they run (the site says “atât timp cât sunt afișate pe site”).
- Post-purchase pairs decided 30.09.2026 (`src/config/upsell.ts`: Calm → Amber, Focus; Flow → Calm, Focus; Focus → Amber, Calm; Amber → Calm, Focus); confirm the 30-minute window.
- Customer testimonials: none are used (the source's were unverifiable). To show real ones, add them to `src/content/home.ts` with written consent and a source.

**Company and support**
- **Return address** (`COMPANY_RETURN_ADDRESS`). Company identity is set from the data you provided (NEUROS EUROPE S.R.L., CUI 50323873, J2024001256321, Str. N. D. Cocea nr. 10, Sibiu); the return address was not given, so the site says it is sent to the customer.
- **Support contact:** decided 29 Sep 2026: `contact@biohack-tech.ro` (central, `src/config/site.ts`); phone `+40 757 890 707` (the only number in the project; confirm it is staffed for Biohack Tech).
- **Who pays the direct return cost** (if not stated, the law puts it on the seller) and any withdrawal exceptions.
- **Commercial guarantee** beyond the legal 2 years? If yes, its certificate content (OUG 140/2021 art. 15).

**Operations**
- **Cash on delivery (built 8 Oct 2026, docs/PRODUCTION-LAUNCH.md §33):** GHL stage „Ramburs, de pregătit” created 13 Oct 2026; no order-value ceiling (business decision, 13 Oct 2026; a courier's own COD limit is an operational matter); choose the courier and settlement rhythm; confirm with the accountant when the invoice is issued (`FGO_COD_INVOICE`, default at shipment). Collections are recorded by hand in /admin until a courier API exists.
- **Courier** (Fan Courier, Sameday, Cargus…). Today the manual provider: AWB typed in /admin. An API integration plugs into `src/server/fulfillment/courier.ts`.
- **Shipping** stays free for all orders? (today: free, from the current site).
- **Unpaid transfer orders:** set `TRANSFER_EXPIRY_DAYS` to cancel automatically, or keep manual cancellation after the W3 reminder.
- **Card abandonment delay:** `ABANDON_AFTER_MINUTES` (default 60).
- **People:** W1/W4 recipients, fulfilment person, specialist for onboarding calls (Calm, Focus, NEUROS Flow), review link.

**Marketing**
- **Analytics ids:** GA4 / Clarity / Meta (`NEXT_PUBLIC_*`). The consent banner appears as soon as one is set.
- **Ad campaigns:** use the UTM parameters `utm_source`, `utm_medium`, `utm_campaign` (+ `utm_content`, `utm_term`) on the landing links; they reach the order and `contact.bt_last_order_source`.

**Legal (needs a person's legal judgement)**
1. **Checkout recovery and the marketing checkbox.** Recovery emails rely on express consent; its wording covers “un memento dacă nu finalizez comanda”. Confirm it is valid consent. The existing-customer exception (Legea 506/2004 art. 12(2)) is **not** used.
2. **Order button and contract conclusion** (OUG 34/2014 art. 8(2), as amended by OUG 18/2026): “Comandă cu obligație de plată” (transfer), “Plătește X lei” (card); the moment of conclusion stated in the terms.
3. **Wellness claims and regulatory status** (MDR 2017/745) of every device, NEUROS Flow included (transcranial photobiomodulation): product copy, landing copy, the “nu înlocuiește sfatul medicului” disclaimer, CE documentation.
4. **Privacy policy:** transfer mechanism and processor agreements for Stripe and GoHighLevel; retention periods; whether courier and hosting must be named; the landing attribution (UTM, no click ids, no cookie) described in the policy.
5. **Company (PJ) buyers:** which consumer rights the terms extend to them.
6. **Service emails without consent:** W6 P1 (after-delivery help) and W3 T1 (transfer reminder) treated as non-marketing. Confirm.
7. **Post-purchase offer and promotions**: the disclosure that Stripe keeps the card for 30 minutes for the optional offer (checkout, privacy policy, /plati); the two-click confirmation; the promotion terms on /plati (and, if a promotion is ever shown as a price reduction, the Omnibus “lowest price in the last 30 days” rule).
8. **ANPC SAL pictogram** (Ordin ANPC 449/2022, amended by Ordin 270/2026) and the **harmonised legal-guarantee notice** (Reg. (EU) 2025/1960): official images to place; today text only.

## CAN IMPROVE AFTER LAUNCH

- Show the card brand and last digits in the post-purchase confirmation (Stripe payment method details).
- A “before” photograph without a product for the homepage comparison (today a desaturated evening-screen scene).

- Courier API integration (automatic AWB, delivery tracking) through the courier adapter.
- Upsell / cross-sell on the landings (extension point documented in runbook §26; only catalog prices, no discount logic yet).
- GHL segmentation by configuration or promotion (e.g. tags for NEUROS Flow 1 / 4 / 13 zones or for orders with 2+1): the data is in the orders (runbook §30a); add tags only when a campaign needs them.
- Real customer testimonials on the landings (the slot exists in `components/landing/kit.tsx`, hidden while empty), with written consent and a source.
- Per-configuration photographs for NEUROS Flow (today the same gallery for 1, 4 and 13 zones).
- A GHL workflow on `bt-retur-solicitat` / `bt-retur-primit` (tags are set; no workflow uses them yet).
- W0 (GHL unsubscribe → site) once `GHL_WEBHOOK_SECRET` is set.
- Landing reporting in GA4 by `lp` / UTM once analytics ids exist.
- A dedicated product page layout for NEUROS Flow configurations (comparison table), if the business wants more than the picker.
- Automatic FGO storno on full refunds (`FGO_AUTO_STORNO`), once the accountant agrees.
