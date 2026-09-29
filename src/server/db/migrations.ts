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
]
