-- Additive normalized projections. The existing finance_states JSON remains the source used by the app.

create table if not exists public.financial_documents (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  source_type text not null,
  source_id text not null,
  document_type text not null default 'other',
  title text not null default '',
  mime_type text,
  storage_bucket text,
  storage_path text,
  content_hash text,
  extracted_text text,
  extraction_method text,
  extraction_confidence numeric(5, 2),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, source_type, source_id)
);

create table if not exists public.financial_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  event_type text not null,
  source_type text not null,
  source_id text,
  dedupe_key text not null,
  occurred_at timestamptz not null,
  amount numeric(14, 2),
  currency text not null default 'BRL',
  description text not null default '',
  category text,
  counterparty text,
  payload_hash text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, dedupe_key)
);

create index if not exists financial_documents_family_occurred_idx
  on public.financial_documents(family_id, occurred_at desc);
create index if not exists financial_documents_hash_idx
  on public.financial_documents(content_hash) where content_hash is not null;
create index if not exists financial_events_family_occurred_idx
  on public.financial_events(family_id, occurred_at desc);
create index if not exists financial_events_source_idx
  on public.financial_events(family_id, source_type, source_id);

alter table public.financial_documents enable row level security;
alter table public.financial_events enable row level security;

drop policy if exists "financial_documents_select_member" on public.financial_documents;
create policy "financial_documents_select_member"
on public.financial_documents for select to authenticated
using (family_id in (select public.user_family_ids()));

drop policy if exists "financial_documents_write_editor" on public.financial_documents;
create policy "financial_documents_write_editor"
on public.financial_documents for all to authenticated
using (public.user_can_edit_family(family_id))
with check (public.user_can_edit_family(family_id));

drop policy if exists "financial_events_select_member" on public.financial_events;
create policy "financial_events_select_member"
on public.financial_events for select to authenticated
using (family_id in (select public.user_family_ids()));

drop policy if exists "financial_events_write_editor" on public.financial_events;
drop policy if exists "financial_events_insert_editor" on public.financial_events;
create policy "financial_events_insert_editor"
on public.financial_events for insert to authenticated
with check (public.user_can_edit_family(family_id));

drop policy if exists "financial_events_update_editor" on public.financial_events;
create policy "financial_events_update_editor"
on public.financial_events for update to authenticated
using (public.user_can_edit_family(family_id))
with check (public.user_can_edit_family(family_id));
