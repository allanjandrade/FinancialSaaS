create table if not exists public.advisor_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recommendation_id text not null,
  feedback text not null check (feedback in ('useful', 'not_useful', 'too_conservative', 'too_aggressive')),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists advisor_feedback_user_created_idx
  on public.advisor_feedback (user_id, created_at desc);

alter table public.advisor_feedback enable row level security;

drop policy if exists "advisor_feedback_select_own" on public.advisor_feedback;
create policy "advisor_feedback_select_own"
  on public.advisor_feedback
  for select
  using (auth.uid() = user_id);

drop policy if exists "advisor_feedback_insert_own" on public.advisor_feedback;
create policy "advisor_feedback_insert_own"
  on public.advisor_feedback
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "advisor_feedback_no_update" on public.advisor_feedback;
create policy "advisor_feedback_no_update"
  on public.advisor_feedback
  for update
  using (false)
  with check (false);

drop policy if exists "advisor_feedback_delete_own" on public.advisor_feedback;
create policy "advisor_feedback_delete_own"
  on public.advisor_feedback
  for delete
  using (auth.uid() = user_id);
