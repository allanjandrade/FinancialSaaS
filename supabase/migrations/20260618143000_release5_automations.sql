-- Release 5: safe template-based automations.
-- Automations only evaluate deterministic templates and create in-app notifications.

create or replace function public.release5_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.automation_templates (
  id text primary key,
  name text not null,
  description text not null,
  category text not null check (category in ('cash', 'card', 'benefit', 'bill', 'category', 'wishlist')),
  parameter_schema jsonb not null default '{}'::jsonb,
  default_cooldown_hours integer not null default 24 check (default_cooldown_hours >= 1),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id text not null references public.automation_templates(id) on delete restrict,
  name text not null,
  parameters jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'paused', 'disabled')),
  timezone text not null default 'America/Sao_Paulo',
  cadence text not null default 'daily' check (cadence in ('hourly', 'daily')),
  cooldown_hours integer not null default 24 check (cooldown_hours >= 1),
  next_run_at timestamptz not null default now(),
  last_evaluated_at timestamptz,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.user_automations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id text not null,
  status text not null check (status in ('running', 'success', 'failed', 'skipped')),
  triggered boolean not null default false,
  dedupe_key text not null,
  result_payload jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (user_id, dedupe_key)
);

create table if not exists public.in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'automation' check (source in ('automation', 'system', 'ai_action')),
  source_id uuid,
  severity text not null default 'info' check (severity in ('info', 'attention', 'risk', 'critical')),
  title text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

drop trigger if exists release5_updated_at on public.automation_templates;
create trigger release5_updated_at before update on public.automation_templates
for each row execute function public.release5_set_updated_at();

drop trigger if exists release5_updated_at on public.user_automations;
create trigger release5_updated_at before update on public.user_automations
for each row execute function public.release5_set_updated_at();

alter table public.automation_templates enable row level security;
alter table public.user_automations enable row level security;
alter table public.automation_runs enable row level security;
alter table public.in_app_notifications enable row level security;

drop policy if exists "authenticated users can read automation templates" on public.automation_templates;
create policy "authenticated users can read automation templates"
on public.automation_templates
for select
to authenticated
using (enabled = true);

drop policy if exists "users can read own automations" on public.user_automations;
create policy "users can read own automations"
on public.user_automations
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users can insert own automations" on public.user_automations;
create policy "users can insert own automations"
on public.user_automations
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "users can update own automations" on public.user_automations;
create policy "users can update own automations"
on public.user_automations
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users can delete own automations" on public.user_automations;
create policy "users can delete own automations"
on public.user_automations
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users can read own automation runs" on public.automation_runs;
create policy "users can read own automation runs"
on public.automation_runs
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users can read own notifications" on public.in_app_notifications;
create policy "users can read own notifications"
on public.in_app_notifications
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users can update own notifications" on public.in_app_notifications;
create policy "users can update own notifications"
on public.in_app_notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists idx_user_automations_user_id
on public.user_automations(user_id);

create index if not exists idx_user_automations_next_run
on public.user_automations(status, next_run_at);

create index if not exists idx_automation_runs_user_id
on public.automation_runs(user_id);

create index if not exists idx_automation_runs_automation_id
on public.automation_runs(automation_id);

create index if not exists idx_automation_runs_started_at
on public.automation_runs(started_at);

create index if not exists idx_in_app_notifications_user_id
on public.in_app_notifications(user_id);

create index if not exists idx_in_app_notifications_created_at
on public.in_app_notifications(created_at);

insert into public.automation_templates (
  id,
  name,
  description,
  category,
  parameter_schema,
  default_cooldown_hours,
  enabled
)
values
(
  'cash_balance_below',
  'Saldo baixo',
  'Avisa quando seu saldo disponivel seguro fica abaixo do limite configurado.',
  'cash',
  '{"type":"object","required":["threshold"],"properties":{"threshold":{"type":"number","minimum":0}}}'::jsonb,
  24,
  true
),
(
  'card_bill_ratio_above',
  'Fatura alta',
  'Avisa quando sua fatura ultrapassa uma porcentagem da renda mensal.',
  'card',
  '{"type":"object","required":["ratio"],"properties":{"ratio":{"type":"number","minimum":0.01,"maximum":1}}}'::jsonb,
  24,
  true
),
(
  'benefit_depletion_risk',
  'VA/VR em risco',
  'Avisa quando o beneficio pode acabar antes do fim do mes.',
  'benefit',
  '{"type":"object","required":["benefit_type"],"properties":{"benefit_type":{"type":"string","enum":["VA","VR"]}}}'::jsonb,
  24,
  true
),
(
  'bill_due_soon',
  'Conta vencendo',
  'Avisa quando uma conta esta proxima do vencimento.',
  'bill',
  '{"type":"object","required":["days_before"],"properties":{"days_before":{"type":"integer","minimum":1,"maximum":15}}}'::jsonb,
  24,
  true
),
(
  'category_anomaly_detected',
  'Categoria acima da media',
  'Avisa quando uma categoria foge da media historica.',
  'category',
  '{"type":"object","required":["severity"],"properties":{"severity":{"type":"string","enum":["attention","risk","critical"]}}}'::jsonb,
  24,
  true
),
(
  'wishlist_target_price_reached',
  'Preco alvo atingido',
  'Avisa quando um item da wishlist atinge o preco desejado.',
  'wishlist',
  '{"type":"object","required":["purchase_item_id"],"properties":{"purchase_item_id":{"type":"string"}}}'::jsonb,
  24,
  true
)
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  parameter_schema = excluded.parameter_schema,
  default_cooldown_hours = excluded.default_cooldown_hours,
  enabled = excluded.enabled,
  updated_at = now();

create or replace function public.claim_due_automations(p_limit integer default 25)
returns setof public.user_automations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with due as (
    select id
    from public.user_automations
    where status = 'active'
      and next_run_at <= now()
    order by next_run_at asc
    limit greatest(1, least(coalesce(p_limit, 25), 100))
    for update skip locked
  )
  update public.user_automations automation
  set next_run_at = now() + interval '5 minutes',
      updated_at = now()
  from due
  where automation.id = due.id
  returning automation.*;
end;
$$;

revoke all on public.automation_templates, public.user_automations, public.automation_runs, public.in_app_notifications from anon;
revoke all on public.automation_templates, public.user_automations, public.automation_runs, public.in_app_notifications from authenticated;
grant select on public.automation_templates to authenticated;
grant select, insert, update, delete on public.user_automations to authenticated;
grant select on public.automation_runs to authenticated;
grant select, update on public.in_app_notifications to authenticated;
grant all on public.automation_templates, public.user_automations, public.automation_runs, public.in_app_notifications to service_role;

revoke all on function public.claim_due_automations(integer) from public, anon, authenticated;
grant execute on function public.claim_due_automations(integer) to service_role;
