/**
 * Database schema, as ordered migrations. Plain SQL, no imports, so the CLI
 * (scripts/db-migrate.mjs) and the app share one definition.
 * Never edit a migration that has run in production; add a new one.
 */
export const migrations: { id: string; sql: string }[] = [
  {
    id: '001_orders',
    sql: `
create sequence if not exists order_seq start 1;

create table if not exists orders (
  id uuid primary key,
  order_number text not null unique,
  public_token text not null unique,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  status text not null,
  payment_status text not null,
  payment_method text not null,
  invoice_status text not null default 'none',

  currency text not null default 'RON',
  subtotal_minor integer not null,
  shipping_minor integer not null,
  total_minor integer not null,
  refunded_minor integer not null default 0,

  email text not null,
  phone text not null,
  customer jsonb not null,
  billing_address jsonb not null,
  shipping_address jsonb not null,
  notes text not null default '',
  marketing_consent boolean not null default false,
  terms_accepted_at timestamptz not null,

  stripe_payment_intent_id text unique,
  paid_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  refunded_at timestamptz,

  fgo_invoice_series text,
  fgo_invoice_number text,
  fgo_invoice_link text,
  fgo_storno_number text,

  ghl_contact_id text,
  ghl_opportunity_id text,

  courier text,
  tracking_number text,
  tracking_url text,
  shipped_at timestamptz,
  delivered_at timestamptz
);
create index if not exists orders_created_idx on orders (created_at desc);
create index if not exists orders_email_idx on orders (email);

create table if not exists order_items (
  id bigserial primary key,
  order_id uuid not null references orders(id) on delete cascade,
  position integer not null,
  product_id text not null,
  variant_id text,
  product_name text not null,
  variant_name text,
  sku text not null,
  quantity integer not null check (quantity > 0),
  unit_price_minor integer not null check (unit_price_minor >= 0),
  line_total_minor integer not null
);
create index if not exists order_items_order_idx on order_items (order_id);

create table if not exists order_events (
  id bigserial primary key,
  order_id uuid not null references orders(id) on delete cascade,
  type text not null,
  source text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on order_events (order_id, id);

create table if not exists jobs (
  id bigserial primary key,
  order_id uuid references orders(id) on delete cascade,
  kind text not null,
  dedupe_key text not null unique,
  payload jsonb not null default '{}',
  status text not null default 'pending',
  attempts integer not null default 0,
  run_at timestamptz not null default now(),
  locked_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jobs_due_idx on jobs (status, run_at);

create table if not exists webhook_events (
  provider text not null,
  event_id text not null,
  type text not null,
  received_at timestamptz not null default now(),
  primary key (provider, event_id)
);
`,
  },
  {
    // Order numbers BHT-YYYYMMDD-XXXX: one counter per calendar day (Romanian time).
    // Webhook events also keep what processing decided, for support and audits.
    id: '002_day_order_numbers_webhook_outcome',
    sql: `
create table if not exists order_day_counters (
  day date primary key,
  last_value integer not null check (last_value > 0)
);

alter table webhook_events add column if not exists outcome text;
`,
  },
  {
    // Email marketing consent: one subject per email address (with its opaque unsubscribe token) and an
    // append-only log of what was agreed or withdrawn, with the exact wording and where it happened.
    // The current state of an address is its latest event. Cookie choices are logged separately under a
    // random id kept in the visitor's browser: no IP, no user agent, nothing that identifies a person.
    // Orders get the checkout-recovery decision and an opaque, expiring link that only restores the cart.
    // Online withdrawal statements are kept with their exact content and time.
    id: '003_consent_recovery',
    sql: `
create table if not exists marketing_subjects (
  email text primary key,
  unsubscribe_token text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists marketing_consent_events (
  id bigserial primary key,
  email text not null references marketing_subjects(email) on delete cascade,
  granted boolean not null,
  source text not null,
  text_version text not null,
  consent_text text not null,
  order_id uuid references orders(id) on delete set null,
  page text,
  created_at timestamptz not null default now()
);
create index if not exists marketing_consent_events_email_idx on marketing_consent_events (email, id desc);

create table if not exists cookie_consents (
  id bigserial primary key,
  consent_id uuid not null,
  policy_version text not null,
  analytics boolean not null,
  marketing boolean not null,
  action text not null,
  page text,
  created_at timestamptz not null default now()
);
create index if not exists cookie_consents_id_idx on cookie_consents (consent_id, id desc);

-- Online withdrawal statements (OUG 34/2014 art. 11^1): what was declared, when, for which order.
create table if not exists withdrawal_requests (
  id uuid primary key,
  reference text not null unique,
  order_id uuid references orders(id) on delete set null,
  order_number text not null,
  name text not null,
  email text not null,
  items text not null,
  message text not null default '',
  status text not null default 'new',
  created_at timestamptz not null default now()
);
create index if not exists withdrawal_requests_created_idx on withdrawal_requests (created_at desc);

alter table orders add column if not exists recovery_status text;
alter table orders add column if not exists recovery_reason text;
alter table orders add column if not exists recovery_token text unique;
alter table orders add column if not exists recovery_expires_at timestamptz
`,
  },
  {
    // Where an order came from (advertising landing, UTM parameters), validated server-side.
    // Returns after a withdrawal: requested, then the product received back. Refunds stay on the payment axis.
    id: '004_attribution_returns',
    sql: `
alter table orders add column if not exists attribution jsonb;
alter table orders add column if not exists return_status text;
alter table orders add column if not exists return_requested_at timestamptz;
alter table orders add column if not exists return_received_at timestamptz;
create index if not exists orders_return_status_idx on orders (return_status) where return_status is not null
`,
  },
  {
    // Promotions: the discount and its explanation are stored with the order and per line (for invoices).
    // Post-purchase offers: a separate, linked order (own payment, own invoice), at most one per parent.
    // Contact form enquiries.
    id: '005_promotions_upsell_enquiries',
    sql: `
alter table orders add column if not exists discount_minor integer not null default 0;
alter table orders add column if not exists promotions jsonb not null default '[]'::jsonb;
alter table orders add column if not exists kind text not null default 'checkout';
alter table orders add column if not exists parent_order_id uuid references orders(id);
alter table orders add column if not exists stripe_customer_id text;
alter table orders add column if not exists stripe_payment_method_id text;
alter table orders add column if not exists upsell_status text;
alter table orders add column if not exists upsell_expires_at timestamptz;
create unique index if not exists orders_one_upsell_per_parent on orders (parent_order_id) where parent_order_id is not null;
alter table order_items add column if not exists discount_minor integer not null default 0;
alter table order_items add column if not exists promotion_id text;

create table if not exists enquiries (
  id uuid primary key,
  reference text not null unique,
  idempotency_key text not null unique,
  name text not null,
  email text not null,
  phone text not null default '',
  topic text not null,
  message text not null,
  status text not null default 'new',
  source_page text,
  attribution jsonb,
  ghl_contact_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists enquiries_created_idx on enquiries (created_at desc);
create index if not exists enquiries_status_idx on enquiries (status)
`,
  },
  {
    // Cash on delivery (ramburs): what the courier must collect, and the settlement reference that makes it paid.
    id: '006_cash_on_delivery',
    sql: `
alter table orders add column if not exists cod_amount_minor integer;
alter table orders add column if not exists cod_reference text
`,
  },
  {
    // Conversion engine (phase 4/5/7): leads from the price-gated funnel (acces.biohack-tech.ro) and from the
    // checkout's contact step, their abandonment and recovery state, and anonymous daily visit counts per
    // funnel. One lead per visitor, funnel and product interest. Row level security on, no policy: only the
    // server (table owner) reads or writes; Supabase's public API sees nothing.
    id: '007_leads',
    sql: `
create table if not exists leads (
  id uuid primary key,
  visitor_id text not null,
  funnel text not null check (funnel in ('visible_price', 'gated_price')),
  product_id text not null default '',
  variant_id text,
  name text,
  email text not null,
  phone text,
  stage text not null default 'lead' check (stage in ('lead', 'checkout_started', 'ordered', 'purchased')),
  cart jsonb,
  attribution jsonb,
  landing_host text,
  fbclid text,
  privacy_version text,
  marketing_consent boolean not null default false,
  call_consent boolean not null default false,
  contact_preference text,
  order_id uuid references orders(id) on delete set null,
  abandonment text check (abandonment in ('lead_abandoned', 'checkout_abandoned')),
  recovery_status text not null default 'none',
  recovery_reason text,
  recovery_sent integer not null default 0,
  last_recovery_at timestamptz,
  recovery_token text unique,
  ghl_contact_id text,
  price_revealed_at timestamptz,
  checkout_started_at timestamptz,
  ordered_at timestamptz,
  purchased_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (visitor_id, funnel, product_id)
);
create index if not exists leads_email_idx on leads (email);
create index if not exists leads_created_idx on leads (created_at desc);
create index if not exists leads_funnel_idx on leads (funnel, created_at desc);
create index if not exists leads_order_idx on leads (order_id);
alter table leads enable row level security;
create table if not exists funnel_visits (
  day date not null,
  funnel text not null,
  page text not null,
  visits integer not null default 0,
  primary key (day, funnel, page)
);
alter table funnel_visits enable row level security;
alter table orders add column if not exists lead_id uuid
`,
  },
  {
    // AI calling (Group 3): the separate consent to automated calls (its own log, by phone number), one row
    // per call attempt (status, outcome, provider ids; no transcript, no recording), and the calling state
    // kept on the lead for the admin list. Row level security on, no policy: server only.
    id: '008_ai_calling',
    sql: `
create table if not exists call_consent_events (
  id bigserial primary key,
  phone text not null,
  email text,
  granted boolean not null,
  text_version text,
  source text not null,
  page text,
  lead_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists call_consent_phone_idx on call_consent_events (phone, id desc);
create index if not exists call_consent_email_idx on call_consent_events (email);
alter table call_consent_events enable row level security;
create table if not exists calls (
  id uuid primary key,
  lead_id uuid not null references leads(id) on delete cascade,
  phone text not null,
  product_id text not null default '',
  attempt integer not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'dry_run', 'dialing', 'completed', 'failed', 'unknown', 'cancelled')),
  provider text not null default 'elevenlabs',
  provider_call_id text unique,
  provider_call_sid text,
  outcome text,
  follow_up boolean not null default false,
  opted_out boolean not null default false,
  wants_link boolean not null default false,
  error text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_secs integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, attempt)
);
create index if not exists calls_phone_idx on calls (phone, created_at desc);
alter table calls enable row level security;
alter table leads add column if not exists call_status text not null default 'none';
alter table leads add column if not exists call_attempts integer not null default 0;
alter table leads add column if not exists call_outcome text;
alter table leads add column if not exists last_call_at timestamptz;
alter table leads add column if not exists call_disabled boolean not null default false
`,
  },
  {
    // Admin stats: anonymous daily counts per funnel, page and campaign. `views` = page loads, `sessions` = the
    // first page of a browser session (the browser remembers it locally; nothing identifies the visitor).
    // Replaces funnel_visits (kept for its history). Row level security on, no policy: server only.
    id: '009_visit_stats',
    sql: `
create table if not exists visit_stats (
  day date not null,
  funnel text not null,
  page text not null,
  source text not null default '',
  campaign text not null default '',
  views integer not null default 0,
  sessions integer not null default 0,
  primary key (day, funnel, page, source, campaign)
);
alter table visit_stats enable row level security;
create index if not exists leads_order_created_idx on leads (created_at, funnel)
`,
  },
  {
    // The price form: the optional terms box, and the device key that lets a returning device see prices again
    // without the form (an HMAC of a device hash and the network prefix, never the raw signals or the IP).
    id: '010_lead_device',
    sql: `
alter table leads add column if not exists terms_accepted_at timestamptz;
alter table leads add column if not exists device_key text;
create index if not exists leads_device_idx on leads (device_key, created_at desc)
`,
  },
  {
    // Promo codes, managed in /admin/coduri. A redemption is one order that used a code; it counts towards the
    // limits while its order stands (a cancelled order or an unpaid card attempt frees it). Row level security
    // on, no policy: server only.
    id: '011_promo_codes',
    sql: `
create table if not exists promo_codes (
  code text primary key,
  kind text not null check (kind in ('percent','fixed')),
  value integer not null check (value > 0),
  products text[],
  min_order_minor integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses integer,
  once_per_email boolean not null default false,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table promo_codes enable row level security;
create table if not exists promo_redemptions (
  order_id uuid primary key references orders(id) on delete cascade,
  code text not null references promo_codes(code),
  email text not null,
  discount_minor integer not null,
  created_at timestamptz not null default now()
);
create index if not exists promo_redemptions_code_idx on promo_redemptions (code, email);
alter table promo_redemptions enable row level security;
alter table orders add column if not exists promo_code text;
alter table order_items add column if not exists code_discount_minor integer not null default 0
`,
  },
  {
    // AI call recovery: a unique, single-use 10% code per called lead (not combined with the automatic
    // promotions), and what each call offered, sent and heard (no transcript).
    id: '012_call_recovery',
    sql: `
alter table promo_codes add column if not exists exclusive boolean not null default false;
alter table promo_codes add column if not exists lead_id uuid references leads(id) on delete set null;
alter table promo_codes add column if not exists restricted_email text;
create unique index if not exists promo_codes_lead_idx on promo_codes (lead_id) where lead_id is not null;
alter table calls add column if not exists funnel text;
alter table calls add column if not exists scenario text;
alter table calls add column if not exists product_interest text;
alter table calls add column if not exists discount_code text;
alter table calls add column if not exists email_status text;
alter table calls add column if not exists agent_outcome text;
alter table calls add column if not exists follow_up_reason text
`,
  },
  {
    // The two fixed 10% codes: the AI caller's and the website popup's. Only created when missing (an edit made in
    // /admin/coduri stays). Once per address; like every code they add to the automatic promotions.
    id: '013_fixed_codes',
    sql: `
insert into promo_codes (code, kind, value, once_per_email, note) values
  ('BIOHACK10', 'percent', 10, true, 'Apel AI: reducerea oferită de asistent'),
  ('LONGEVITY10', 'percent', 10, true, 'Popup site: emailul de bun venit')
on conflict (code) do nothing;
create table if not exists welcome_signups (
  email text primary key,
  page text,
  created_at timestamptz not null default now()
);
alter table welcome_signups enable row level security
`,
  },
  {
    // The admin's store settings (prices, stock, switches), what each admin change did, and the API keys.
    id: '014_admin_settings',
    sql: `
create table if not exists store_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table store_settings enable row level security;
create table if not exists admin_audit (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb
);
create index if not exists admin_audit_at_idx on admin_audit (at desc);
alter table admin_audit enable row level security;
create table if not exists admin_api_keys (
  id uuid primary key,
  name text not null,
  prefix text not null,
  key_hash text not null unique,
  scope text not null check (scope in ('read', 'full')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
alter table admin_api_keys enable row level security
`,
  },
  {
    // Visits per site: the main store, acces and each landing (calm., focus., amber.). Older counts are the
    // main site's, except the price-gated funnel's (acces).
    id: '015_visit_site',
    sql: `
alter table visit_stats add column if not exists site text not null default 'main';
update visit_stats set site = 'acces' where funnel = 'gated_price' and site = 'main';
alter table visit_stats drop constraint if exists visit_stats_pkey;
alter table visit_stats add primary key (day, site, funnel, page, source, campaign)
`,
  },
  {
    // AI calls: numbers never to call (whatever else says), and test calls placed from /admin/apeluri.
    id: '016_call_blocklist_tests',
    sql: `
create table if not exists call_blocklist (
  phone text primary key,
  note text,
  created_at timestamptz not null default now(),
  created_by text
);
alter table call_blocklist enable row level security;
create table if not exists test_calls (
  id uuid primary key,
  phone text not null,
  scenario text not null,
  vars jsonb not null,
  status text not null default 'dialing',
  conversation_id text unique,
  outcome text,
  agent_outcome text,
  duration_secs integer,
  error text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table test_calls enable row level security
`,
  },
  {
    // The admin's custom charts on the dashboard (metric, split, period, kind), in the order they were added.
    id: '017_admin_charts',
    sql: `
create table if not exists admin_charts (
  id uuid primary key,
  title text not null,
  config jsonb not null,
  created_at timestamptz not null default now()
);
alter table admin_charts enable row level security
`,
  },
  {
    // The website assistant: support requests (escalations to a person) and one-time codes that prove an
    // order's email before the assistant says anything about the order. Codes are stored hashed only.
    id: '018_assistant_support',
    sql: `
create table if not exists support_requests (
  id uuid primary key,
  ref text not null unique,
  category text not null,
  summary text not null,
  status text not null default 'open',
  urgent boolean not null default false,
  order_id uuid references orders(id),
  email text,
  name text,
  phone text,
  dedupe_key text,
  source text not null default 'assistant',
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists support_requests_status on support_requests (status, created_at desc);
create index if not exists support_requests_dedupe on support_requests (dedupe_key, created_at desc);
alter table support_requests enable row level security;
create table if not exists order_otps (
  id uuid primary key,
  order_id uuid not null references orders(id),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists order_otps_order on order_otps (order_id, created_at desc);
alter table order_otps enable row level security
`,
  },
  {
    // The website assistant's daily use (requests, tokens, errors): the admin sees it, and a daily cap reads it.
    id: '019_assistant_usage',
    sql: `
create table if not exists assistant_usage (
  day date primary key,
  requests integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  cache_read_tokens bigint not null default 0,
  cache_write_tokens bigint not null default 0,
  errors integer not null default 0,
  quota_errors integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table assistant_usage enable row level security
`,
  },
  {
    // International orders (biohack-tech.net, English pages): the currency's rate at the time (lei per unit, 1 for
    // lei), the customer's language and the site; the language of leads, for their emails.
    id: '020_international',
    sql: `
alter table orders add column if not exists fx_rate numeric(12, 6) not null default 1;
alter table orders add column if not exists locale text not null default 'ro';
alter table orders add column if not exists site text not null default 'ro';
alter table leads add column if not exists locale text not null default 'ro'
`,
  },
  {
    // The person's opportunity in the CRM's leads pipeline (one per address), so a second sync moves it instead of
    // creating another while GHL's search has not indexed the first yet.
    id: '021_crm_prospects',
    sql: `
create table if not exists crm_prospects (
  email text primary key,
  ghl_opportunity_id text not null,
  updated_at timestamptz not null default now()
);
alter table crm_prospects enable row level security
`,
  },
]
