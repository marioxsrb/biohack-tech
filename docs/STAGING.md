# Staging (Vercel Preview with its own database)

Written 22 October 2026. Preview deployments already run with `APP_ENV=staging`.

**What Preview does not have** (scoped in Vercel):
- the production database;
- live Stripe keys;
- FGO, GHL and email credentials;
- AI calling;
- the Meta CAPI token.

**Built-in safety:**
- Code refuses live Stripe keys outside production (`config.ts` readStripe).
- Code refuses the production database (`PRODUCTION_DB_REF`, `config.ts`) whenever `APP_ENV` is not `production`.

The steps below need credentials, so a person does them. Claude does not enter or create secrets.

## 1. A separate database
- Create a new Supabase project (free tier is enough), e.g. `biohacktech-staging`, region eu-central-1.
- Take its **transaction pooler** URI (port 6543), with `?sslmode=require&uselibpqcompat=true`.
- The app applies all migrations by itself on first start. You can also run `DATABASE_URL=… npm run db:migrate` locally.

## 2. Preview environment variables
Run these in the project folder. Each command asks for its value; set the Preview target only.

```sh
vercel env add DATABASE_URL preview                 # the staging database (step 1), never the production one
vercel env add STRIPE_SECRET_KEY preview            # sk_test_… (the TEST key of acct_1PmfBwBd7uu5v7wn)
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY preview   # pk_test_…
vercel env add STRIPE_WEBHOOK_SECRET preview        # whsec_ of the TEST webhook endpoint (step 3)
vercel env add ADMIN_PASSWORD preview               # a staging-only admin password
vercel env add ADMIN_SESSION_SECRET preview         # a random 40+ characters (also signs the customer account links)
vercel env add CRON_SECRET preview
vercel env add EMAIL_TRANSPORT preview              # "none" (no email leaves Preview)
```

Optional, for testing the review video upload on Preview: `VIDEO_STORAGE_KEY` (Preview). It should be the key of a staging bucket, not the production one.

## 3. Stripe TEST webhook for Preview
Preview URLs sit behind Vercel Authentication, so Stripe cannot call them directly. Use either:
- a Protection Bypass for Automation secret, with the webhook URL `https://<branch alias>/api/webhooks/stripe?x-vercel-protection-bypass=<secret>`; or
- `stripe listen --forward-to` against a local run (`scripts/stripe-test.mjs`, already isolated).

Events to send: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`.

## 4. What stays off on Preview
- **Emails:** `EMAIL_TRANSPORT=none`.
- **GHL:** no token, so no contact or pipeline sync.
- **AI calls:** no ElevenLabs key.
- **Meta:** no CAPI token. The browser pixel is built with `META_PIXEL_ENABLED` for production only.
- **FGO:** no credentials, so no invoice. Use a test account on testuat.fgo.ro with `FGO_ENV=test` only if wanted.
- **Workflows:** `WORKFLOWS_MODE` is unset (off), or `dry_run`. `POPUP_VOUCHERS` stays unset.

## 5. Smoke test once it is configured
1. Check `/api/health`: database true, card true.
2. In `/admin/vouchere`, issue a test voucher to a synthetic address (e.g. `test+calm@biohack-tech.ro`).
3. Buy with it using card 4242 4242 4242 4242: Calm 5.740 lei, Amber 3 pairs 570 lei, gift 25 lei.
4. Refund partly and fully from the Stripe TEST dashboard and check the voucher's history.
5. Open `/cont/<link>`: generate the link in `/admin/vouchere` and check the vouchers, rewards and review upload.
