# Release 2 - Relatorio de execucao

Data: 2026-06-12

Status: concluida e certificada em ambiente local e remoto.

## Protecao antes das mudancas

- Branch: indisponivel porque `.git` esta somente para leitura neste ambiente.
- Snapshot: `backups/release-2-prechange-20260612-191948/project-source.zip`.
- SHA-256: `A6585AC372C30DC71E89487E91F603522ADC2EF27B0D22E28B6DB97E71827D35`.
- Inventario: 260 arquivos em `file-inventory.csv`.
- Baseline inicial confirmado pelo log do operador: build aprovado, 88 testes unitarios, E2E 10/10, consistencia financeira aprovada e lint remoto aprovado.

## Escopo implementado

- B.0: normalizacao unica de `finance_states`.
- B.1: snapshot financeiro consolidado.
- B.5: ritmo de consumo de VA/VR.
- B.6: risco de cartao por renda, limite, fatura e vencimento.
- B.2: projecao deterministica de fim de mes.
- B.3: anomalias por categoria, com separacao entre caixa e beneficios.
- B.4: simulacao de compra sem escrita automatica.
- B.7: sugestoes de recorrencia sem criacao automatica de regras.

Todos os calculos usam o mesmo servico compartilhado, derivam o usuario do JWT nas Edge Functions e rejeitam `user_id` ou equivalentes enviados pelo cliente.

## Arquivos alterados

- `package.json`
- `src/api/financial-engine.js`
- `supabase/functions/_shared/financial-engine/normalize-state.ts`
- `supabase/functions/_shared/financial-engine/normalize-state.js`
- `supabase/functions/_shared/financial-engine/calculations.ts`
- `supabase/functions/_shared/financial-engine/calculations.js`
- `supabase/functions/_shared/financial-engine/http.ts`
- `supabase/functions/financial-snapshot/index.ts`
- `supabase/functions/benefit-burn-rate/index.ts`
- `supabase/functions/card-risk/index.ts`
- `supabase/functions/month-end-projection/index.ts`
- `supabase/functions/category-anomalies/index.ts`
- `supabase/functions/purchase-simulation/index.ts`
- `supabase/functions/recurring-suggestions/index.ts`
- `tests/fixtures/release2-financial-state.js`
- `tests/unit/release2-financial-engine.test.js`
- `tests/unit/release2-edge-contract.test.js`
- `cypress/e2e/release2-financial-engine.cy.js`
- `scripts/cypress-result.js`
- `scripts/release2-authenticated-smoke.js`
- `scripts/release2-security-smoke.js`
- `scripts/validate-financial-engine.js`
- `tests/unit/cypress-result.test.js`
- `docs/release-2-report.md`

## Edge Functions criadas

- `financial-snapshot`
- `benefit-burn-rate`
- `card-risk`
- `month-end-projection`
- `category-anomalies`
- `purchase-simulation`
- `recurring-suggestions`

As sete funcoes foram empacotadas localmente, publicadas no projeto remoto `your-project-ref` e validadas por smoke autenticado em 2026-06-12.

## Migrations

Nenhuma. A Release 2 le `finance_states` e nao altera o schema remoto nem cria uma fonte paralela.

## Testes

- `npm run build`: PASS.
- `npm run test`: PASS, 27 arquivos e 107 testes.
- `npm run validate:financial-consistency`: PASS, patrimonio da massa da Release 1 em R$ 7.190.
- `npm run validate:financial-engine`: PASS, patrimonio da massa da Release 2 em R$ 8.280.
- Empacotamento local das sete Edge Functions: PASS.
- `npm run e2e`: PASS, 16/16 testes. Release 1: 10 fluxos; Release 2: 6 cenarios deterministicos.
- `supabase db lint --linked --level warning --fail-on error`: PASS no banco remoto, sem erros de schema.
- Smoke autenticado remoto: PASS, 7/7 Edge Functions responderam com estrutura e regras validas.
- Smoke de seguranca remoto: PASS, 14/14 verificacoes. As sete funcoes retornaram 401 sem JWT e rejeitaram `user_id` sem erro 500.

## Evidencia funcional

- Snapshot: exclui VA/VR, limite de cartao e transferencias internas do patrimonio.
- Projecao: retorna renda, despesas, fatura, saldo de beneficios, confianca, premissas e avisos.
- Anomalias: detecta Mercado 35,5% acima da media e ignora aumento irrelevante de R$ 5 para R$ 10.
- Simulacao: compra de R$ 800 em quatro parcelas retorna impacto mensal de R$ 200 e decisao `wait`.
- VA/VR: VA projeta saldo final de R$ -318 e status `risk` na massa de teste.
- Cartao: fatura de R$ 920 sobre renda de R$ 3.000 retorna `attention` e vencimento em oito dias.
- Recorrencias: Netflix e salario sao apenas sugeridos; nenhuma regra e criada automaticamente.
- Remoto: `financial-snapshot`, `benefit-burn-rate`, `card-risk`, `month-end-projection`, `category-anomalies`, `purchase-simulation` e `recurring-suggestions` responderam com status `OK` usando uma sessao real autenticada.

## Limitacoes registradas

- A branch Git nao pôde ser criada porque `.git` permaneceu somente para leitura; o snapshot com hash continua sendo a protecao rastreavel desta release.
- O smoke remoto confirma autenticacao, disponibilidade, contrato e regras estruturais, mas nao compara todos os valores reais do usuario com uma reconciliacao externa independente.
- O smoke realiza apenas leituras e simulacoes; nenhuma escrita automatica foi introduzida.

## Aceite final

- Build: aprovado.
- Testes unitarios: 107/107.
- E2E: 16/16.
- Consistencia financeira da Release 1: aprovada.
- Motor financeiro da Release 2: aprovado.
- Lint remoto: aprovado.
- Publicacao remota: concluida.
- Smoke autenticado remoto: 7/7.
- Smoke de seguranca remoto: 14/14.

Release 2 encerrada em 2026-06-12.
