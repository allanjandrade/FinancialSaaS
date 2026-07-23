create table if not exists public.user_family_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  relationship text not null,
  include_in_analysis boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint user_family_members_relationship_check
    check (relationship in ('Cônjuge', 'Filho(a)', 'Pai/Mãe', 'Outro familiar', 'Outro'))
);

alter table public.user_family_members enable row level security;
alter table public.user_family_members force row level security;

grant select, insert, update, delete on public.user_family_members to authenticated;
grant select, insert, update, delete on public.user_family_members to service_role;

drop policy if exists "user_family_members_select_own" on public.user_family_members;
drop policy if exists "user_family_members_insert_own" on public.user_family_members;
drop policy if exists "user_family_members_update_own" on public.user_family_members;
drop policy if exists "user_family_members_delete_own" on public.user_family_members;

create policy "user_family_members_select_own"
on public.user_family_members for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "user_family_members_insert_own"
on public.user_family_members for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "user_family_members_update_own"
on public.user_family_members for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "user_family_members_delete_own"
on public.user_family_members for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.touch_user_family_members_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_user_family_members_updated_at on public.user_family_members;
create trigger touch_user_family_members_updated_at
before update on public.user_family_members
for each row execute function public.touch_user_family_members_updated_at();

drop policy if exists "avatars_select_own" on storage.objects;
drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;

create policy "avatars_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (
      (storage.foldername(name))[1] = 'avatars'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);

create policy "avatars_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (
      (storage.foldername(name))[1] = 'avatars'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);

create policy "avatars_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (
      (storage.foldername(name))[1] = 'avatars'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
)
with check (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (
      (storage.foldername(name))[1] = 'avatars'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);

create policy "avatars_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (
      (storage.foldername(name))[1] = 'avatars'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);

insert into public.support_faqs (id, question, answer, keywords, sort_order)
values
  ('premium', 'Como funciona o Premium?', 'O Premium funciona como um analista financeiro dentro do aplicativo: libera consultor financeiro, simulações, relatórios avançados, alertas ampliados e mais buscas de preço.', array['premium','assinatura','cobrança'], 30),
  ('google', 'Posso entrar com Google?', 'Sim. Quando o login com Google estiver habilitado, use o botão Continuar com Google na tela de entrada ou cadastro.', array['google','login','entrar','acesso'], 50)
on conflict (id) do update set
  question = excluded.question,
  answer = excluded.answer,
  keywords = excluded.keywords,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();
