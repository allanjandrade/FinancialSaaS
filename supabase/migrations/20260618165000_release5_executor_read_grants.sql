-- Release 5 hotfix: the locked executor needs read-only access to evaluate templates.
-- It must not write finance_states.

grant select on public.finance_states to service_role;
grant select on public.family_members to service_role;
