-- Release 11.4: canonical product identities for URL-created wishlist items.
-- The app still uses finance_states JSON as the source of truth for wishlist items,
-- but this table gives URL identities a normalized, user-scoped audit anchor.

create table if not exists public.product_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('amazon', 'mercadolivre')),
  source_product_id text not null,
  id_type text not null,
  canonical_url text not null,
  title text,
  brand text,
  category text,
  image_url text,
  identity_source text not null default 'url' check (identity_source in ('url')),
  identity_confidence numeric not null default 1 check (identity_confidence >= 0 and identity_confidence <= 1),
  raw_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_identities_user_source_product_unique unique (user_id, source, source_product_id)
);

create index if not exists product_identities_user_updated_idx
  on public.product_identities(user_id, updated_at desc);

create or replace function public.touch_product_identities_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_product_identities_updated_at on public.product_identities;
create trigger touch_product_identities_updated_at
before update on public.product_identities
for each row execute function public.touch_product_identities_updated_at();

alter table public.product_identities enable row level security;
alter table public.product_identities force row level security;

drop policy if exists "product identities select own" on public.product_identities;
create policy "product identities select own"
on public.product_identities
for select
using (auth.uid() = user_id);

drop policy if exists "product identities insert own" on public.product_identities;
create policy "product identities insert own"
on public.product_identities
for insert
with check (auth.uid() = user_id);

drop policy if exists "product identities update own" on public.product_identities;
create policy "product identities update own"
on public.product_identities
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

revoke all on public.product_identities from anon;
revoke all on public.product_identities from authenticated;
grant select, insert, update on public.product_identities to authenticated;
grant all on public.product_identities to service_role;

do $$
begin
  if to_regclass('public.wishlist_items') is not null then
    alter table public.wishlist_items
      add column if not exists product_identity_id uuid references public.product_identities(id) on delete set null,
      add column if not exists source text,
      add column if not exists source_product_id text,
      add column if not exists canonical_url text,
      add column if not exists identity_locked boolean not null default false,
      add column if not exists identity_status text not null default 'pending';

    create index if not exists wishlist_items_product_identity_idx
      on public.wishlist_items(product_identity_id);
  end if;
end;
$$;
