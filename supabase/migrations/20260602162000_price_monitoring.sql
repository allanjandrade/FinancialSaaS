create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text default '',
  category text default 'Mercado',
  barcode text,
  default_unit text default 'un',
  created_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text default 'manual',
  website_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.price_records (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  price numeric(12, 2) not null check (price > 0),
  unit_price numeric(12, 4),
  quantity numeric(12, 3) default 1,
  currency text not null default 'BRL',
  source text not null default 'manual',
  collected_at timestamptz not null default now(),
  product_url text,
  availability text default 'available',
  notes text
);

create table if not exists public.user_tracked_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  target_price numeric(12, 2),
  usual_quantity numeric(12, 3) default 1,
  purchase_frequency_days integer default 30,
  alert_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  condition_type text not null default 'below_target',
  target_price numeric(12, 2),
  triggered_at timestamptz not null default now(),
  status text not null default 'open',
  price_record_id uuid references public.price_records(id) on delete set null
);

create index if not exists idx_price_records_product_collected
  on public.price_records(product_id, collected_at desc);

create index if not exists idx_user_tracked_products_user
  on public.user_tracked_products(user_id);

create index if not exists idx_price_alerts_user_status
  on public.price_alerts(user_id, status);

alter table public.products enable row level security;
alter table public.stores enable row level security;
alter table public.price_records enable row level security;
alter table public.user_tracked_products enable row level security;
alter table public.price_alerts enable row level security;

drop policy if exists "products readable authenticated" on public.products;
create policy "products readable authenticated"
  on public.products for select
  to authenticated
  using (true);

drop policy if exists "products insert authenticated" on public.products;
create policy "products insert authenticated"
  on public.products for insert
  to authenticated
  with check (true);

drop policy if exists "stores readable authenticated" on public.stores;
create policy "stores readable authenticated"
  on public.stores for select
  to authenticated
  using (true);

drop policy if exists "stores insert authenticated" on public.stores;
create policy "stores insert authenticated"
  on public.stores for insert
  to authenticated
  with check (true);

drop policy if exists "tracked products own rows" on public.user_tracked_products;
create policy "tracked products own rows"
  on public.user_tracked_products for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "price alerts own rows" on public.price_alerts;
create policy "price alerts own rows"
  on public.price_alerts for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "price records for tracked products" on public.price_records;
create policy "price records for tracked products"
  on public.price_records for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_tracked_products tracked
      where tracked.product_id = price_records.product_id
        and tracked.user_id = auth.uid()
    )
  );

drop policy if exists "price records insert authenticated" on public.price_records;
create policy "price records insert authenticated"
  on public.price_records for insert
  to authenticated
  with check (true);
