alter table public.finance_states enable row level security;
alter table public.finance_states force row level security;

drop policy if exists "Enable all access for authenticated users" on public.finance_states;

do $$
declare
  v_policy_name text;
begin
  for v_policy_name in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_states'
      and policyname not in (
        'finance states select own',
        'finance states insert own',
        'finance states update own',
        'finance states delete own'
      )
  loop
    execute format('drop policy if exists %I on public.finance_states', v_policy_name);
  end loop;
end;
$$;

revoke all on public.finance_states from anon;
revoke all on public.finance_states from authenticated;
grant select, insert, update, delete on public.finance_states to authenticated;

drop policy if exists "finance states select own" on public.finance_states;
drop policy if exists "finance states insert own" on public.finance_states;
drop policy if exists "finance states update own" on public.finance_states;
drop policy if exists "finance states delete own" on public.finance_states;

create policy "finance states select own"
on public.finance_states
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "finance states insert own"
on public.finance_states
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "finance states update own"
on public.finance_states
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "finance states delete own"
on public.finance_states
for delete
to authenticated
using ((select auth.uid()) = user_id);
