# Release 3.4.0 - Execucao Assistida

## Objetivo

Consolidar a execucao assistida para prioridades da Central de Comando, guiando acoes de alto impacto sem permitir que a IA grave dados diretamente.

## Principais mudancas

- Dominio V3.4 dedicado para montar execucoes assistidas, confirmacoes e fatos enviados para IA.
- Drawer contextual para orientar receita inicial, metas e acoes de assinaturas com confirmacao explicita.
- Central de Comando integrada ao fluxo de execucao assistida para a proxima melhor acao.
- Agenda proativa passa a carregar metadata de execucao segura.
- IA consultiva recebe contexto da execucao para explicar proximos passos sem executar gravacoes.
- Metadata e validador de release atualizados para 3.4.0.

## Validacao esperada

- `npm test -- --run tests/unit/v3-release-contract.test.js tests/unit/v3-4-action-execution.test.js tests/unit/v3-4-assisted-drawer-contract.test.js tests/unit/v3-4-command-center-assisted-execution.test.js tests/unit/v3-4-ai-assisted-execution.test.js --reporter=dot`
- `npm run validate:v3-release`
