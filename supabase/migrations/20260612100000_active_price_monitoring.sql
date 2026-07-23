create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.apply_wishlist_price_monitor_result(
  p_family_id uuid,
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
  where family_id = p_family_id;

  return jsonb_build_object(
    'familyId', p_family_id,
    'itemId', p_item_id,
    'status', p_result ->> 'status',
    'alertCreated', v_alert is not null
  );
end;
$$;

revoke all on function public.apply_wishlist_price_monitor_result(uuid, text, jsonb) from public;
revoke all on function public.apply_wishlist_price_monitor_result(uuid, text, jsonb) from anon;
revoke all on function public.apply_wishlist_price_monitor_result(uuid, text, jsonb) from authenticated;
grant execute on function public.apply_wishlist_price_monitor_result(uuid, text, jsonb) to service_role;

create or replace function public.configure_price_monitor_schedule(
  p_project_url text,
  p_service_role_key text,
  p_schedule text default '15 12 * * *'
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault, cron, net, extensions, pg_temp
as $$
declare
  v_url_secret_id uuid;
  v_key_secret_id uuid;
  v_job_id bigint;
  v_request_id bigint;
  v_existing_job record;
  v_command text;
begin
  if nullif(trim(p_project_url), '') is null or nullif(trim(p_service_role_key), '') is null then
    raise exception 'URL e chave administrativa sao obrigatorias';
  end if;

  select id into v_url_secret_id from vault.secrets where name = 'price_monitor_project_url' limit 1;
  if v_url_secret_id is null then
    v_url_secret_id := vault.create_secret(trim(trailing '/' from p_project_url), 'price_monitor_project_url', 'URL usada pelo cron de precos');
  else
    perform vault.update_secret(v_url_secret_id, trim(trailing '/' from p_project_url), 'price_monitor_project_url', 'URL usada pelo cron de precos');
  end if;

  select id into v_key_secret_id from vault.secrets where name = 'price_monitor_service_role_key' limit 1;
  if v_key_secret_id is null then
    v_key_secret_id := vault.create_secret(p_service_role_key, 'price_monitor_service_role_key', 'Credencial do cron de precos');
  else
    perform vault.update_secret(v_key_secret_id, p_service_role_key, 'price_monitor_service_role_key', 'Credencial do cron de precos');
  end if;

  for v_existing_job in select jobid from cron.job where jobname = 'active-price-monitor-daily' loop
    perform cron.unschedule(v_existing_job.jobid);
  end loop;

  v_command := $cron_command$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'price_monitor_project_url' limit 1) || '/functions/v1/price-monitor-run',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'price_monitor_service_role_key' limit 1)
      ),
      body := '{"action":"run","limit":12}'::jsonb,
      timeout_milliseconds := 120000
    ) as request_id;
  $cron_command$;

  v_job_id := cron.schedule('active-price-monitor-daily', p_schedule, v_command);

  select net.http_post(
    url := trim(trailing '/' from p_project_url) || '/functions/v1/price-monitor-run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || p_service_role_key
    ),
    body := '{"action":"run","limit":12}'::jsonb,
    timeout_milliseconds := 120000
  ) into v_request_id;

  return jsonb_build_object(
    'jobId', v_job_id,
    'jobName', 'active-price-monitor-daily',
    'schedule', p_schedule,
    'timeZone', 'UTC',
    'nextRunDescription', 'Diariamente as 09:15 America/Sao_Paulo',
    'initialRequestId', v_request_id
  );
end;
$$;

revoke all on function public.configure_price_monitor_schedule(text, text, text) from public;
revoke all on function public.configure_price_monitor_schedule(text, text, text) from anon;
revoke all on function public.configure_price_monitor_schedule(text, text, text) from authenticated;
grant execute on function public.configure_price_monitor_schedule(text, text, text) to service_role;

update public.finance_states state
set data = jsonb_set(
  jsonb_set(state.data, '{priceMonitorAlerts}', coalesce(state.data -> 'priceMonitorAlerts', '[]'::jsonb), true),
  '{wishlist}',
  coalesce((
    select jsonb_agg(item || jsonb_build_object('monitorPrice', true) order by ordinality)
    from jsonb_array_elements(coalesce(state.data -> 'wishlist', '[]'::jsonb)) with ordinality as rows(item, ordinality)
  ), '[]'::jsonb),
  true
)
where jsonb_typeof(coalesce(state.data -> 'wishlist', '[]'::jsonb)) = 'array';
