-- Hotfix P0: user isolation for finance_states and JSON-backed wishlist data.

alter table public.finance_states
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

update public.finance_states fs
set user_id = coalesce(
  fs.user_id,
  fs.updated_by,
  (
    select fm.user_id
    from public.family_members fm
    where fm.family_id = fs.family_id
    order by
      case when fm.access_role = 'administrator' or fm.role = 'admin' then 0 else 1 end,
      fm.joined_at asc
    limit 1
  )
)
where fs.user_id is null;

delete from public.finance_states
where user_id is null;

with ranked as (
  select id,
    row_number() over (partition by user_id order by updated_at desc nulls last, id desc) as row_number
  from public.finance_states
)
delete from public.finance_states fs
using ranked
where ranked.id = fs.id
  and ranked.row_number > 1;

alter table public.finance_states
  alter column user_id set not null;

alter table public.finance_states
  drop constraint if exists finance_states_family_id_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.finance_states'::regclass
      and conname = 'finance_states_user_id_key'
  ) then
    alter table public.finance_states
      add constraint finance_states_user_id_key unique (user_id);
  end if;
end;
$$;

create index if not exists finance_states_user_updated_idx
  on public.finance_states(user_id, updated_at desc);

alter table public.finance_states enable row level security;
alter table public.finance_states force row level security;

drop policy if exists "Enable authenticated access" on public.finance_states;
drop policy if exists "finance_states_select_member" on public.finance_states;
drop policy if exists "finance_states_upsert_member" on public.finance_states;
drop policy if exists "finance_states_insert_editor" on public.finance_states;
drop policy if exists "finance_states_update_editor" on public.finance_states;
drop policy if exists "finance states select own" on public.finance_states;
drop policy if exists "finance states insert own" on public.finance_states;
drop policy if exists "finance states update own" on public.finance_states;
drop policy if exists "finance states delete own" on public.finance_states;

revoke all on public.finance_states from anon;
revoke all on public.finance_states from authenticated;
grant select, insert, update, delete on public.finance_states to authenticated;
grant select, insert, update, delete on public.finance_states to service_role;

create policy "finance states select own"
on public.finance_states
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "finance states insert own"
on public.finance_states
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "finance states update own"
on public.finance_states
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "finance states delete own"
on public.finance_states
for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.set_finance_state_audit_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and new.user_id is null then
    new.user_id := auth.uid();
  end if;

  if auth.uid() is not null and new.user_id <> auth.uid() then
    raise exception 'finance_states user_id must match authenticated user';
  end if;

  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.updated_by := coalesce(auth.uid(), new.updated_by, old.updated_by);
  else
    new.updated_by := coalesce(auth.uid(), new.updated_by);
  end if;
  return new;
end;
$$;

drop trigger if exists set_finance_state_audit_fields on public.finance_states;
create trigger set_finance_state_audit_fields
before insert or update on public.finance_states
for each row execute function public.set_finance_state_audit_fields();

create or replace function public.commit_ai_action(
  p_draft_id uuid, p_user_id uuid, p_token_hash text, p_idempotency_key text,
  p_request_hash text, p_expected_updated_at timestamptz, p_next_state jsonb,
  p_fingerprint_before text, p_fingerprint_after text, p_entity_type text,
  p_entity_id text, p_result jsonb, p_rollback_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_draft public.ai_action_drafts%rowtype;
  v_state public.finance_states%rowtype;
  v_existing public.idempotency_keys%rowtype;
  v_log_id uuid;
  v_response jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_idempotency_key, 0));
  select * into v_existing from public.idempotency_keys
    where user_id = p_user_id and idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.request_hash <> p_request_hash then
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT');
    end if;
    if v_existing.status = 'succeeded' then return v_existing.response; end if;
  else
    insert into public.idempotency_keys(user_id, idempotency_key, request_hash)
    values (p_user_id, p_idempotency_key, p_request_hash);
  end if;

  select * into v_draft from public.ai_action_drafts where id = p_draft_id for update;
  if not found or v_draft.user_id <> p_user_id or v_draft.token_hash <> p_token_hash then
    return jsonb_build_object('ok', false, 'code', 'INVALID_DRAFT');
  end if;
  if v_draft.status = 'executed' then return jsonb_build_object('ok', false, 'code', 'DRAFT_ALREADY_EXECUTED'); end if;
  if v_draft.status <> 'pending' then return jsonb_build_object('ok', false, 'code', 'DRAFT_NOT_PENDING'); end if;
  if v_draft.expires_at <= now() then
    update public.ai_action_drafts set status = 'expired' where id = v_draft.id;
    return jsonb_build_object('ok', false, 'code', 'DRAFT_EXPIRED');
  end if;

  select * into v_state
  from public.finance_states
  where family_id = v_draft.family_id
    and user_id = p_user_id
  for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'FINANCE_STATE_NOT_FOUND'); end if;
  if v_state.updated_at <> p_expected_updated_at then return jsonb_build_object('ok', false, 'code', 'STATE_CHANGED'); end if;

  update public.finance_states
  set data = p_next_state, updated_by = p_user_id
  where id = v_state.id
    and user_id = p_user_id;
  insert into public.ai_action_logs(
    draft_id, user_id, family_id, action_type, entity_type, entity_id,
    state_fingerprint_before, state_fingerprint_after, result, rollback_payload
  ) values (
    v_draft.id, p_user_id, v_draft.family_id, v_draft.action_type, p_entity_type, p_entity_id,
    p_fingerprint_before, p_fingerprint_after, p_result, p_rollback_payload
  ) returning id into v_log_id;
  update public.ai_action_drafts set status = 'executed', executed_at = now() where id = v_draft.id;
  v_response := jsonb_build_object('ok', true, 'log_id', v_log_id, 'draft_id', v_draft.id, 'result', p_result);
  update public.idempotency_keys set status = 'succeeded', response = v_response
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
  return v_response;
end;
$$;

create or replace function public.revert_ai_action(
  p_log_id uuid, p_user_id uuid, p_idempotency_key text, p_request_hash text,
  p_expected_updated_at timestamptz, p_next_state jsonb, p_fingerprint_after text,
  p_revert_result jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_log public.ai_action_logs%rowtype;
  v_state public.finance_states%rowtype;
  v_existing public.idempotency_keys%rowtype;
  v_response jsonb;
  v_rollback jsonb;
  v_created_entity jsonb;
  v_wishlist jsonb;
  v_wishlist_item jsonb;
  v_next_wishlist jsonb;
  v_next_state jsonb;
  v_entity_id text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_idempotency_key, 0));
  select * into v_existing from public.idempotency_keys
    where user_id = p_user_id and idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.request_hash <> p_request_hash then return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_CONFLICT'); end if;
    if v_existing.status = 'succeeded' then return v_existing.response; end if;
  else
    insert into public.idempotency_keys(user_id, idempotency_key, request_hash)
    values (p_user_id, p_idempotency_key, p_request_hash);
  end if;

  select * into v_log from public.ai_action_logs where id = p_log_id for update;
  if not found or v_log.user_id <> p_user_id then return jsonb_build_object('ok', false, 'code', 'ACTION_LOG_NOT_FOUND'); end if;
  if v_log.reverted_at is not null then return jsonb_build_object('ok', false, 'code', 'ACTION_ALREADY_REVERTED'); end if;
  select * into v_state
  from public.finance_states
  where family_id = v_log.family_id
    and user_id = p_user_id
  for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'FINANCE_STATE_NOT_FOUND'); end if;

  if v_log.action_type = 'add_to_wishlist' then
    v_rollback := v_log.rollback_payload;
    v_created_entity := coalesce(v_rollback->'entity', '{}'::jsonb);
    v_entity_id := coalesce(v_rollback->>'entityId', v_log.entity_id);
    v_wishlist := coalesce(v_state.data->'wishlist', '[]'::jsonb);
    if jsonb_typeof(v_wishlist) <> 'array' then return jsonb_build_object('ok', false, 'code', 'REVERT_CONFLICT'); end if;

    select item.value into v_wishlist_item
    from jsonb_array_elements(v_wishlist) as item(value)
    where item.value->>'id' = v_entity_id
    limit 1;
    if v_wishlist_item is null then return jsonb_build_object('ok', false, 'code', 'REVERT_CONFLICT'); end if;
    if v_wishlist_item ? 'aiActionMarker' and v_wishlist_item->>'aiActionMarker' <> v_rollback->>'marker' then
      return jsonb_build_object('ok', false, 'code', 'REVERT_CONFLICT');
    end if;
    if v_wishlist_item->>'status' = 'purchased' or v_wishlist_item->>'priceStatus' = 'purchased'
      or v_wishlist_item ? 'purchaseDate' or v_wishlist_item ? 'purchasedAt' or v_wishlist_item ? 'boughtAt' then
      return jsonb_build_object('ok', false, 'code', 'REVERT_CONFLICT');
    end if;
    if coalesce(nullif(v_wishlist_item->>'name', ''), '') <> coalesce(nullif(v_created_entity->>'name', ''), '')
      or coalesce(nullif(v_wishlist_item->>'value', ''), '') <> coalesce(nullif(v_created_entity->>'value', ''), '')
      or coalesce(nullif(v_wishlist_item->>'category', ''), '') <> coalesce(nullif(v_created_entity->>'category', ''), '')
      or coalesce(nullif(v_wishlist_item->>'priority', ''), '') <> coalesce(nullif(v_created_entity->>'priority', ''), '')
      or coalesce(nullif(v_wishlist_item->>'desiredDate', ''), '') <> coalesce(nullif(v_created_entity->>'desiredDate', ''), '')
      or coalesce(nullif(v_wishlist_item->>'notes', ''), '') <> coalesce(nullif(v_created_entity->>'notes', ''), '')
      or coalesce(nullif(v_wishlist_item->>'originalUrl', ''), '') <> coalesce(nullif(v_created_entity->>'originalUrl', ''), '')
      or coalesce(nullif(v_wishlist_item->>'originalLink', ''), '') <> coalesce(nullif(v_created_entity->>'originalLink', ''), '')
      or coalesce(nullif(v_wishlist_item->>'canonicalUrl', ''), '') <> coalesce(nullif(v_created_entity->>'canonicalUrl', ''), '')
      or coalesce(nullif(v_wishlist_item->>'targetPrice', ''), '') <> coalesce(nullif(v_created_entity->>'targetPrice', ''), '')
      or coalesce(nullif(v_wishlist_item->>'monitorPrice', ''), '') <> coalesce(nullif(v_created_entity->>'monitorPrice', ''), '')
      or coalesce(nullif(v_wishlist_item->>'priceStatus', ''), '') <> coalesce(nullif(v_created_entity->>'priceStatus', ''), '') then
      return jsonb_build_object('ok', false, 'code', 'REVERT_CONFLICT');
    end if;

    select coalesce(jsonb_agg(item.value order by item.ordinality), '[]'::jsonb) into v_next_wishlist
    from jsonb_array_elements(v_wishlist) with ordinality as item(value, ordinality)
    where item.value->>'id' <> v_entity_id;
    v_next_state := jsonb_set(v_state.data, '{wishlist}', v_next_wishlist, true);
    update public.finance_states
    set data = v_next_state, updated_by = p_user_id
    where id = v_state.id
      and user_id = p_user_id;
    update public.ai_action_logs set reverted_at = now(), revert_result = p_revert_result,
      state_fingerprint_after = p_fingerprint_after where id = v_log.id;
    v_response := jsonb_build_object('ok', true, 'log_id', v_log.id, 'result', p_revert_result);
    update public.idempotency_keys set status = 'succeeded', response = v_response
      where user_id = p_user_id and idempotency_key = p_idempotency_key;
    return v_response;
  end if;

  if v_state.updated_at <> p_expected_updated_at then return jsonb_build_object('ok', false, 'code', 'STATE_CHANGED'); end if;

  update public.finance_states
  set data = p_next_state, updated_by = p_user_id
  where id = v_state.id
    and user_id = p_user_id;
  update public.ai_action_logs set reverted_at = now(), revert_result = p_revert_result,
    state_fingerprint_after = p_fingerprint_after where id = v_log.id;
  v_response := jsonb_build_object('ok', true, 'log_id', v_log.id, 'result', p_revert_result);
  update public.idempotency_keys set status = 'succeeded', response = v_response
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
  return v_response;
end;
$$;

revoke all on function public.commit_ai_action(uuid,uuid,text,text,text,timestamptz,jsonb,text,text,text,text,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.revert_ai_action(uuid,uuid,text,text,timestamptz,jsonb,text,jsonb) from public, anon, authenticated;
grant execute on function public.commit_ai_action(uuid,uuid,text,text,text,timestamptz,jsonb,text,text,text,text,jsonb,jsonb) to service_role;
grant execute on function public.revert_ai_action(uuid,uuid,text,text,timestamptz,jsonb,text,jsonb) to service_role;

drop function if exists public.apply_wishlist_price_monitor_result(uuid, text, jsonb);
create or replace function public.apply_wishlist_price_monitor_result(
  p_family_id uuid,
  p_user_id uuid,
  p_item_id text,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_data jsonb;
  v_wishlist jsonb;
  v_item jsonb;
  v_history jsonb;
  v_alerts jsonb;
  v_alert jsonb := p_result -> 'alert';
  v_index integer;
begin
  select data
    into v_data
  from public.finance_states
  where family_id = p_family_id
    and user_id = p_user_id
  for update;

  if v_data is null then
    raise exception 'Estado financeiro nao encontrado';
  end if;

  v_wishlist := coalesce(v_data -> 'wishlist', '[]'::jsonb);
  select value, (ordinality - 1)::integer
    into v_item, v_index
  from jsonb_array_elements(v_wishlist) with ordinality
  where value ->> 'id' = p_item_id
  limit 1;

  if v_item is null then
    raise exception 'Item monitorado nao encontrado';
  end if;

  v_item := v_item || jsonb_build_object(
    'priceMonitorCheckedAt', coalesce(p_result ->> 'checkedAt', now()::text),
    'priceMonitorDiagnostics', coalesce(p_result -> 'diagnostics', '[]'::jsonb)
  );

  if p_result -> 'bestOffer' is not null then
    v_history := coalesce(v_item -> 'priceHistory', '[]'::jsonb)
      || jsonb_build_array(p_result -> 'historyEntry');

    select coalesce(jsonb_agg(value order by ordinality), '[]'::jsonb)
      into v_history
    from jsonb_array_elements(v_history) with ordinality
    where ordinality > greatest(jsonb_array_length(v_history) - 30, 0);

    v_item := v_item || jsonb_build_object(
      'value', (p_result #>> '{bestOffer,total}')::numeric,
      'lastQuotedPrice', (p_result #>> '{bestOffer,total}')::numeric,
      'marketplace', p_result #>> '{bestOffer,marketplace}',
      'marketplaceOffers', coalesce(p_result -> 'offers', '[]'::jsonb),
      'priceHistory', v_history,
      'priceMode', 'live',
      'priceStatus', 'quoted',
      'sourcesUsed', coalesce(p_result -> 'sourcesUsed', '[]'::jsonb),
      'priceFetchedAt', coalesce(p_result ->> 'checkedAt', now()::text)
    );
  end if;

  v_wishlist := jsonb_set(v_wishlist, array[v_index::text], v_item, false);
  v_data := jsonb_set(v_data, '{wishlist}', v_wishlist, true);

  if v_alert is not null and jsonb_typeof(v_alert) = 'object' then
    v_alerts := coalesce(v_data -> 'priceMonitorAlerts', '[]'::jsonb);
    if not exists (
      select 1
      from jsonb_array_elements(v_alerts) alert
      where alert ->> 'dedupeKey' = v_alert ->> 'dedupeKey'
    ) then
      v_alerts := jsonb_build_array(v_alert) || v_alerts;
      select coalesce(jsonb_agg(value order by ordinality), '[]'::jsonb)
        into v_alerts
      from jsonb_array_elements(v_alerts) with ordinality
      where ordinality <= 100;
      v_data := jsonb_set(v_data, '{priceMonitorAlerts}', v_alerts, true);
    end if;
  end if;

  update public.finance_states
  set data = v_data,
      updated_at = now(),
      updated_by = null
  where family_id = p_family_id
    and user_id = p_user_id;

  return jsonb_build_object(
    'familyId', p_family_id,
    'itemId', p_item_id,
    'status', p_result ->> 'status',
    'alertCreated', v_alert is not null
  );
end;
$$;

revoke all on function public.apply_wishlist_price_monitor_result(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_wishlist_price_monitor_result(uuid, uuid, text, jsonb) to service_role;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'ai_interactions',
    'ai_action_drafts',
    'ai_action_logs',
    'user_automations',
    'automation_runs',
    'in_app_notifications',
    'advisor_feedback',
    'advisor_snapshots',
    'price_search_cache',
    'billing_subscriptions',
    'billing_customers',
    'usage_metering',
    'user_feature_overrides',
    'beta_testers',
    'tester_feedback',
    'user_legal_acceptances'
  ] loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = target_table
        and column_name = 'user_id'
    ) then
      execute format('alter table public.%I enable row level security', target_table);
      execute format('alter table public.%I force row level security', target_table);
    end if;
  end loop;
end;
$$;
