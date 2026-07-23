# Release 1 - Relatorio de execucao

Data: 2026-06-12

## Protecao anterior as mudancas

- Git localizado em `C:\Program Files\Git\cmd\git.exe`.
- Branch `release-1-nucleo-financeiro-confiavel` nao criada: o ambiente negou escrita em `.git/refs/heads`.
- Snapshot equivalente criado antes das alteracoes:
  `backups/release-1-prechange-20260612-145110/project-source.zip`.
- SHA-256: `3CF32B5FE62B4FE589DAE5C233EC135450C3B609938234CE321CE70B9C9B5CC2`.
- Inventario: 242 arquivos de fonte.
- Baseline preservado em `baseline.txt`, `file-inventory.csv` e `snapshot.sha256`.

## Escopo implementado

- A.4: autenticacao central para Edge Functions, rejeicao de identidade enviada pelo cliente e erros 401/403 padronizados.
- A.0: papeis, feature flags, overrides, rollout deterministico e `get-feature-flags`.
- A.10: auditoria minimizada e base de interacoes futuras com expiracao de 90 dias.
- A.11: consentimento futuro desativado por padrao.
- A.5: projecao persistente de wishlist e historico sem apagar preco manual.
- A.6: contas e transacoes VA/VR separadas de contas bancarias.
- A.7: transferencias internas confirmaveis e reversiveis, excluidas dos relatorios quando confirmadas.
- A.1: Edge Function `monthly-report` autenticada.
- A.8: Edge Function `net-worth` autenticada.
- A.3: falha de OCR abre revisao manual e nunca salva automaticamente.
- A.2: aliases das rotas principais e pagina 404 interna.
- A.9: configuracao Cypress e dez cenarios criticos.
- A.12: certificacao financeira automatizada.

## Compatibilidade

`finance_states` continua sendo a fonte operacional. As tabelas novas sao projecoes aditivas, idempotentes e protegidas por RLS. Nenhuma migration remove ou reescreve dados existentes.

## Validacoes locais

- `npm run build`: PASS.
- `npm run test`: PASS, 24 arquivos e 88 testes.
- `npm run validate:financial-consistency`: PASS.
- Migration `20260612150000_release1_core.sql`: aplicada apenas no banco local.
- `supabase db lint --local --level warning --fail-on error`: PASS.
- Smoke visual: pagina 404 e alias `/reports` validados, sem erros no console.

## Cypress

- Cypress 15.17.0 instalado e verificado no Windows.
- Primeira execucao real: 8 de 10 cenarios aprovados.
- As duas falhas revelaram e permitiram corrigir:
  - tipo de receita vazio ao alternar para a aba Receita;
  - formulario enviando o tipo escolhido em `category`, enquanto a store esperava `type`;
  - `OFFICIAL_INCOME_TYPES` reexportado sem existir como binding local;
  - historico sobrescrevendo o tipo financeiro da receita com o marcador interno `income`;
  - assercao de despesa procurando uma descricao que a tabela nao exibe.
- A cobertura local equivalente foi adicionada e esta aprovada.
- Repeticao intermediaria: 9 de 10 cenarios aprovados e revelou o mapeamento incorreto de `category` para `type` em receitas.
- Execucao final no terminal normal do Windows: **10 de 10 cenarios aprovados**.

## Estado de liberacao remota

Todos os gates locais da Release 1 estao aprovados. Nenhuma migration ou Edge Function desta release foi enviada ao Supabase remoto ate a conferencia final de `migration list`, `db push --dry-run` e lint vinculado.
