create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid null,
  name text not null,
  provider text,
  category text not null,
  amount numeric(12,2) not null,
  currency text default 'BRL',
  billing_cycle text not null,
  billing_interval integer default 1,
  next_billing_date date not null,
  started_at date null,
  ended_at date null,
  status text not null default 'active',
  payment_method_type text,
  account_id uuid null,
  card_id uuid null,
  is_essential boolean default false,
  reminder_days integer default 3,
  notes text null,
  url text null,
  source text default 'manual',
  auto_detect_rules jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz null,
  constraint subscriptions_amount_check check (amount >= 0),
  constraint subscriptions_billing_interval_check check (billing_interval >= 1),
  constraint subscriptions_billing_cycle_check check (
    billing_cycle in ('weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual', 'custom')
  ),
  constraint subscriptions_status_check check (
    status in ('active', 'trial', 'paused', 'cancelled', 'expired')
  ),
  constraint subscriptions_payment_method_type_check check (
    payment_method_type is null or payment_method_type in ('card', 'account', 'benefit', 'other')
  )
);

create table if not exists public.subscription_charges (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  transaction_id uuid null,
  charged_at date not null,
  amount numeric(12,2) not null,
  status text default 'paid',
  created_at timestamptz default now(),
  constraint subscription_charges_amount_check check (amount >= 0),
  constraint subscription_charges_status_check check (status in ('expected', 'paid', 'linked', 'missed', 'ignored'))
);

create index if not exists subscriptions_user_next_billing_idx
  on public.subscriptions(user_id, next_billing_date)
  where deleted_at is null;

create index if not exists subscriptions_user_status_idx
  on public.subscriptions(user_id, status)
  where deleted_at is null;

create index if not exists subscription_charges_subscription_date_idx
  on public.subscription_charges(subscription_id, charged_at desc);

create or replace function public.touch_subscriptions_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_subscriptions_updated_at on public.subscriptions;
create trigger touch_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.touch_subscriptions_updated_at();

alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;
alter table public.subscription_charges enable row level security;
alter table public.subscription_charges force row level security;

revoke all on public.subscriptions from anon;
revoke all on public.subscription_charges from anon;
grant select, insert, update on public.subscriptions to authenticated;
grant select, insert, update on public.subscription_charges to authenticated;
grant all on public.subscriptions to service_role;
grant all on public.subscription_charges to service_role;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id and deleted_at is null);

drop policy if exists "subscriptions_insert_own" on public.subscriptions;
create policy "subscriptions_insert_own"
on public.subscriptions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "subscriptions_update_own" on public.subscriptions;
create policy "subscriptions_update_own"
on public.subscriptions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "subscriptions_delete_own" on public.subscriptions;

drop policy if exists "subscription_charges_select_own" on public.subscription_charges;
create policy "subscription_charges_select_own"
on public.subscription_charges
for select
to authenticated
using (
  exists (
    select 1
    from public.subscriptions s
    where s.id = subscription_charges.subscription_id
      and s.user_id = auth.uid()
      and s.deleted_at is null
  )
);

drop policy if exists "subscription_charges_insert_own" on public.subscription_charges;
create policy "subscription_charges_insert_own"
on public.subscription_charges
for insert
to authenticated
with check (
  exists (
    select 1
    from public.subscriptions s
    where s.id = subscription_charges.subscription_id
      and s.user_id = auth.uid()
      and s.deleted_at is null
  )
);

drop policy if exists "subscription_charges_update_own" on public.subscription_charges;
create policy "subscription_charges_update_own"
on public.subscription_charges
for update
to authenticated
using (
  exists (
    select 1
    from public.subscriptions s
    where s.id = subscription_charges.subscription_id
      and s.user_id = auth.uid()
      and s.deleted_at is null
  )
)
with check (
  exists (
    select 1
    from public.subscriptions s
    where s.id = subscription_charges.subscription_id
      and s.user_id = auth.uid()
      and s.deleted_at is null
  )
);

drop policy if exists "subscription_charges_delete_own" on public.subscription_charges;
