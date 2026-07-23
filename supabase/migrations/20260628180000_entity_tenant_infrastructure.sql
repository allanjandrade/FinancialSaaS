create table if not exists public.financial_entities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint financial_entities_name_check check (char_length(trim(name)) between 2 and 160),
  constraint financial_entities_status_check check (status in ('active', 'suspended', 'archived'))
);

create table if not exists public.financial_entity_memberships (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.financial_entities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_entity_memberships_role_check
    check (role in ('admin', 'financeiro_senior', 'controller', 'operador', 'leitura', 'auditor')),
  constraint financial_entity_memberships_status_check
    check (status in ('active', 'invited', 'suspended', 'removed')),
  unique (entity_id, user_id)
);

create table if not exists public.financial_audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.financial_entities(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  before_state jsonb,
  after_state jsonb,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint financial_audit_logs_event_type_check
    check (event_type in ('crud', 'balance_change', 'sync_error'))
);

create index if not exists financial_entities_owner_idx
  on public.financial_entities(owner_user_id)
  where deleted_at is null;

create index if not exists financial_entity_memberships_user_idx
  on public.financial_entity_memberships(user_id, status);

create index if not exists financial_entity_memberships_entity_role_idx
  on public.financial_entity_memberships(entity_id, role, status);

create index if not exists financial_audit_logs_entity_created_idx
  on public.financial_audit_logs(entity_id, created_at desc);

create index if not exists financial_audit_logs_event_type_idx
  on public.financial_audit_logs(event_type, created_at desc);

create or replace function public.touch_financial_entity_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_financial_entities_updated_at on public.financial_entities;
create trigger touch_financial_entities_updated_at
before update on public.financial_entities
for each row execute function public.touch_financial_entity_updated_at();

drop trigger if exists touch_financial_entity_memberships_updated_at on public.financial_entity_memberships;
create trigger touch_financial_entity_memberships_updated_at
before update on public.financial_entity_memberships
for each row execute function public.touch_financial_entity_updated_at();

create or replace function public.financial_entity_role(target_entity_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select fem.role
  from public.financial_entity_memberships fem
  join public.financial_entities fe on fe.id = fem.entity_id
  where fem.entity_id = target_entity_id
    and fem.user_id = auth.uid()
    and fem.status = 'active'
    and fe.status = 'active'
    and fe.deleted_at is null
  limit 1;
$$;

create or replace function public.is_entity_member(target_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.financial_entity_role(target_entity_id) is not null;
$$;

create or replace function public.can_admin_entity(target_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.financial_entity_role(target_entity_id) = 'admin';
$$;

create or replace function public.can_read_entity_finance(target_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.financial_entity_role(target_entity_id)
    in ('admin', 'financeiro_senior', 'controller', 'operador', 'leitura', 'auditor');
$$;

create or replace function public.can_write_entity_finance(target_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.financial_entity_role(target_entity_id)
    in ('admin', 'financeiro_senior', 'controller', 'operador');
$$;

revoke all on function public.financial_entity_role(uuid) from public;
revoke all on function public.is_entity_member(uuid) from public;
revoke all on function public.can_admin_entity(uuid) from public;
revoke all on function public.can_read_entity_finance(uuid) from public;
revoke all on function public.can_write_entity_finance(uuid) from public;
grant execute on function public.financial_entity_role(uuid) to authenticated, service_role;
grant execute on function public.is_entity_member(uuid) to authenticated, service_role;
grant execute on function public.can_admin_entity(uuid) to authenticated, service_role;
grant execute on function public.can_read_entity_finance(uuid) to authenticated, service_role;
grant execute on function public.can_write_entity_finance(uuid) to authenticated, service_role;

create or replace function public.create_financial_entity_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.financial_entity_memberships(entity_id, user_id, role, status)
  values (new.id, new.owner_user_id, 'admin', 'active')
  on conflict (entity_id, user_id) do update
    set role = 'admin',
        status = 'active',
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists create_financial_entity_owner_membership on public.financial_entities;
create trigger create_financial_entity_owner_membership
after insert on public.financial_entities
for each row execute function public.create_financial_entity_owner_membership();

alter table public.finance_states
  add column if not exists entity_id uuid;

insert into public.financial_entities(id, name, owner_user_id, metadata)
select distinct on (fs.family_id)
  fs.family_id,
  coalesce(f.name, 'Financeiro'),
  fs.user_id,
  jsonb_build_object('source', 'finance_states_family_id')
from public.finance_states fs
left join public.families f on f.id = fs.family_id
where fs.family_id is not null
  and fs.user_id is not null
on conflict (id) do nothing;

update public.finance_states
set entity_id = family_id
where entity_id is null
  and family_id is not null;

do $$
declare
  v_state record;
  v_entity_id uuid;
begin
  for v_state in
    select id, user_id
    from public.finance_states
    where entity_id is null
  loop
    v_entity_id := gen_random_uuid();
    insert into public.financial_entities(id, name, owner_user_id, metadata)
    values (v_entity_id, 'Financeiro', v_state.user_id, jsonb_build_object('source', 'finance_states_backfill'))
    on conflict (id) do nothing;

    update public.finance_states
    set entity_id = v_entity_id
    where id = v_state.id;
  end loop;
end;
$$;

insert into public.financial_entity_memberships(entity_id, user_id, role, status)
select distinct entity_id, user_id, 'admin', 'active'
from public.finance_states
where entity_id is not null
  and user_id is not null
on conflict (entity_id, user_id) do nothing;

alter table public.finance_states
  alter column entity_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.finance_states'::regclass
      and conname = 'finance_states_entity_id_fkey'
  ) then
    alter table public.finance_states
      add constraint finance_states_entity_id_fkey
      foreign key (entity_id) references public.financial_entities(id) on delete restrict;
  end if;
end;
$$;

create index if not exists finance_states_entity_user_idx
  on public.finance_states(entity_id, user_id);

alter table public.financial_entities enable row level security;
alter table public.financial_entities force row level security;
alter table public.financial_entity_memberships enable row level security;
alter table public.financial_entity_memberships force row level security;
alter table public.financial_audit_logs enable row level security;
alter table public.financial_audit_logs force row level security;
alter table public.finance_states enable row level security;
alter table public.finance_states force row level security;

revoke all on public.financial_entities from anon;
revoke all on public.financial_entity_memberships from anon;
revoke all on public.financial_audit_logs from anon;
grant select, insert, update, delete on public.financial_entities to authenticated, service_role;
grant select, insert, update, delete on public.financial_entity_memberships to authenticated, service_role;
grant select, insert on public.financial_audit_logs to authenticated, service_role;

drop policy if exists "financial_entities_select_members" on public.financial_entities;
create policy "financial_entities_select_members"
on public.financial_entities for select
to authenticated
using (deleted_at is null and public.is_entity_member(id));

drop policy if exists "financial_entities_insert_owner" on public.financial_entities;
create policy "financial_entities_insert_owner"
on public.financial_entities for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists "financial_entities_update_admins" on public.financial_entities;
create policy "financial_entities_update_admins"
on public.financial_entities for update
to authenticated
using (public.can_admin_entity(id))
with check (public.can_admin_entity(id));

drop policy if exists "financial_entities_delete_admins" on public.financial_entities;
create policy "financial_entities_delete_admins"
on public.financial_entities for delete
to authenticated
using (public.can_admin_entity(id));

drop policy if exists "financial_entity_memberships_select_members" on public.financial_entity_memberships;
create policy "financial_entity_memberships_select_members"
on public.financial_entity_memberships for select
to authenticated
using (user_id = auth.uid() or public.is_entity_member(entity_id));

drop policy if exists "financial_entity_memberships_insert_admins" on public.financial_entity_memberships;
create policy "financial_entity_memberships_insert_admins"
on public.financial_entity_memberships for insert
to authenticated
with check (public.can_admin_entity(entity_id));

drop policy if exists "financial_entity_memberships_update_admins" on public.financial_entity_memberships;
create policy "financial_entity_memberships_update_admins"
on public.financial_entity_memberships for update
to authenticated
using (public.can_admin_entity(entity_id))
with check (public.can_admin_entity(entity_id));

drop policy if exists "financial_entity_memberships_delete_admins" on public.financial_entity_memberships;
create policy "financial_entity_memberships_delete_admins"
on public.financial_entity_memberships for delete
to authenticated
using (public.can_admin_entity(entity_id) and user_id <> auth.uid());

drop policy if exists "finance states select own" on public.finance_states;
drop policy if exists "finance states insert own" on public.finance_states;
drop policy if exists "finance states update own" on public.finance_states;
drop policy if exists "finance states delete own" on public.finance_states;

create policy "finance states select own"
on public.finance_states
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and public.can_read_entity_finance(entity_id)
);

create policy "finance states insert own"
on public.finance_states
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and public.can_write_entity_finance(entity_id)
);

create policy "finance states update own"
on public.finance_states
for update
to authenticated
using (
  (select auth.uid()) = user_id
  and public.can_write_entity_finance(entity_id)
)
with check (
  (select auth.uid()) = user_id
  and public.can_write_entity_finance(entity_id)
);

create policy "finance states delete own"
on public.finance_states
for delete
to authenticated
using (
  (select auth.uid()) = user_id
  and public.can_write_entity_finance(entity_id)
);

drop policy if exists "financial_audit_logs_select_members" on public.financial_audit_logs;
create policy "financial_audit_logs_select_members"
on public.financial_audit_logs for select
to authenticated
using (public.is_entity_member(entity_id));

drop policy if exists "financial_audit_logs_insert_members" on public.financial_audit_logs;
create policy "financial_audit_logs_insert_members"
on public.financial_audit_logs for insert
to authenticated
with check (
  actor_user_id = auth.uid()
  and public.is_entity_member(entity_id)
);

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

  if new.entity_id is null and auth.uid() is not null then
    select fem.entity_id
      into new.entity_id
    from public.financial_entity_memberships fem
    where fem.user_id = auth.uid()
      and fem.status = 'active'
    order by
      case fem.role
        when 'admin' then 0
        when 'financeiro_senior' then 1
        when 'controller' then 2
        when 'operador' then 3
        else 4
      end,
      fem.created_at asc
    limit 1;
  end if;

  if new.entity_id is null then
    raise exception 'finance_states entity_id is required';
  end if;

  if auth.uid() is not null and not public.is_entity_member(new.entity_id) then
    raise exception 'authenticated user is not a member of entity';
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

create or replace function public.audit_finance_state_entity_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entity_id uuid;
  v_actor_user_id uuid;
  v_resource_id uuid;
  v_before jsonb;
  v_after jsonb;
begin
  if tg_op = 'INSERT' then
    v_entity_id := new.entity_id;
    v_actor_user_id := coalesce(auth.uid(), new.updated_by, new.user_id);
    v_resource_id := new.id;
    v_before := null;
    v_after := jsonb_build_object(
      'updated_at', new.updated_at,
      'data_hash', md5(coalesce(new.data, '{}'::jsonb)::text)
    );
  elsif tg_op = 'UPDATE' then
    v_entity_id := new.entity_id;
    v_actor_user_id := coalesce(auth.uid(), new.updated_by, old.updated_by, new.user_id);
    v_resource_id := new.id;
    v_before := jsonb_build_object(
      'updated_at', old.updated_at,
      'data_hash', md5(coalesce(old.data, '{}'::jsonb)::text)
    );
    v_after := jsonb_build_object(
      'updated_at', new.updated_at,
      'data_hash', md5(coalesce(new.data, '{}'::jsonb)::text)
    );
  else
    v_entity_id := old.entity_id;
    v_actor_user_id := coalesce(auth.uid(), old.updated_by, old.user_id);
    v_resource_id := old.id;
    v_before := jsonb_build_object(
      'updated_at', old.updated_at,
      'data_hash', md5(coalesce(old.data, '{}'::jsonb)::text)
    );
    v_after := null;
  end if;

  insert into public.financial_audit_logs(
    entity_id,
    actor_user_id,
    event_type,
    action,
    resource_type,
    resource_id,
    before_state,
    after_state,
    metadata
  ) values (
    v_entity_id,
    v_actor_user_id,
    'crud',
    lower(tg_op),
    'finance_states',
    v_resource_id,
    v_before,
    v_after,
    jsonb_build_object('source', 'finance_states_trigger')
  );

  if tg_op = 'UPDATE' and old.data is distinct from new.data then
    insert into public.financial_audit_logs(
      entity_id,
      actor_user_id,
      event_type,
      action,
      resource_type,
      resource_id,
      before_state,
      after_state,
      metadata
    ) values (
      v_entity_id,
      v_actor_user_id,
      'balance_change',
      'finance_state_data_changed',
      'finance_states',
      v_resource_id,
      v_before,
      v_after,
      jsonb_build_object('source', 'finance_states_trigger')
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists audit_finance_state_entity_change on public.finance_states;
create trigger audit_finance_state_entity_change
after insert or update or delete on public.finance_states
for each row execute function public.audit_finance_state_entity_change();

create or replace function public.log_financial_sync_error(
  p_entity_id uuid,
  p_resource_type text default 'sync',
  p_resource_id uuid default null,
  p_error_code text default null,
  p_error_message text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_log_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_entity_member(p_entity_id) then
    raise exception 'authenticated user is not a member of entity';
  end if;

  insert into public.financial_audit_logs(
    entity_id,
    actor_user_id,
    event_type,
    action,
    resource_type,
    resource_id,
    error_code,
    error_message,
    metadata
  ) values (
    p_entity_id,
    auth.uid(),
    'sync_error',
    'sync_error',
    coalesce(nullif(trim(p_resource_type), ''), 'sync'),
    p_resource_id,
    p_error_code,
    p_error_message,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;

revoke all on function public.log_financial_sync_error(uuid, text, uuid, text, text, jsonb) from public;
grant execute on function public.log_financial_sync_error(uuid, text, uuid, text, text, jsonb) to authenticated, service_role;
