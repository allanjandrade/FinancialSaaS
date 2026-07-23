-- Release 4 hotfix: make wishlist reversions target the created item instead of
-- rejecting on unrelated finance_states updated_at changes.

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

revoke all on function public.revert_ai_action(uuid,uuid,text,text,timestamptz,jsonb,text,jsonb) from public, anon, authenticated;
grant execute on function public.revert_ai_action(uuid,uuid,text,text,timestamptz,jsonb,text,jsonb) to service_role;
