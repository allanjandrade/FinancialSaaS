# Checklist de ambiente

## Frontend

- `VITE_SUPABASE_URL`: publico e correto.
- `VITE_SUPABASE_ANON_KEY`: publico e correto.
- Nenhum `service_role` no bundle.
- Nenhum `GEMINI_API_KEY` no bundle.
- Nenhum `VALUE_SERP_API_KEY` no bundle.
- Nenhum segredo de gateway no bundle.

## Edge Functions

- `SUPABASE_SERVICE_ROLE_KEY`: somente server-side.
- webhook secret: somente server-side.
- Chaves de IA e ValueSERP: somente server-side.

Validacao: `npm run validate:secrets`.
