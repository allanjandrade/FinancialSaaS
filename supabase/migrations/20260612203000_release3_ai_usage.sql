-- Release 3: backend-controlled AI quota. Existing finance_states remains authoritative.

create table if not exists public.user_ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  month_key text not null,
  request_count integer not null default 0 check (request_count >= 0),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  estimated_cost numeric(12,6) not null default 0 check (estimated_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, usage_date)
);

create index if not exists user_ai_usage_user_month_idx
  on public.user_ai_usage(user_id, month_key);

drop trigger if exists release1_updated_at on public.user_ai_usage;
create trigger release1_updated_at
before update on public.user_ai_usage
for each row execute function public.release1_set_updated_at();

alter table public.user_ai_usage enable row level security;

drop policy if exists "users can read own ai usage" on public.user_ai_usage;
create policy "users can read own ai usage"
on public.user_ai_usage for select to authenticated
using (auth.uid() = user_id);

revoke all on public.user_ai_usage from anon, authenticated;
grant select on public.user_ai_usage to authenticated;

create or replace function public.reserve_ai_usage(
  p_user_id uuid,
  p_daily_limit integer,
  p_monthly_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := current_date;
  v_month text := to_char(current_date, 'YYYY-MM');
  v_daily integer := 0;
  v_monthly integer := 0;
begin
  if p_user_id is null or p_daily_limit < 1 or p_monthly_limit < 1 then
    raise exception 'INVALID_AI_QUOTA_CONFIGURATION';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || v_month, 0));

  insert into public.user_ai_usage(user_id, usage_date, month_key)
  values (p_user_id, v_today, v_month)
  on conflict (user_id, usage_date) do nothing;

  select request_count into v_daily
  from public.user_ai_usage
  where user_id = p_user_id and usage_date = v_today
  for update;

  select coalesce(sum(request_count), 0)::integer into v_monthly
  from public.user_ai_usage
  where user_id = p_user_id and month_key = v_month;

  if v_daily >= p_daily_limit then
    return jsonb_build_object('allowed', false, 'code', 'AI_DAILY_LIMIT_REACHED', 'daily', v_daily, 'monthly', v_monthly);
  end if;

  if v_monthly >= p_monthly_limit then
    return jsonb_build_object('allowed', false, 'code', 'AI_MONTHLY_LIMIT_REACHED', 'daily', v_daily, 'monthly', v_monthly);
  end if;

  update public.user_ai_usage
  set request_count = request_count + 1
  where user_id = p_user_id and usage_date = v_today;

  return jsonb_build_object('allowed', true, 'usage_date', v_today, 'daily', v_daily + 1, 'monthly', v_monthly + 1);
end;
$$;

create or replace function public.finalize_ai_usage(
  p_user_id uuid,
  p_usage_date date,
  p_input_tokens integer,
  p_output_tokens integer,
  p_estimated_cost numeric default 0
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.user_ai_usage
  set
    input_tokens = input_tokens + greatest(coalesce(p_input_tokens, 0), 0),
    output_tokens = output_tokens + greatest(coalesce(p_output_tokens, 0), 0),
    estimated_cost = estimated_cost + greatest(coalesce(p_estimated_cost, 0), 0)
  where user_id = p_user_id and usage_date = p_usage_date;
$$;

revoke all on function public.reserve_ai_usage(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.finalize_ai_usage(uuid, date, integer, integer, numeric) from public, anon, authenticated;
grant execute on function public.reserve_ai_usage(uuid, integer, integer) to service_role;
grant execute on function public.finalize_ai_usage(uuid, date, integer, integer, numeric) to service_role;
