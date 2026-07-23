create table if not exists public.price_search_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cache_key text not null unique,
  provider text not null,
  normalized_query text not null,
  product_identity jsonb not null default '{}'::jsonb,
  status text not null check (status in ('pending', 'success', 'failed')),
  accepted_candidates jsonb not null default '[]'::jsonb,
  ambiguous_candidates jsonb not null default '[]'::jsonb,
  rejected_candidates jsonb not null default '[]'::jsonb,
  best_compatible_offer jsonb,
  error_code text,
  error_message text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists price_search_cache_user_idx on public.price_search_cache(user_id);
create index if not exists price_search_cache_expires_idx on public.price_search_cache(expires_at);

alter table public.price_search_cache enable row level security;

drop policy if exists "price_search_cache_owner_select" on public.price_search_cache;
create policy "price_search_cache_owner_select"
on public.price_search_cache
for select
using (auth.uid() = user_id);

drop policy if exists "price_search_cache_owner_write" on public.price_search_cache;
create policy "price_search_cache_owner_write"
on public.price_search_cache
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update, delete on public.price_search_cache to authenticated;
grant all on public.price_search_cache to service_role;
