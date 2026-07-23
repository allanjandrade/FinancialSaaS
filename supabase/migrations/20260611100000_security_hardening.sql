-- Security hardening for family membership and shared finance state.

create or replace function public.user_can_edit_family(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.family_members
    where family_id = p_family_id
      and user_id = auth.uid()
      and role in ('admin', 'member')
      and access_role in ('administrator', 'member')
  );
$$;

revoke all on function public.user_can_edit_family(uuid) from public;
revoke all on function public.user_can_edit_family(uuid) from anon;
grant execute on function public.user_can_edit_family(uuid) to authenticated;

create or replace function public.create_family_with_admin(
  p_name text,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_family public.families%rowtype;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Nome da família é obrigatório';
  end if;

  insert into public.families (name)
  values (trim(p_name))
  returning * into v_family;

  insert into public.family_members (
    family_id,
    user_id,
    role,
    access_role,
    display_name,
    email
  )
  values (
    v_family.id,
    v_user_id,
    'admin',
    'administrator',
    coalesce(nullif(trim(p_display_name), ''), split_part(coalesce(v_email, 'Administrador'), '@', 1)),
    v_email
  );

  return jsonb_build_object(
    'id', v_family.id,
    'name', v_family.name,
    'invite_code', v_family.invite_code,
    'created_at', v_family.created_at
  );
end;
$$;

revoke all on function public.create_family_with_admin(text, text) from public;
revoke all on function public.create_family_with_admin(text, text) from anon;
grant execute on function public.create_family_with_admin(text, text) to authenticated;

create or replace function public.update_my_family_profile(
  p_family_id uuid,
  p_display_name text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  update public.family_members
  set display_name = coalesce(nullif(trim(p_display_name), ''), display_name)
  where family_id = p_family_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Vínculo familiar não encontrado';
  end if;
end;
$$;

revoke all on function public.update_my_family_profile(uuid, text) from public;
revoke all on function public.update_my_family_profile(uuid, text) from anon;
grant execute on function public.update_my_family_profile(uuid, text) to authenticated;

-- Family creation and membership creation now happen atomically through the RPC.
drop policy if exists "families_insert_authenticated" on public.families;
drop policy if exists "family_members_insert_self" on public.family_members;
drop policy if exists "Users can insert their own family membership" on public.family_members;

-- A member may not alter their own role. Role changes are admin-only.
drop policy if exists "family_members_update_self_or_admin" on public.family_members;
drop policy if exists "family_members_update_admin" on public.family_members;
drop policy if exists "Users can update their own family membership" on public.family_members;
drop policy if exists "Users can delete their own family membership" on public.family_members;
create policy "family_members_update_admin"
on public.family_members
for update
to authenticated
using (public.user_is_family_admin(family_id))
with check (public.user_is_family_admin(family_id));

-- Viewers remain read-only. Editors can insert/update, but nobody deletes the shared state.
drop policy if exists "finance_states_upsert_member" on public.finance_states;
drop policy if exists "finance_states_insert_editor" on public.finance_states;
drop policy if exists "finance_states_update_editor" on public.finance_states;
create policy "finance_states_insert_editor"
on public.finance_states
for insert
to authenticated
with check (public.user_can_edit_family(family_id));

create policy "finance_states_update_editor"
on public.finance_states
for update
to authenticated
using (public.user_can_edit_family(family_id))
with check (public.user_can_edit_family(family_id));

alter table public.finance_states
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

create or replace function public.set_finance_state_audit_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists set_finance_state_audit_fields on public.finance_states;
create trigger set_finance_state_audit_fields
before insert or update on public.finance_states
for each row execute function public.set_finance_state_audit_fields();

-- Receipt access remains family-scoped and ownership-scoped.
drop policy if exists "Enable authenticated access" on public.receipts;
drop policy if exists "receipts_select_family" on public.receipts;
create policy "receipts_select_family"
on public.receipts for select to authenticated
using (family_id in (select public.user_family_ids()));

drop policy if exists "receipts_insert_own" on public.receipts;
create policy "receipts_insert_own"
on public.receipts for insert to authenticated
with check (
  user_id = auth.uid()
  and family_id in (select public.user_family_ids())
);

drop policy if exists "receipts_update_own" on public.receipts;
create policy "receipts_update_own"
on public.receipts for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "receipts_delete_own" on public.receipts;
create policy "receipts_delete_own"
on public.receipts for delete to authenticated
using (user_id = auth.uid());
