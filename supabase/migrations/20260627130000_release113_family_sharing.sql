create table if not exists public.family_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint family_groups_name_check check (char_length(trim(name)) between 2 and 120)
);

create table if not exists public.family_memberships (
  id uuid primary key default gen_random_uuid(),
  family_group_id uuid not null references public.family_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_memberships_role_check check (role in ('owner', 'admin', 'member', 'read_only')),
  constraint family_memberships_status_check check (status in ('active', 'removed', 'pending')),
  unique (family_group_id, user_id)
);

alter table public.family_invites
  add column if not exists family_group_id uuid references public.family_groups(id) on delete cascade,
  add column if not exists invited_email text,
  add column if not exists role text not null default 'member',
  add column if not exists token_hash text unique,
  add column if not exists message text,
  add column if not exists declined_at timestamptz;

alter table public.family_invites
  alter column family_id drop not null,
  alter column token drop not null,
  alter column token drop default;

alter table public.family_invites
  drop constraint if exists family_invites_status_check;

alter table public.family_invites
  add constraint family_invites_status_check
  check (status in ('Pendente', 'Aceito', 'Recusado', 'Expirado', 'pending', 'accepted', 'declined', 'expired'));

alter table public.family_invites
  drop constraint if exists family_invites_role_check;

alter table public.family_invites
  add constraint family_invites_role_check
  check (role in ('owner', 'admin', 'member', 'read_only'));

create table if not exists public.shared_entries (
  id uuid primary key default gen_random_uuid(),
  family_group_id uuid not null references public.family_groups(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  paid_by_user_id uuid references auth.users(id) on delete set null,
  type text not null default 'expense',
  description text not null,
  amount numeric(14,2) not null,
  category text,
  entry_date date not null default current_date,
  split_method text not null default 'equal',
  notes text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint shared_entries_amount_check check (amount >= 0),
  constraint shared_entries_type_check check (type in ('expense', 'income', 'note')),
  constraint shared_entries_split_method_check check (split_method in ('equal', 'paid_by_me', 'paid_by_other', 'visible_only', 'percent', 'fixed')),
  constraint shared_entries_source_check check (source in ('manual', 'invite', 'import'))
);

create table if not exists public.shared_entry_participants (
  id uuid primary key default gen_random_uuid(),
  shared_entry_id uuid not null references public.shared_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  allocation_type text not null default 'equal',
  allocation_value numeric(14,2),
  calculated_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint shared_entry_participants_allocation_type_check
    check (allocation_type in ('equal', 'percent', 'fixed', 'visible_only')),
  unique (shared_entry_id, user_id)
);

create index if not exists family_groups_owner_idx
  on public.family_groups(owner_user_id)
  where deleted_at is null;

create index if not exists family_memberships_user_status_idx
  on public.family_memberships(user_id, status);

create index if not exists family_memberships_group_status_idx
  on public.family_memberships(family_group_id, status);

create index if not exists family_invites_family_group_idx
  on public.family_invites(family_group_id)
  where family_group_id is not null;

create index if not exists family_invites_token_hash_idx
  on public.family_invites(token_hash)
  where token_hash is not null;

create index if not exists family_invites_invited_email_idx
  on public.family_invites(lower(coalesce(invited_email, email)))
  where coalesce(invited_email, email) is not null;

create index if not exists shared_entries_family_date_idx
  on public.shared_entries(family_group_id, entry_date desc)
  where deleted_at is null;

create index if not exists shared_entry_participants_user_idx
  on public.shared_entry_participants(user_id);

create or replace function public.touch_family_sharing_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_family_groups_updated_at on public.family_groups;
create trigger touch_family_groups_updated_at
before update on public.family_groups
for each row execute function public.touch_family_sharing_updated_at();

drop trigger if exists touch_family_memberships_updated_at on public.family_memberships;
create trigger touch_family_memberships_updated_at
before update on public.family_memberships
for each row execute function public.touch_family_sharing_updated_at();

drop trigger if exists touch_shared_entries_updated_at on public.shared_entries;
create trigger touch_shared_entries_updated_at
before update on public.shared_entries
for each row execute function public.touch_family_sharing_updated_at();

create or replace function public.is_family_member(target_family_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.family_memberships fm
    where fm.family_group_id = target_family_group_id
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  );
$$;

create or replace function public.family_member_role(target_family_group_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select fm.role
  from public.family_memberships fm
  where fm.family_group_id = target_family_group_id
    and fm.user_id = auth.uid()
    and fm.status = 'active'
  limit 1;
$$;

create or replace function public.can_manage_family(target_family_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.family_member_role(target_family_group_id) in ('owner', 'admin');
$$;

create or replace function public.can_write_shared_entry(target_family_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.family_member_role(target_family_group_id) in ('owner', 'admin', 'member');
$$;

revoke all on function public.is_family_member(uuid) from public;
revoke all on function public.family_member_role(uuid) from public;
revoke all on function public.can_manage_family(uuid) from public;
revoke all on function public.can_write_shared_entry(uuid) from public;
grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.family_member_role(uuid) to authenticated;
grant execute on function public.can_manage_family(uuid) to authenticated;
grant execute on function public.can_write_shared_entry(uuid) to authenticated;

alter table public.family_groups enable row level security;
alter table public.family_groups force row level security;
alter table public.family_memberships enable row level security;
alter table public.family_memberships force row level security;
alter table public.family_invites enable row level security;
alter table public.shared_entries enable row level security;
alter table public.shared_entries force row level security;
alter table public.shared_entry_participants enable row level security;
alter table public.shared_entry_participants force row level security;

grant select, insert, update, delete on public.family_groups to authenticated, service_role;
grant select, insert, update, delete on public.family_memberships to authenticated, service_role;
grant select, insert, update, delete on public.family_invites to authenticated, service_role;
grant select, insert, update, delete on public.shared_entries to authenticated, service_role;
grant select, insert, update, delete on public.shared_entry_participants to authenticated, service_role;

drop policy if exists "family_groups_select_members" on public.family_groups;
create policy "family_groups_select_members"
on public.family_groups for select
to authenticated
using (deleted_at is null and public.is_family_member(id));

drop policy if exists "family_groups_insert_owner" on public.family_groups;
create policy "family_groups_insert_owner"
on public.family_groups for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists "family_groups_update_admins" on public.family_groups;
create policy "family_groups_update_admins"
on public.family_groups for update
to authenticated
using (public.can_manage_family(id))
with check (public.can_manage_family(id));

drop policy if exists "family_memberships_select_members" on public.family_memberships;
create policy "family_memberships_select_members"
on public.family_memberships for select
to authenticated
using (public.is_family_member(family_group_id) or user_id = auth.uid());

drop policy if exists "family_memberships_insert_admins" on public.family_memberships;
create policy "family_memberships_insert_admins"
on public.family_memberships for insert
to authenticated
with check (
  (user_id = auth.uid() and role = 'owner' and status = 'active')
  or public.can_manage_family(family_group_id)
);

drop policy if exists "family_memberships_update_admins" on public.family_memberships;
create policy "family_memberships_update_admins"
on public.family_memberships for update
to authenticated
using (public.can_manage_family(family_group_id))
with check (public.can_manage_family(family_group_id));

drop policy if exists "family_invites_select_group_members" on public.family_invites;
create policy "family_invites_select_group_members"
on public.family_invites for select
to authenticated
using (
  (family_group_id is not null and public.is_family_member(family_group_id))
  or (
    coalesce(invited_email, email) is not null
    and lower(coalesce(invited_email, email)) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists "family_invites_insert_group_admins" on public.family_invites;
create policy "family_invites_insert_group_admins"
on public.family_invites for insert
to authenticated
with check (family_group_id is not null and public.can_manage_family(family_group_id));

drop policy if exists "family_invites_update_group_admins_or_invited" on public.family_invites;
create policy "family_invites_update_group_admins_or_invited"
on public.family_invites for update
to authenticated
using (
  (family_group_id is not null and public.can_manage_family(family_group_id))
  or (
    coalesce(invited_email, email) is not null
    and lower(coalesce(invited_email, email)) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
)
with check (
  (family_group_id is not null and public.can_manage_family(family_group_id))
  or (
    coalesce(invited_email, email) is not null
    and lower(coalesce(invited_email, email)) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists "shared_entries_select_members" on public.shared_entries;
create policy "shared_entries_select_members"
on public.shared_entries for select
to authenticated
using (deleted_at is null and public.is_family_member(family_group_id));

drop policy if exists "shared_entries_insert_members" on public.shared_entries;
create policy "shared_entries_insert_members"
on public.shared_entries for insert
to authenticated
with check (
  family_group_id is not null
  and created_by = auth.uid()
  and public.can_write_shared_entry(family_group_id)
);

drop policy if exists "shared_entries_update_creators_or_admins" on public.shared_entries;
create policy "shared_entries_update_creators_or_admins"
on public.shared_entries for update
to authenticated
using (
  public.can_manage_family(family_group_id)
  or (created_by = auth.uid() and public.can_write_shared_entry(family_group_id))
)
with check (
  family_group_id is not null
  and (
    public.can_manage_family(family_group_id)
    or (created_by = auth.uid() and public.can_write_shared_entry(family_group_id))
  )
);

drop policy if exists "shared_entries_delete_creators_or_admins" on public.shared_entries;
create policy "shared_entries_delete_creators_or_admins"
on public.shared_entries for delete
to authenticated
using (
  public.can_manage_family(family_group_id)
  or (created_by = auth.uid() and public.can_write_shared_entry(family_group_id))
);

drop policy if exists "shared_entry_participants_select_members" on public.shared_entry_participants;
create policy "shared_entry_participants_select_members"
on public.shared_entry_participants for select
to authenticated
using (
  exists (
    select 1
    from public.shared_entries se
    where se.id = shared_entry_id
      and se.deleted_at is null
      and public.is_family_member(se.family_group_id)
  )
);

drop policy if exists "shared_entry_participants_insert_members" on public.shared_entry_participants;
create policy "shared_entry_participants_insert_members"
on public.shared_entry_participants for insert
to authenticated
with check (
  exists (
    select 1
    from public.shared_entries se
    where se.id = shared_entry_id
      and public.can_write_shared_entry(se.family_group_id)
      and (se.created_by = auth.uid() or public.can_manage_family(se.family_group_id))
  )
);

drop policy if exists "shared_entry_participants_update_members" on public.shared_entry_participants;
create policy "shared_entry_participants_update_members"
on public.shared_entry_participants for update
to authenticated
using (
  exists (
    select 1
    from public.shared_entries se
    where se.id = shared_entry_id
      and (se.created_by = auth.uid() or public.can_manage_family(se.family_group_id))
  )
)
with check (
  exists (
    select 1
    from public.shared_entries se
    where se.id = shared_entry_id
      and (se.created_by = auth.uid() or public.can_manage_family(se.family_group_id))
  )
);

drop policy if exists "shared_entry_participants_delete_members" on public.shared_entry_participants;
create policy "shared_entry_participants_delete_members"
on public.shared_entry_participants for delete
to authenticated
using (
  exists (
    select 1
    from public.shared_entries se
    where se.id = shared_entry_id
      and (se.created_by = auth.uid() or public.can_manage_family(se.family_group_id))
  )
);
