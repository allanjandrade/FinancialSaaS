# Release 3 - Copiloto Contextual Somente Leitura

Data local de certificacao: 12/06/2026.
Smoke remoto aprovado: 12/06/2026.

## Escopo entregue

- Edge Function `ai-assist` autenticada e sem operacoes financeiras de escrita.
- Contexto montado exclusivamente no servidor a partir de `finance_states`.
- Calculos fornecidos pelo motor financeiro deterministico da Release 2.
- Consentimento explicito e revogavel em `user_ai_settings`.
- Cotas diaria e mensal atomicas em `user_ai_usage`.
- Gemini configurado apenas por secrets e modelo definido por ambiente.
- Prompt endurecido contra injecao e resposta JSON estruturada.
- Toda sugestao e normalizada com `executable: false`.
- Logs minimizados em `ai_interactions`, sem prompt ou contexto financeiro bruto.
- Hotfix remoto preparado para conceder apenas `INSERT` ao `service_role` em `ai_interactions`.
- Falha isolada de auditoria nao descarta uma resposta valida ja produzida pelo copiloto.
- Interface contextual no Dashboard, Lancamentos, Compras e Relatorios.

## Fonte da verdade

`finance_states` continua sendo a fonte financeira principal. A Release 3 nao cria fonte paralela, nao recalcula valores no modelo e nao altera lancamentos, contas, compras ou transferencias.

## Certificacao local

- Snapshot pre-alteracao: `backups/release-3-prechange-20260612-200142/project-source.zip`.
- SHA-256: `6C03758DD700A1CEE4BDD6487272E2F2E2E8708F78986291B4C4715A65AE18EA`.
- Build: aprovado.
- Vitest: 114/114 aprovados.
- `validate:ai-assist`: aprovado.
- Consistencia financeira: aprovada.
- Motor financeiro: aprovado.
- Migration aplicada no Supabase local e lint sem erros.
- Bundle estatico completo da Edge Function: aprovado.
- Renderizacao do card contextual no navegador: aprovada.

## Pendencias externas

- Cypress nao iniciou specs neste ambiente por bloqueio `EPERM` no cache global do executavel. A suite adicionada contem 6 cenarios e deve ser executada no terminal normal do Windows.
- A publicacao remota foi concluida pelo usuario no terminal autenticado.

## Smoke remoto

- `dashboard`: aprovado.
- `entries`: aprovado.
- `purchases`: aprovado.
- `reports`: aprovado.
- Override de `user_id`: rejeitado com `INVALID_PAYLOAD`.
- `context_payload` enviado pelo frontend: rejeitado com `INVALID_PAYLOAD`.
- `finance_states`: fingerprint inalterado antes e depois das quatro analises.
- Resultado final: 4/4 contextos, payload protegido e zero escrita financeira.

## Estado final

A Release 3 esta aprovada funcionalmente no remoto. A pendencia de Cypress continua sendo uma limitacao de execucao do ambiente isolado e precisa ser comprovada antes do inicio da Release 4.
