-- Release 3 hotfix: allow the authenticated Edge Function to write minimized audit records.

grant insert on public.ai_interactions to service_role;
