grant select, insert, update on table public.family_invites to authenticated;

create or replace function public.list_family_invites(p_family_id uuid)
returns table (
  id uuid,
  token uuid,
  email text,
  status text,
  method text,
  expires_at timestamptz,
  created_at timestamptz,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.token,
    i.email,
    i.status,
    i.method,
    i.expires_at,
    i.created_at,
    i.accepted_at
  from public.family_invites i
  where i.family_id = p_family_id
    and public.user_is_family_admin(i.family_id)
  order by i.created_at desc;
$$;

grant execute on function public.list_family_invites(uuid) to authenticated;
