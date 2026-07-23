insert into public.feature_flags (key, description, enabled, rollout_percentage)
values
  ('smart_actions', 'Acoes inteligentes premium', false, 0),
  ('advanced_price_history', 'Historico avancado de precos', false, 0)
on conflict (key) do update
set description = excluded.description;

insert into public.feature_entitlements (plan_code, feature_key, limit_value, enabled)
values
  ('free', 'wishlist_items', 5, true),
  ('free', 'automations', 1, true),
  ('free', 'smart_actions', null, false),
  ('free', 'advanced_price_history', null, false),
  ('premium_monthly', 'smart_actions', null, true),
  ('premium_monthly', 'advanced_price_history', null, true),
  ('premium_annual', 'smart_actions', null, true),
  ('premium_annual', 'advanced_price_history', null, true)
on conflict (plan_code, feature_key) do update
set
  limit_value = excluded.limit_value,
  enabled = excluded.enabled;
