-- Release 4: confirmed, idempotent and reversible AI-assisted actions.
-- finance_states remains the single authoritative financial state.

create or replace function public.set_finance_state_audit_fields()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by, old.updated_by);
  return new;
end;
$$;

create table if not exists public.ai_action_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  action_type text not null,
  payload jsonb not null,
  preview jsonb not null,
  token_hash text not null unique,
  idempotency_key text not null,
  status text not null default 'pending' check (status in ('pending', 'executed', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  request_hash text not null,
  status text not null default 'processing' check (status in ('processing', 'succeeded', 'failed')),
  response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists public.ai_action_logs (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.ai_action_drafts(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  action_type text not null,
  entity_type text not null,
  entity_id text not null,
  state_fingerprint_before text not null,
  state_fingerprint_after text not null,
  result jsonb not null,
  rollback_payload jsonb not null,
  reverted_at timestamptz,
  revert_result jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_action_drafts_user_created_idx on public.ai_action_drafts(user_id, created_at desc);
create index if not exists ai_action_logs_user_created_idx on public.ai_action_logs(user_id, created_at desc);
create index if not exists ai_action_logs_family_created_idx on public.ai_action_logs(family_id, created_at desc);

drop trigger if exists release1_updated_at on public.ai_action_drafts;
create trigger release1_updated_at before update on public.ai_action_drafts
for each row execute function public.release1_set_updated_at();
drop trigger if exists release1_updated_at on public.idempotency_keys;
create trigger release1_updated_at before update on public.idempotency_keys
for each row execute function public.release1_set_updated_at();

alter table public.ai_action_drafts enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.ai_action_logs enable row level security;

create policy "users read own ai action drafts" on public.ai_action_drafts
for select to authenticated using (auth.uid() = user_id);
create policy "users read own idempotency keys" on public.idempotency_keys
for select to authenticated using (auth.uid() = user_id);
create policy "users read own ai action logs" on public.ai_action_logs
for select to authenticated using (auth.uid() = user_id);

revoke all on public.ai_action_drafts, public.idempotency_keys, public.ai_action_logs from anon, authenticated;
grant select (id, user_id, family_id, action_type, payload, preview, status, expires_at, executed_at, created_at, updated_at)
  on public.ai_action_drafts to authenticated;
grant select (id, draft_id, user_id, family_id, action_type, entity_type, entity_id, result, reverted_at, revert_result, created_at)
  on public.ai_action_logs to authenticated;
grant all on public.ai_action_drafts, public.idempotency_keys, public.ai_action_logs to service_role;

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

  select * into v_state from public.finance_states where family_id = v_draft.family_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'FINANCE_STATE_NOT_FOUND'); end if;
  if v_state.updated_at <> p_expected_updated_at then return jsonb_build_object('ok', false, 'code', 'STATE_CHANGED'); end if;

  update public.finance_states set data = p_next_state, updated_by = p_user_id where id = v_state.id;
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
  select * into v_state from public.finance_states where family_id = v_log.family_id for update;
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
    update public.finance_states set data = v_next_state, updated_by = p_user_id where id = v_state.id;
    update public.ai_action_logs set reverted_at = now(), revert_result = p_revert_result,
      state_fingerprint_after = p_fingerprint_after where id = v_log.id;
    v_response := jsonb_build_object('ok', true, 'log_id', v_log.id, 'result', p_revert_result);
    update public.idempotency_keys set status = 'succeeded', response = v_response
      where user_id = p_user_id and idempotency_key = p_idempotency_key;
    return v_response;
  end if;

  if v_state.updated_at <> p_expected_updated_at then return jsonb_build_object('ok', false, 'code', 'STATE_CHANGED'); end if;

  update public.finance_states set data = p_next_state, updated_by = p_user_id where id = v_state.id;
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
