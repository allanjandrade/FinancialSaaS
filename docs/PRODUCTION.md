# Overview de produção

Este documento consolida o que é necessário para colocar o **Controle Financeiro** em produção com segurança e sincronização familiar entre dispositivos (ex.: Allan e Jessica).

## Estado atual da aplicação

| Área | Status | Notas |
|------|--------|-------|
| UI Vue 3 + Vite | Pronto | Build `dist/` para hosting estático |
| Auth Supabase | Pronto | Credenciais via `VITE_SUPABASE_*` (não mais no HTML) |
| Dados locais | Pronto | `localStorage` chave `controle-financeiro-app-v2` |
| Modo família local | Pronto | Splits, dívidas, metas, auditoria |
| Modo família nuvem | Pronto | `families`, `family_members`, `finance_states` |
| Sync debounced | Pronto | Push ~1,5s após alterações |
| **Realtime** | Pronto | `postgres_changes` em `finance_states` |
| Edge Functions (IA/OCR) | Requer deploy | `supabase/functions/*` |
| Open Finance | Preparado | Estrutura multicontas, integração futura |

## Pré-requisitos

- Conta [Supabase](https://supabase.com) (plano Free suficiente para família pequena).
- Node.js 18+ e npm.
- Domínio ou subdomínio para o app (ex.: `app.seudominio.com`).
- Contas de usuário criadas no Supabase Auth (e-mail/senha).

## Checklist pré-go-live

### 1. Supabase — banco e segurança

- [ ] Aplicar **todas** as migrações em `supabase/migrations/` (SQL Editor ou CLI).
- [ ] Confirmar RLS ativo em `families`, `family_members`, `family_invites`, `finance_states`.
- [ ] Remover políticas de debug do tipo `Enable authenticated access` se existirem no projeto remoto.
- [ ] Habilitar Realtime na tabela `finance_states` (migração `20260601130000_finance_states_realtime.sql`).
- [ ] Em **Authentication → URL Configuration**, definir Site URL e Redirect URLs do domínio de produção.

### 2. Variáveis de ambiente (build)

Criar `.env` na raiz (nunca commitar):

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_APP_URL=https://app.seudominio.com
```

- A **anon key** é pública por design; proteção vem do **RLS**.
- Secrets de IA (OpenAI etc.) ficam apenas nas **Edge Functions** (Dashboard → Secrets).

### 3. Build e artefatos

```bash
npm ci
npm run build
```

- Saída em `dist/`.
- Testar: `npm run preview` e login + alteração de despesa + segundo browser.

### 4. Edge Functions

```bash
supabase login
supabase link --project-ref SEU_REF
supabase secrets set OPENAI_API_KEY=sk-...
supabase functions deploy ai-assistant
supabase functions deploy receipt-ocr
supabase functions deploy statement-ocr
supabase functions deploy chat
```

- Configurar CORS em `_shared/cors.ts` com origem de produção.
- Testar OCR, importacao de extrato e chat a partir do app em produção.

### 5. Hosting frontend

- Publicar conteúdo de `dist/`.
- SPA: rewrites para `index.html` (`vercel.json` ou `public/_redirects` já incluídos).
- HTTPS obrigatório (Auth e PWA).

### 6. Modo família — teste de aceite

- [ ] Usuário A cria família em `/family`.
- [ ] Convite por link/código para usuário B.
- [ ] B aceita e vê mesmos membros.
- [ ] A adiciona despesa → B recebe toast “Dados atualizados por outro dispositivo” e badge **Ao vivo** na topbar.
- [ ] B edita → A reflete em segundos sem refresh manual.

### 7. Segurança e compliance

- [ ] `.env` no `.gitignore` (já configurado).
- [ ] Rotacionar chaves se anon key já foi exposta em commit antigo (`index.html` legado).
- [ ] Backup: export JSON nas configurações + backups automáticos Supabase (plano pago).
- [ ] Política de senha forte nos usuários Auth.

### 8. Pós-deploy

- [ ] Monitorar logs Edge Functions no dashboard Supabase.
- [ ] Definir contato para suporte (WhatsApp/e-mail interno).
- [ ] Documentar usuários finais: [USER-GUIDE.md](./USER-GUIDE.md).

## Riscos conhecidos

| Risco | Mitigação |
|-------|-----------|
| Conflito de edição simultânea | Last-write-wins por `updated_at`; Realtime reduz janela de conflito |
| Perda de dados só local | Ativar família na nuvem antes de trocar de celular |
| QR de convite externo | `api.qrserver.com` — opcional trocar por lib local |
| Chunks Vite dynamic import | Warning em `finance.js` → `family-sync`; não afeta runtime |

## Métricas sugeridas (opcional)

- Taxa de erro em `family-sync.syncError`.
- Latência push/pull (DevTools Network).
- Uso de Edge Functions (cota mensal Supabase).

## Próximas evoluções (pós-MVP)

- Resolução de conflitos por campo (CRDT ou version vector).
- Notificações push (FCM) para convites.
- Open Finance conectado às contas em `FinancialStructure`.
- Testes E2E (Playwright) no fluxo login + sync.

## Referências

- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [SUPABASE.md](./SUPABASE.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
