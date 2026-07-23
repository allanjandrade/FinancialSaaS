# Desenvolvimento local

## Requisitos

- Node.js 18+
- npm 9+
- Conta Supabase (dev ou prod)

## Setup

```bash
npm install
cp .env.example .env
```

Exemplo `.env`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=<sua-anon-key>
VITE_APP_URL=http://localhost:5173
```

```bash
npm run dev
```

App em `http://localhost:5173`.

## Scripts

| Comando | Ação |
|---------|------|
| `npm run dev` | Servidor Vite com HMR |
| `npm run build` | Build produção → `dist/` |
| `npm run preview` | Serve `dist/` localmente |

## Estrutura de pastas

```
src/
  views/          # Páginas
  components/     # UI
  stores/         # Pinia (finance, auth, family-sync, ai)
  api/            # Supabase família
  utils/          # Lógica de negócio
  lib/            # Cliente Supabase
  router/
  styles/
supabase/
  migrations/     # SQL versionado
  functions/      # Edge Functions Deno
docs/             # Documentação oficial
public/           # Assets estáticos, _redirects
```

## Convenções

- Estado financeiro: sempre mutar via actions do `useFinanceStore()` e `saveState()`.
- Sync nuvem: não chamar `pushFinanceState` direto da UI — use `familySync`.
- Bootstrap remoto: usar `saveState({ skipCloudPush: true })` após merge.
- Novas rotas: registrar em `src/router/index.js` e título em `Topbar.vue`.

## Testar Realtime localmente

1. Dois browsers (ou normal + anônimo), usuários diferentes na mesma família.
2. Login em ambos.
3. Editar despesa no browser A → toast no B em poucos segundos.

## Supabase local (opcional)

```bash
supabase start
supabase db reset
```

Ajuste `.env` para URL/keys do `supabase status`.

## Testes

```bash
npm run test        # watch
npm run test:run    # CI
npm run test:coverage
```

Detalhes em [TESTING.md](./TESTING.md).

## Lint / tipos

Projeto JavaScript sem TypeScript estrito. Validar com `npm run build` e `npm run test:run` antes de PR.

## Depuração sync

- DevTools → Network: chamadas a `finance_states`
- Console: erros em `familySync.syncError`
- Vue DevTools: inspecionar `finance.state.settings.lastRemoteSyncAt`
