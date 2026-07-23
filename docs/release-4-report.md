# Release 4 - Acoes confirmadas e reversiveis

Data local: 13/06/2026.

## Escopo implementado

- IA permanece incapaz de escrever ou confirmar operacoes.
- Fluxo separado em `propose-action`, revisao humana, `confirm-action` e `revert-action`.
- Seis acoes com payload estrito: lancamento, categoria, transferencia interna, wishlist, alerta e regra recorrente.
- Token opaco armazenado somente como hash e expiracao de dez minutos.
- Idempotencia e bloqueio transacional no PostgreSQL.
- Comparacao de `updated_at` impede escrita sobre estado financeiro alterado.
- Reversao especifica por operacao; nenhuma restauracao cega do JSON completo.
- `finance_states` permanece a unica fonte financeira autoritativa.
- RLS por usuario e colunas internas sem permissao de leitura pelo cliente.
- Perfis viewer sao bloqueados antes da confirmacao e reversao.
- Modal de revisao, historico auditavel e reversao nas configuracoes.

## Certificacao local

- Snapshot: `backups/release-4-prechange-20260613-091806/project-source.zip`.
- SHA-256: `262E1C313402DE702E9853AD6DAC8A763F56DE64B11F55DBAF40FDF7893A0D96`.
- Build: PASS.
- Vitest: 120/120 PASS.
- Validacao de acoes de IA: PASS.
- Consistencia financeira: PASS.
- Motor financeiro: PASS.
- Migration aplicada no Supabase local: PASS.
- Lint do banco local: PASS, sem erros.
- Cypress Release 4: tres cenarios adicionados; o executor isolado encerrou antes de iniciar as specs.

## Publicacao pendente

O processo isolado nao possui o token da CLI remota. No terminal autenticado, executar na ordem:

```powershell
supabase db push --dry-run
supabase db push
supabase db lint --linked --level warning --fail-on error
supabase functions deploy propose-action
supabase functions deploy confirm-action
supabase functions deploy revert-action
npm run e2e
```

Depois, executar `scripts/release4-authenticated-smoke.js` no console do aplicativo autenticado. A Release 4 so pode ser considerada aprovada no remoto quando o smoke terminar com `PASS, sem residuo financeiro`.
