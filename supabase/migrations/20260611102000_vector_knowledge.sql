-- Family-isolated semantic knowledge store using pgvector.

create schema if not exists extensions;
create extension if not exists vector with schema extensions;
set search_path = public, extensions;

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  source_type text not null,
  source_id text not null,
  title text not null default '',
  mime_type text,
  content_hash text not null,
  embedding_status text not null default 'pending'
    check (embedding_status in ('pending', 'processing', 'ready', 'error')),
  embedding_model text,
  embedding_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, source_type, source_id)
);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  content_hash text not null,
  token_count integer,
  embedding vector(1536) not null,
  embedding_model text not null,
  embedding_version text not null,
  embedded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (document_id, chunk_index)
);

create index if not exists knowledge_documents_family_source_idx
  on public.knowledge_documents(family_id, source_type, source_id);
create index if not exists knowledge_chunks_document_idx
  on public.knowledge_chunks(document_id, chunk_index);
create index if not exists knowledge_chunks_family_idx
  on public.knowledge_chunks(family_id);
create index if not exists knowledge_chunks_embedding_hnsw_idx
  on public.knowledge_chunks
  using hnsw (embedding vector_cosine_ops);

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;

drop policy if exists "knowledge_documents_select_member" on public.knowledge_documents;
create policy "knowledge_documents_select_member"
on public.knowledge_documents for select to authenticated
using (family_id in (select public.user_family_ids()));

drop policy if exists "knowledge_documents_write_editor" on public.knowledge_documents;
create policy "knowledge_documents_write_editor"
on public.knowledge_documents for all to authenticated
using (public.user_can_edit_family(family_id))
with check (public.user_can_edit_family(family_id));

drop policy if exists "knowledge_chunks_select_member" on public.knowledge_chunks;
create policy "knowledge_chunks_select_member"
on public.knowledge_chunks for select to authenticated
using (family_id in (select public.user_family_ids()));

drop policy if exists "knowledge_chunks_write_editor" on public.knowledge_chunks;
create policy "knowledge_chunks_write_editor"
on public.knowledge_chunks for all to authenticated
using (public.user_can_edit_family(family_id))
with check (public.user_can_edit_family(family_id));

create or replace function public.replace_knowledge_chunks(
  p_document_id uuid,
  p_family_id uuid,
  p_chunks jsonb,
  p_embedding_model text,
  p_embedding_version text
)
returns integer
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
  v_count integer;
begin
  if not public.user_can_edit_family(p_family_id) then
    raise exception 'Sem permissão para indexar esta família';
  end if;

  if not exists (
    select 1 from public.knowledge_documents
    where id = p_document_id and family_id = p_family_id
  ) then
    raise exception 'Documento de conhecimento não encontrado';
  end if;

  delete from public.knowledge_chunks where document_id = p_document_id;

  insert into public.knowledge_chunks (
    document_id,
    family_id,
    chunk_index,
    content,
    content_hash,
    token_count,
    embedding,
    embedding_model,
    embedding_version,
    metadata
  )
  select
    p_document_id,
    p_family_id,
    (item ->> 'chunk_index')::integer,
    item ->> 'content',
    item ->> 'content_hash',
    nullif(item ->> 'token_count', '')::integer,
    (item -> 'embedding')::text::vector(1536),
    p_embedding_model,
    p_embedding_version,
    coalesce(item -> 'metadata', '{}'::jsonb)
  from jsonb_array_elements(p_chunks) item;

  get diagnostics v_count = row_count;

  update public.knowledge_documents
  set embedding_status = 'ready',
      embedding_model = p_embedding_model,
      embedding_version = p_embedding_version,
      updated_at = now()
  where id = p_document_id;

  return v_count;
end;
$$;

grant execute on function public.replace_knowledge_chunks(uuid, uuid, jsonb, text, text)
  to authenticated;

create or replace function public.match_knowledge_chunks(
  p_family_id uuid,
  p_query_embedding vector(1536),
  p_match_threshold double precision default 0.72,
  p_match_count integer default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  title text,
  content text,
  similarity double precision,
  metadata jsonb
)
language sql
stable
security invoker
set search_path = public, extensions, pg_temp
as $$
  select
    chunk.id,
    chunk.document_id,
    document.title,
    chunk.content,
    1 - (chunk.embedding <=> p_query_embedding) as similarity,
    chunk.metadata || document.metadata as metadata
  from public.knowledge_chunks chunk
  join public.knowledge_documents document on document.id = chunk.document_id
  where chunk.family_id = p_family_id
    and p_family_id in (select public.user_family_ids())
    and 1 - (chunk.embedding <=> p_query_embedding) >= p_match_threshold
  order by chunk.embedding <=> p_query_embedding
  limit greatest(1, least(p_match_count, 20));
$$;

grant execute on function public.match_knowledge_chunks(uuid, vector, double precision, integer)
  to authenticated;
