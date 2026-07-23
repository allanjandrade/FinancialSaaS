alter table public.automation_templates
  drop constraint if exists automation_templates_category_check;

alter table public.automation_templates
  add constraint automation_templates_category_check
  check (category in ('benefit', 'bill', 'card', 'cash', 'category', 'wishlist', 'planning'));

insert into public.automation_templates (
  id,
  name,
  description,
  category,
  parameter_schema,
  default_cooldown_hours,
  enabled
) values
(
  'goal_deadline_risk',
  'Meta em risco',
  'Avisa quando uma meta financeira ativa corre risco de nao chegar ao prazo planejado.',
  'planning',
  '{
    "type": "object",
    "required": ["goal_id"],
    "properties": {
      "goal_id": { "type": "string", "minLength": 1 }
    }
  }'::jsonb,
  24,
  true
),
(
  'budget_category_above_limit',
  'Orcamento acima do limite',
  'Avisa quando uma categoria passa do valor planejado para o mes.',
  'planning',
  '{
    "type": "object",
    "required": ["category"],
    "properties": {
      "category": { "type": "string", "minLength": 1 },
      "month_key": { "type": "integer", "minimum": 200001, "maximum": 299912 }
    }
  }'::jsonb,
  24,
  true
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  parameter_schema = excluded.parameter_schema,
  default_cooldown_hours = excluded.default_cooldown_hours,
  enabled = excluded.enabled,
  updated_at = now();
