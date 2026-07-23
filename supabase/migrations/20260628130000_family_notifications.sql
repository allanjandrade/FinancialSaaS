alter table public.in_app_notifications
  drop constraint if exists in_app_notifications_source_check;

alter table public.in_app_notifications
  add constraint in_app_notifications_source_check
  check (source in ('automation', 'system', 'ai_action', 'family'));

create index if not exists family_invites_pending_email_idx
  on public.family_invites(lower(coalesce(invited_email, email)), status, expires_at)
  where coalesce(invited_email, email) is not null;

create index if not exists in_app_notifications_family_unread_idx
  on public.in_app_notifications(user_id, created_at desc)
  where read_at is null;
