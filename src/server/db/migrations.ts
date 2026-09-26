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
]
