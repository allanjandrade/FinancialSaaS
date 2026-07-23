create or replace function public.get_vault_secret(secret_name text)
returns text
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  secret_value text;
begin
  select decrypted_secret
    into secret_value
  from vault.decrypted_secrets
  where name = secret_name
  order by updated_at desc nulls last, created_at desc nulls last
  limit 1;

  return secret_value;
end;
$$;

revoke all on function public.get_vault_secret(text) from public;
revoke all on function public.get_vault_secret(text) from anon;
revoke all on function public.get_vault_secret(text) from authenticated;
grant execute on function public.get_vault_secret(text) to service_role;
