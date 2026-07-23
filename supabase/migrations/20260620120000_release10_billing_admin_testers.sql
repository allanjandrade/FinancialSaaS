create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_customer_id text not null,
  created_at timestamptz not null default now(),
  unique(provider, provider_customer_id),
  unique(user_id, provider)
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'mock',
  provider_subscription_id text,
  plan_code text not null,
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired', 'free')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  processed boolean not null default false,
  payload_sanitized jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(provider, event_id)
);

create table if not exists public.feature_entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null,
  feature_key text not null,
  limit_value integer,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique(plan_code, feature_key)
);

create table if not exists public.usage_metering (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  quantity integer not null default 1,
  cost_estimate numeric(12,4) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'support')),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.beta_testers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('invited', 'active', 'revoked', 'expired')),
  tester_group text not null default 'default',
  access_starts_at timestamptz not null default now(),
  access_expires_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.tester_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  invite_token_hash text not null unique,
  status text not null check (status in ('pending', 'accepted', 'revoked', 'expired')),
  tester_group text not null default 'default',
  access_expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz not null
);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  enabled boolean not null default false,
  rollout_percentage integer not null default 0 check (rollout_percentage >= 0 and rollout_percentage <= 100),
  config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_feature_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null,
  reason text,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, feature_key)
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tester_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  area text not null,
  rating integer check (rating >= 1 and rating <= 5),
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_events enable row level security;
alter table public.feature_entitlements enable row level security;
alter table public.usage_metering enable row level security;
alter table public.admin_users enable row level security;
alter table public.beta_testers enable row level security;
alter table public.tester_invites enable row level security;
alter table public.feature_flags enable row level security;
alter table public.user_feature_overrides enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.tester_feedback enable row level security;

drop policy if exists "billing_subscriptions_select_own" on public.billing_subscriptions;
create policy "billing_subscriptions_select_own" on public.billing_subscriptions for select using (auth.uid() = user_id);

drop policy if exists "usage_metering_select_own" on public.usage_metering;
create policy "usage_metering_select_own" on public.usage_metering for select using (auth.uid() = user_id);

drop policy if exists "beta_testers_select_own" on public.beta_testers;
create policy "beta_testers_select_own" on public.beta_testers for select using (auth.uid() = user_id);

drop policy if exists "user_feature_overrides_select_own" on public.user_feature_overrides;
create policy "user_feature_overrides_select_own" on public.user_feature_overrides for select using (auth.uid() = user_id);

drop policy if exists "tester_feedback_insert_own" on public.tester_feedback;
create policy "tester_feedback_insert_own" on public.tester_feedback for insert with check (auth.uid() = user_id);

drop policy if exists "tester_feedback_select_own" on public.tester_feedback;
create policy "tester_feedback_select_own" on public.tester_feedback for select using (auth.uid() = user_id);

insert into public.feature_flags (key, description, enabled, rollout_percentage)
values
  ('predictive_advisor', 'Consultor preditivo', false, 0),
  ('scenario_simulation', 'Cenarios preditivos', false, 0),
  ('advanced_reports', 'Relatorios avancados', false, 0),
  ('price_search', 'Busca de preco compativel', true, 100),
  ('automations', 'Automacoes in-app', false, 0),
  ('family_members', 'Membros da familia', false, 0),
  ('billing_trial', 'Trial Premium', true, 100),
  ('billing_checkout', 'Checkout de assinatura', true, 100),
  ('admin_panel', 'Painel administrativo', false, 0),
  ('operational_dashboard', 'Painel operacional', false, 0)
on conflict (key) do nothing;

insert into public.feature_entitlements (plan_code, feature_key, limit_value, enabled)
values
  ('free', 'price_search', 3, true),
  ('free', 'wishlist_items', 3, true),
  ('free', 'ai_questions', 10, true),
  ('free', 'ocr_uploads', 3, true),
  ('premium_monthly', 'predictive_advisor', null, true),
  ('premium_monthly', 'scenario_simulation', null, true),
  ('premium_monthly', 'advanced_reports', null, true),
  ('premium_monthly', 'price_search', 50, true),
  ('premium_monthly', 'automations', 10, true),
  ('premium_annual', 'predictive_advisor', null, true),
  ('premium_annual', 'scenario_simulation', null, true),
  ('premium_annual', 'advanced_reports', null, true),
  ('premium_annual', 'price_search', 50, true),
  ('premium_annual', 'automations', 10, true)
on conflict (plan_code, feature_key) do nothing;
