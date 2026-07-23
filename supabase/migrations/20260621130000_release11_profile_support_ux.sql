create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  avatar_path text,
  preferred_theme text check (preferred_theme in ('light', 'dark', 'auto') or preferred_theme is null),
  preferred_home_view text,
  hide_sensitive_values boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
alter table public.user_profiles force row level security;

grant select, insert, update, delete on public.user_profiles to authenticated;
grant select, insert, update, delete on public.user_profiles to service_role;

drop policy if exists "user_profiles_select_own" on public.user_profiles;
drop policy if exists "user_profiles_insert_own" on public.user_profiles;
drop policy if exists "user_profiles_update_own" on public.user_profiles;
drop policy if exists "user_profiles_delete_own" on public.user_profiles;

create policy "user_profiles_select_own"
on public.user_profiles for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "user_profiles_insert_own"
on public.user_profiles for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "user_profiles_update_own"
on public.user_profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "user_profiles_delete_own"
on public.user_profiles for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.touch_user_profiles_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_user_profiles_updated_at on public.user_profiles;
create trigger touch_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.touch_user_profiles_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_select_own" on storage.objects;
drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;

create policy "avatars_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatars_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatars_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatars_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create table if not exists public.support_faqs (
  id text primary key,
  question text not null,
  answer text not null,
  keywords text[] not null default '{}'::text[],
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_faqs enable row level security;
alter table public.support_faqs force row level security;

grant select on public.support_faqs to anon, authenticated;
grant select, insert, update, delete on public.support_faqs to service_role;

drop policy if exists "support_faqs_public_read_active" on public.support_faqs;
create policy "support_faqs_public_read_active"
on public.support_faqs for select
to anon, authenticated
using (active = true);

insert into public.support_faqs (id, question, answer, keywords, sort_order)
values
  ('como-comecar', 'Como começo a organizar minhas finanças?', 'Cadastre suas contas, cartões e receitas recorrentes. Depois registre lançamentos do mês para o painel mostrar saldo, gastos e prioridades.', array['começar','organizar','primeiro acesso'], 10),
  ('plano-gratis', 'O que está incluído no plano grátis?', 'O plano grátis permite usar recursos essenciais com limites mensais. Recursos avançados aparecem bloqueados até o acesso Premium estar ativo.', array['grátis','plano','limite'], 20),
  ('premium', 'Como funciona o Premium?', 'O Premium libera consultor financeiro, simulações, relatórios avançados e limites ampliados. Durante o acesso antecipado, a liberação é controlada para testers autorizados.', array['premium','assinatura','cobrança'], 30),
  ('seguranca', 'Meus dados financeiros ficam seguros?', 'Cada conta acessa apenas os próprios dados. O aplicativo usa autenticação, isolamento por usuário e telas administrativas restritas.', array['segurança','dados','privacidade'], 40),
  ('google', 'Posso entrar com Google?', 'Sim, quando o e-mail estiver liberado para acesso. Se aparecer bloqueio, solicite a inclusão na lista de testers ou use e-mail e senha.', array['google','login','acesso'], 50),
  ('senha', 'Como redefino minha senha?', 'Use “Esqueci minha senha” na tela de entrada. Você receberá um link para cadastrar uma nova senha segura.', array['senha','redefinir','esqueci'], 60),
  ('compras', 'Como acompanhar uma compra?', 'Abra Compras, crie uma nova compra por descrição, link ou imagem, revise os dados e salve. O aplicativo acompanha ofertas compatíveis quando possível.', array['compra','produto','preço'], 70),
  ('alertas', 'Os alertas mexem no meu dinheiro?', 'Não. Alertas apenas enviam notificações dentro do aplicativo. Eles não criam lançamentos, não alteram categorias e não executam ações financeiras.', array['alerta','notificação','dinheiro'], 80),
  ('excluir', 'Como excluo um item ou lançamento?', 'Use o botão de exclusão na própria tela. Ações destrutivas pedem confirmação antes de remover qualquer informação.', array['excluir','remover','apagar'], 90),
  ('privacidade', 'Onde encontro termos e privacidade?', 'Acesse os links de Privacidade, Termos de Uso e Assinatura no rodapé das páginas públicas ou nesta Central de Suporte.', array['termos','privacidade','legal'], 100)
on conflict (id) do update set
  question = excluded.question,
  answer = excluded.answer,
  keywords = excluded.keywords,
  sort_order = excluded.sort_order,
  active = true,
  updated_at = now();
