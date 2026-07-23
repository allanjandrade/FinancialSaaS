# Release 1 - Inventario e contrato de compatibilidade

## Baseline

- Snapshot: `backups/release-1-prechange-20260612-145110/project-source.zip`
- SHA-256: `3CF32B5FE62B4FE589DAE5C233EC135450C3B609938234CE321CE70B9C9B5CC2`
- Branch solicitada: nao criada porque a sessao nao possui permissao de escrita em `.git`.
- Build: aprovado.
- Testes unitarios do baseline: 81 aprovados em 21 arquivos.
- E2E no baseline: nao configurado.

## Tabelas existentes e reaproveitadas

- `families` e `family_members`: identidade familiar e autorizacao.
- `finance_states`: fonte operacional atual. O JSON `data` contem receitas, despesas, contas, cartoes, beneficios, wishlist, transferencias, dividas e metas.
- `receipts`: documentos processados, com acesso familiar e propriedade do usuario.
- `financial_documents` e `financial_events`: projecoes normalizadas aditivas; nao substituem `finance_states` nesta release.
- `products`, `stores`, `price_records`, `user_tracked_products` e `price_alerts`: monitoramento de precos.
- Tabelas vetoriais e conectores permanecem existentes, mas nao serao expandidos na Release 1.

## Tabelas novas

- `app_user_roles`, `feature_flags`, `user_flag_overrides`: administracao e rollout controlado.
- `audit_logs`: eventos minimos de seguranca e negocio, sem contexto financeiro bruto.
- `ai_interactions`: base futura, sem ativar IA, com expiracao de 90 dias.
- `user_ai_settings`: consentimento futuro, desativado por padrao.
- `purchase_items`, `purchase_price_history`: projecao persistente de wishlist e precos.
- `benefit_accounts`, `benefit_transactions`: projecao separada de VA/VR.

## Campos adicionados

Em `financial_events`: `is_internal_transfer`, `transfer_group_id`, `transfer_confidence`, `transfer_confirmed_at` e `transfer_confirmed_by`.

## Fluxos que dependem de finance_states

- carregamento, persistencia local e sincronizacao em tempo real da store Pinia;
- receitas, despesas, contas, cartoes e beneficios;
- wishlist e historico de compras;
- transferencias internas;
- relatorios, maturidade, planejamento e monitoramento de precos.

## Prevencao de fonte duplicada

1. `finance_states.data` continua sendo a fonte operacional durante toda a Release 1.
2. Tabelas novas recebem projecoes idempotentes com IDs estaveis e chaves unicas.
3. Edge Functions financeiras leem o estado familiar autorizado, evitando recompor totais a partir de projecoes incompletas.
4. Nenhuma migration apaga, move ou reescreve dados existentes.
5. Uma troca futura de fonte exige reconciliacao e certificacao separadas; nao ocorrera nesta release.
