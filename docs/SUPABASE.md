# Supabase — configuração

## Tabelas principais

| Tabela | Função |
|--------|--------|
| `families` | Grupo familiar (`invite_code` único) |
| `family_members` | Vínculo usuário ↔ família + papel |
| `family_invites` | Convites pendentes (e-mail, token) |
| `finance_states` | JSON do estado financeiro por `family_id` |

## Migrações

Aplicar na ordem cronológica em `supabase/migrations/`:

### `20260601120000_family_invites_rls.sql`

- Cria `family_invites`
- RPCs: `accept_family_invite`, `join_family_by_invite_code`
- Políticas RLS para família e convites
- Helpers de membership

### `20260601130000_finance_states_realtime.sql`

- `REPLICA IDENTITY FULL` em `finance_states`
- Adiciona tabela à publicação `supabase_realtime`

**Após aplicar:** no Dashboard → Database → Replication, confirme `finance_states` listada.

## RLS — princípios

- Usuário só lê/escreve dados da **própria família** (via `family_members`).
- Convites: criador admin; aceite valida e-mail do JWT quando aplicável.
- `finance_states`: SELECT/INSERT/UPDATE apenas para membros ativos da família.

## Variáveis no frontend

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_URL=
```

Inicialização: `src/lib/supabase-client.js` → `initSupabase()` em `main.js`.

## Realtime

Canal: `family-finance:{familyId}`

Eventos: `postgres_changes` em `finance_states` com filtro `family_id=eq.{id}`.

O cliente ignora eventos quando:

- `applyingRemote` ou `pushInFlight` está ativo
- `updated_at` remoto ≤ `settings.lastRemoteSyncAt` local

## RPCs úteis

| RPC | Descrição |
|-----|-----------|
| `accept_family_invite(token, display_name)` | Aceita convite por token |
| `join_family_by_invite_code(code, display_name)` | Entra pela código da família |

## Edge Functions — secrets

Configure no projeto (não no `.env` do Vite):

- `OPENAI_API_KEY` (ou provedor usado)
- Outras chaves referenciadas em `supabase/functions/*/index.ts`

## Auth

1. Authentication → Providers → Email habilitado.
2. Criar usuários (Allan, Jessica) ou permitir sign-up conforme política.
3. Site URL = URL de produção do app.

## Troubleshooting

| Problema | Solução |
|----------|---------|
| Realtime não conecta | Migração realtime + RLS SELECT em `finance_states` |
| Push 403 | Usuário não é `family_members` ativo |
| Convite inválido | Token expirado ou e-mail JWT diferente do convite |
| App sem Supabase | `.env` ausente no build — variáveis vazias |

## SQL legado

`supabase-setup-clean.sql` na raiz pode conter schema antigo. **Prefira migrações versionadas** em `supabase/migrations/`.

## Referência de API frontend

`src/api/family-supabase.js` — funções usadas por `family-sync.js`.
