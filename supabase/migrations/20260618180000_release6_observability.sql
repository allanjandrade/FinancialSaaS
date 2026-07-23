-- Release 6: observability, operational governance and production hardening.

create table if not exists public.system_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  family_id uuid,
  source text not null check (
    source in (
      'edge_function',
      'frontend',
      'ai_assist',
      'ai_action',
      'automation',
      'financial_engine',
      'auth',
      'system'
    )
  ),
  event_type text not null,
  severity text not null default 'info' check (
    severity in ('debug', 'info', 'warning', 'error', 'critical')
  ),
  status text not null default 'success' check (
    status in ('success', 'failed', 'blocked', 'skipped')
  ),
  function_name text,
  request_id text,
  correlation_id text,
  entity_type text,
  entity_id text,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.system_events enable row level security;

drop policy if exists "users can read own system events" on public.system_events;
create policy "users can read own system events"
on public.system_events
for select
to authenticated
using (auth.uid() = user_id);

create index if not exists idx_system_events_user_id
on public.system_events(user_id);

create index if not exists idx_system_events_created_at
on public.system_events(created_at);

create index if not exists idx_system_events_source
on public.system_events(source);

create index if not exists idx_system_events_severity
on public.system_events(severity);

create index if not exists idx_system_events_correlation_id
on public.system_events(correlation_id);

create table if not exists public.user_operation_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ai_actions_daily_limit integer not null default 30,
  automations_limit integer not null default 20,
  automation_runs_daily_limit integer not null default 100,
  diagnostics_exports_daily_limit integer not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

alter table public.user_operation_limits enable row level security;

drop policy if exists "users can read own operation limits" on public.user_operation_limits;
create policy "users can read own operation limits"
on public.user_operation_limits
for select
to authenticated
using (auth.uid() = user_id);

drop trigger if exists release6_operation_limits_updated_at on public.user_operation_limits;
create trigger release6_operation_limits_updated_at
before update on public.user_operation_limits
for each row execute function public.release1_set_updated_at();

alter table public.feature_flags
  add column if not exists metadata jsonb not null default '{}'::jsonb;

insert into public.feature_flags(key, description, enabled, rollout_percentage)
values
  ('ai_assist_enabled', 'Habilita o copiloto contextual somente leitura.', true, 100),
  ('ai_actions_enabled', 'Habilita acoes de IA confirmadas e reversiveis.', true, 100),
  ('automations_enabled', 'Habilita automacoes por template seguro.', true, 100),
  ('operational_panel_enabled', 'Habilita painel operacional interno.', true, 100),
  ('diagnostics_export_enabled', 'Habilita exportacao segura de diagnostico.', true, 100),
  ('product_ocr_enabled', 'Habilita OCR de produto.', true, 100),
  ('purchase_intelligence_enabled', 'Habilita inteligencia de compras.', true, 100)
on conflict (key) do update
set
  description = excluded.description,
  enabled = excluded.enabled,
  rollout_percentage = excluded.rollout_percentage,
  updated_at = now();

grant select on public.system_events to authenticated;
grant select on public.user_operation_limits to authenticated;
grant all on public.system_events, public.user_operation_limits to service_role;
grant select on public.feature_flags, public.user_flag_overrides to service_role;
