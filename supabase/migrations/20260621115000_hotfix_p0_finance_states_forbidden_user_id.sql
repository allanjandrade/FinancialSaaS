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
    raise exception 'finance_states user_id must match authenticated user'
      using errcode = '42501';
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
