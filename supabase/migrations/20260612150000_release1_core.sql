-- Release 1: additive reliability foundation. finance_states remains authoritative.

create table if not exists public.app_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_app_admin(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.app_user_roles
    where user_id = p_user_id and role = 'admin'
  );
$$;
revoke all on function public.is_app_admin(uuid) from public, anon;
grant execute on function public.is_app_admin(uuid) to authenticated;

create table if not exists public.feature_flags (
  key text primary key,
  description text not null default '',
  enabled boolean not null default false,
  rollout_percentage integer not null default 0 check (rollout_percentage between 0 and 100),
  config jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_flag_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  flag_key text not null references public.feature_flags(key) on delete cascade,
  enabled boolean not null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, flag_key)
);

create or replace function public.get_my_feature_flags()
returns table (key text, enabled boolean, config jsonb, source text)
language sql stable security definer set search_path = public, pg_temp as $$
  select
    flag.key,
    coalesce(
      override.enabled,
      flag.enabled and mod(hashtext(auth.uid()::text || ':' || flag.key)::bigint + 2147483648, 100) < flag.rollout_percentage
    ) as enabled,
    flag.config,
    case when override.id is not null then 'override' else 'rollout' end as source
  from public.feature_flags flag
  left join public.user_flag_overrides override
    on override.flag_key = flag.key and override.user_id = auth.uid()
  where auth.uid() is not null;
$$;
grant execute on function public.get_my_feature_flags() to authenticated;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  family_id uuid references public.families(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id text,
  outcome text not null default 'success' check (outcome in ('success', 'failure', 'denied')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  family_id uuid references public.families(id) on delete cascade,
  interaction_type text not null default 'future',
  provider text,
  model text,
  prompt_hash text,
  response_status text not null default 'disabled',
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_ai_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  consent_version text,
  consented_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  external_id text not null,
  name text not null,
  status text not null default 'quote_pending'
    check (status in ('quote_pending', 'quoted', 'purchased', 'archived')),
  current_price numeric(14,2),
  manual_price numeric(14,2),
  target_price numeric(14,2),
  marketplace text,
  marketplace_item_id text,
  original_url text,
  image_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, external_id)
);

create table if not exists public.purchase_price_history (
  id uuid primary key default gen_random_uuid(),
  purchase_item_id uuid not null references public.purchase_items(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  external_id text not null,
  price numeric(14,2) not null check (price > 0),
  store text,
  source text not null default 'manual',
  url text,
  collected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purchase_item_id, external_id)
);

create table if not exists public.benefit_accounts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  external_id text not null,
  name text not null,
  provider text,
  kind text not null check (kind in ('va', 'vr', 'corporate')),
  opening_balance numeric(14,2) not null default 0,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, external_id)
);

create table if not exists public.benefit_transactions (
  id uuid primary key default gen_random_uuid(),
  benefit_account_id uuid not null references public.benefit_accounts(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  external_id text not null,
  transaction_type text not null check (transaction_type in ('credit', 'debit')),
  amount numeric(14,2) not null check (amount > 0),
  description text not null default '',
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (benefit_account_id, external_id)
);

alter table public.financial_events
  add column if not exists is_internal_transfer boolean not null default false,
  add column if not exists transfer_group_id uuid,
  add column if not exists transfer_confidence numeric(5,2),
  add column if not exists transfer_confirmed_at timestamptz,
  add column if not exists transfer_confirmed_by uuid references auth.users(id) on delete set null;

create index if not exists audit_logs_user_created_idx on public.audit_logs(user_id, created_at desc);
create index if not exists audit_logs_family_created_idx on public.audit_logs(family_id, created_at desc);
create index if not exists ai_interactions_expiry_idx on public.ai_interactions(expires_at);
create index if not exists purchase_items_family_status_idx on public.purchase_items(family_id, status);
create index if not exists purchase_price_history_item_date_idx on public.purchase_price_history(purchase_item_id, collected_at desc);
create index if not exists benefit_accounts_family_kind_idx on public.benefit_accounts(family_id, kind);
create index if not exists benefit_transactions_account_date_idx on public.benefit_transactions(benefit_account_id, occurred_at desc);
create index if not exists financial_events_transfer_idx on public.financial_events(family_id, transfer_group_id)
  where is_internal_transfer = true;

create or replace function public.release1_set_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at := now(); return new; end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'app_user_roles','feature_flags','user_flag_overrides','audit_logs','ai_interactions',
    'user_ai_settings','purchase_items','purchase_price_history','benefit_accounts','benefit_transactions'
  ] loop
    execute format('drop trigger if exists release1_updated_at on public.%I', table_name);
    execute format(
      'create trigger release1_updated_at before update on public.%I for each row execute function public.release1_set_updated_at()',
      table_name
    );
  end loop;
end $$;

alter table public.app_user_roles enable row level security;
alter table public.feature_flags enable row level security;
alter table public.user_flag_overrides enable row level security;
alter table public.audit_logs enable row level security;
alter table public.ai_interactions enable row level security;
alter table public.user_ai_settings enable row level security;
alter table public.purchase_items enable row level security;
alter table public.purchase_price_history enable row level security;
alter table public.benefit_accounts enable row level security;
alter table public.benefit_transactions enable row level security;

drop policy if exists "app roles read own or admin" on public.app_user_roles;
drop policy if exists "app roles admin manage" on public.app_user_roles;
drop policy if exists "flags authenticated read" on public.feature_flags;
drop policy if exists "flags admin manage" on public.feature_flags;
drop policy if exists "overrides read own or admin" on public.user_flag_overrides;
drop policy if exists "overrides admin manage" on public.user_flag_overrides;
drop policy if exists "audit read own" on public.audit_logs;
drop policy if exists "audit insert own" on public.audit_logs;
drop policy if exists "ai logs read own" on public.ai_interactions;
drop policy if exists "ai logs insert own" on public.ai_interactions;
drop policy if exists "ai settings own" on public.user_ai_settings;
drop policy if exists "purchase items family read" on public.purchase_items;
drop policy if exists "purchase items family write" on public.purchase_items;
drop policy if exists "purchase history family read" on public.purchase_price_history;
drop policy if exists "purchase history family write" on public.purchase_price_history;
drop policy if exists "benefit accounts family read" on public.benefit_accounts;
drop policy if exists "benefit accounts family write" on public.benefit_accounts;
drop policy if exists "benefit transactions family read" on public.benefit_transactions;
drop policy if exists "benefit transactions family write" on public.benefit_transactions;

create policy "app roles read own or admin" on public.app_user_roles for select to authenticated
using (user_id = auth.uid() or public.is_app_admin());
create policy "app roles admin manage" on public.app_user_roles for all to authenticated
using (public.is_app_admin()) with check (public.is_app_admin());
create policy "flags authenticated read" on public.feature_flags for select to authenticated
using (public.is_app_admin());
create policy "flags admin manage" on public.feature_flags for all to authenticated
using (public.is_app_admin()) with check (public.is_app_admin());
create policy "overrides read own or admin" on public.user_flag_overrides for select to authenticated
using (user_id = auth.uid() or public.is_app_admin());
create policy "overrides admin manage" on public.user_flag_overrides for all to authenticated
using (public.is_app_admin()) with check (public.is_app_admin());
create policy "audit read own" on public.audit_logs for select to authenticated using (user_id = auth.uid());
create policy "audit insert own" on public.audit_logs for insert to authenticated
with check (user_id = auth.uid() and (family_id is null or family_id in (select public.user_family_ids())));
create policy "ai logs read own" on public.ai_interactions for select to authenticated using (user_id = auth.uid());
create policy "ai logs insert own" on public.ai_interactions for insert to authenticated with check (user_id = auth.uid());
create policy "ai settings own" on public.user_ai_settings for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "purchase items family read" on public.purchase_items for select to authenticated
using (family_id in (select public.user_family_ids()));
create policy "purchase items family write" on public.purchase_items for all to authenticated
using (public.user_can_edit_family(family_id)) with check (public.user_can_edit_family(family_id) and user_id = auth.uid());
create policy "purchase history family read" on public.purchase_price_history for select to authenticated
using (family_id in (select public.user_family_ids()));
create policy "purchase history family write" on public.purchase_price_history for all to authenticated
using (public.user_can_edit_family(family_id)) with check (public.user_can_edit_family(family_id) and user_id = auth.uid());
create policy "benefit accounts family read" on public.benefit_accounts for select to authenticated
using (family_id in (select public.user_family_ids()));
create policy "benefit accounts family write" on public.benefit_accounts for all to authenticated
using (public.user_can_edit_family(family_id)) with check (public.user_can_edit_family(family_id) and user_id = auth.uid());
create policy "benefit transactions family read" on public.benefit_transactions for select to authenticated
using (family_id in (select public.user_family_ids()));
create policy "benefit transactions family write" on public.benefit_transactions for all to authenticated
using (public.user_can_edit_family(family_id)) with check (public.user_can_edit_family(family_id) and user_id = auth.uid());

grant select, insert, update, delete on public.app_user_roles, public.feature_flags, public.user_flag_overrides to authenticated;
grant select, insert on public.audit_logs, public.ai_interactions to authenticated;
grant select, insert, update on public.user_ai_settings to authenticated;
grant select, insert, update, delete on public.purchase_items, public.purchase_price_history,
  public.benefit_accounts, public.benefit_transactions to authenticated;

insert into public.feature_flags(key, description, enabled, rollout_percentage)
values
  ('release1_monthly_report', 'Relatorio mensal autenticado', true, 100),
  ('release1_net_worth', 'Patrimonio liquido autenticado', true, 100),
  ('ai_features', 'Recursos futuros de IA sujeitos a consentimento', false, 0)
on conflict (key) do nothing;
