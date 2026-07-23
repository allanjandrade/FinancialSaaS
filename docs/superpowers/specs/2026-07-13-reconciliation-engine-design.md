# Release 3.1 - Motor de Entrada e Conciliação

## Objetivo

Transformar a importação de extratos em um fluxo previsível: o usuário envia CSV/PDF/imagem, revisa uma prévia inteligente, confirma apenas o que deve virar lançamento e mantém rastreabilidade para desfazer a importação.

## Escopo

- Normalizar linhas de extrato já reconhecidas pelo parser existente.
- Detectar duplicidades contra receitas/despesas existentes e dentro do próprio arquivo.
- Sugerir categoria ou tipo por palavras-chave.
- Reconciliar cobranças reais com assinaturas previstas quando fornecedor, valor, data e fonte forem compatíveis.
- Impedir que uma cobrança reconciliada seja tratada como previsão mais lançamento solto no relatório.
- Registrar sessão de importação com resumo e rollback lógico.
- Expor o fluxo na tela de lançamentos sem criar dados silenciosamente.

## Fora de Escopo

- Integração Open Finance real com bancos.
- Importação OFX completa.
- Categorização por modelo de IA.
- Sincronização remota de sessões de importação.

## Contrato Funcional

- Toda linha importada recebe ação: `create`, `duplicate`, `reconcile` ou `ignored`.
- Linhas `duplicate` não criam lançamento.
- Linhas `reconcile` criam lançamento vinculado à assinatura e geram `subscriptionCharges`.
- Linhas `create` criam receita ou despesa normal, com categoria/tipo sugerido quando possível.
- A confirmação cria uma sessão em `state.importSessions`.
- O rollback remove os lançamentos criados pela sessão e remove cobranças de assinatura vinculadas por essa sessão.

## Critérios de Aceite

- Testes unitários cobrem CSV, duplicidade, categorização, reconciliação, confirmação e rollback.
- Tela de lançamentos mostra prévia com resumo antes de confirmar.
- Store expõe `buildStatementImportPreview`, `confirmStatementImportPreview` e `rollbackImportSession`.
- Build passa.
