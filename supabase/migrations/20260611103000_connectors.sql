-- Connector contract with incremental cursors, deduplication and audit history.

create table if not exists public.connector_accounts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  connector_type text not null
    check (connector_type in ('open_finance', 'document', 'email', 'marketplace', 'manual')),
  provider text not null,
  external_account_id text not null default 'default',
  display_name text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'active', 'paused', 'error', 'revoked')),
  scopes text[] not null default '{}',
  cursor text,
  credential_secret_name text,
  config jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, connector_type, provider, external_account_id)
);

create table if not exists public.connector_sync_runs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.connector_accounts(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  initiated_by uuid references auth.users(id) on delete set null default auth.uid(),
  status text not null default 'running'
    check (status in ('running', 'completed', 'partial', 'failed')),
  cursor_before text,
  cursor_after text,
  records_seen integer not null default 0,
  records_created integer not null default 0,
  records_updated integer not null default 0,
  records_skipped integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.connector_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.connector_accounts(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  external_id text,
  event_type text not null,
  dedupe_key text not null,
  payload_hash text not null,
  occurred_at timestamptz not null,
  payload jsonb not null,
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processed', 'ignored', 'error')),
  processing_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, dedupe_key)
);

create index if not exists connector_accounts_family_idx
  on public.connector_accounts(family_id, status);
create index if not exists connector_sync_runs_account_idx
  on public.connector_sync_runs(account_id, started_at desc);
create index if not exists connector_events_family_occurred_idx
  on public.connector_events(family_id, occurred_at desc);
create index if not exists connector_events_processing_idx
  on public.connector_events(processing_status, created_at);

alter table public.connector_accounts enable row level security;
alter table public.connector_sync_runs enable row level security;
alter table public.connector_events enable row level security;

drop policy if exists "connector_accounts_select_member" on public.connector_accounts;
create policy "connector_accounts_select_member"
on public.connector_accounts for select to authenticated
using (family_id in (select public.user_family_ids()));

drop policy if exists "connector_accounts_manage_admin" on public.connector_accounts;
create policy "connector_accounts_manage_admin"
on public.connector_accounts for all to authenticated
using (public.user_is_family_admin(family_id))
with check (public.user_is_family_admin(family_id));

drop policy if exists "connector_sync_runs_select_member" on public.connector_sync_runs;
create policy "connector_sync_runs_select_member"
on public.connector_sync_runs for select to authenticated
using (family_id in (select public.user_family_ids()));

drop policy if exists "connector_sync_runs_write_editor" on public.connector_sync_runs;
drop policy if exists "connector_sync_runs_insert_editor" on public.connector_sync_runs;
create policy "connector_sync_runs_insert_editor"
on public.connector_sync_runs for insert to authenticated
with check (public.user_can_edit_family(family_id));

drop policy if exists "connector_sync_runs_update_editor" on public.connector_sync_runs;
create policy "connector_sync_runs_update_editor"
on public.connector_sync_runs for update to authenticated
using (public.user_can_edit_family(family_id))
with check (public.user_can_edit_family(family_id));

drop policy if exists "connector_events_select_member" on public.connector_events;
create policy "connector_events_select_member"
on public.connector_events for select to authenticated
using (family_id in (select public.user_family_ids()));

drop policy if exists "connector_events_write_editor" on public.connector_events;
drop policy if exists "connector_events_insert_editor" on public.connector_events;
create policy "connector_events_insert_editor"
on public.connector_events for insert to authenticated
with check (public.user_can_edit_family(family_id));

drop policy if exists "connector_events_update_editor" on public.connector_events;
create policy "connector_events_update_editor"
on public.connector_events for update to authenticated
using (public.user_can_edit_family(family_id))
with check (public.user_can_edit_family(family_id));
