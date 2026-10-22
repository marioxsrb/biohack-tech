# Staging (Vercel Preview with its own database)

Set up 22 October 2026. Preview deployments run with `APP_ENV=staging`.

**Staging URL** (branch `release/finalization`): https://biohack-tech-git-release-fi-99238a-akospalotas55-4149s-projects.vercel.app

**Separate resources:**
- Supabase project `biohacktech-staging` (ref `vajyphdhiczpltncdknn`, org Neuros, eu-central-1).
  - All migrations applied.
  - Private bucket `biohacktech-reviews-staging`: 300 MB limit, mp4/mov/webm only.
  - A test bucket `size-limit-probe` (1 MB) is used only by the storage test.
- Stripe TEST webhook `we_1UTOEDBd7uu5v7wnNAQEmoif`, pointing to the staging URL at `/api/webhooks/stripe`.
  - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`.
  - Test mode only. The account is shared with NEUROS, so the endpoint also receives NEUROS test events. The app ignores payments it does not know.

**Local values:** all staging values are in `~/biohack-db-backups/staging.env` (chmod 600, outside Git). Nothing there is a production secret. That file holds the staging admin login (user `admin`), the warehouse login (user `depozit`) and the database URL.

## Vercel Preview variables

| Variable | Preview value |
|---|---|
| `DATABASE_URL` | the staging project, through the IPv4 pooler: `aws-1-eu-central-1.pooler.supabase.com:6543`, user `postgres.vajyphdhiczpltncdknn`. The `db.<ref>.supabase.co` host is IPv6 only and does not resolve on Vercel. |
| `STRIPE_SECRET_KEY` | the TEST key (sk_test) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | the TEST key (pk_test) |
| `STRIPE_WEBHOOK_SECRET` | the secret of the webhook above |
| `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `CRON_SECRET`, `FULFILLMENT_PASSWORD` | new, staging only (production values are not reused) |
| `EMAIL_TRANSPORT` | `none` |
| `VIDEO_STORAGE_URL`, `VIDEO_STORAGE_BUCKET`, `VIDEO_STORAGE_KEY` | the staging project and bucket; the key is its legacy `service_role` |
| `NEXT_PUBLIC_SITE_URL` | the staging URL (branch `release/finalization` only) |

The production `VIDEO_STORAGE_URL` and `VIDEO_STORAGE_BUCKET` now apply to Production only.

**Built-in safety:**
- Code refuses live Stripe keys outside production (`config.ts` readStripe).
- Code refuses the production database (`PRODUCTION_DB_REF`) whenever `APP_ENV` is not `production`.

## Off on Preview
These variables are scoped to Production only, so on Preview the integration is off:
- **Customer emails and team notifications:** `EMAIL_TRANSPORT=none`, and `NOTIFY_EMAIL` and the SMTP settings are absent.
- **AI calling:** no ElevenLabs key or `AI_CALLING_*`.
- **Invoices:** no FGO credentials.
- **Meta:** no `META_CAPI_ACCESS_TOKEN`, and `META_PIXEL_ENABLED` is unset.
- **GHL:** no token, so no contact or pipeline sync.
- **iOS push:** no `APNS_*`.
- **Workflows and popups:** `WORKFLOWS_MODE` and `POPUP_VOUCHERS` are unset.
- **The book:** no NEUROS PDF secret, so the book is not on sale on staging.

## Testing on staging
- **Same IP for every request.** Vercel replaces `x-forwarded-for`, so every request from one computer has the same IP. Two protections then apply:
  - the checkout limit: 12 orders per 10 minutes per IP;
  - the antifraud score: about 5 orders from one IP reach ≥40, then 3DS is required.
- **Tests that place many orders** wait out the window and clear the test orders' risk markers first (`email like '%@biohack-e2e.ro'`).
- **Stripe card e2e:**
  ```
  E2E_BASE_URL=<staging URL> DATABASE_URL=<staging> STRIPE_SECRET_KEY=<sk_test> node scripts/stripe-e2e.mjs
  ```
- **Review video on a real storage** (the test refuses the production project):
  ```
  VIDEO_IT_URL=https://vajyphdhiczpltncdknn.supabase.co VIDEO_IT_KEY=<staging service_role> VIDEO_IT_BUCKET=biohacktech-reviews-staging VIDEO_IT_SMALL_BUCKET=size-limit-probe npx vitest run tests/server/video-storage-live.test.ts
  ```
- **Admin:** open `/admin` with the staging password. Admin Stats shows initial, upsell and net revenue separately.
- **Fulfillment:** open `/fulfillment` as user `depozit` with the staging warehouse password.
