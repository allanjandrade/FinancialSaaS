# Changelog

## 3.4.0 - 2026-07-23

- Adicionada execucao assistida para prioridades da Central de Comando.
- Agenda proativa passa a carregar metadata de execucao segura.
- Drawer contextual guia receita inicial, metas e acoes de assinaturas com confirmacao.
- IA consultiva recebe contexto da execucao sem poder gravar dados.
- Metadata e validador de release atualizados para 3.4.0.

## 3.3.0 - 2026-07-23

- Adicionada orquestracao financeira proativa para agenda, melhor proxima acao e bloqueios.
- Central de Comando passa a exibir agenda por horizonte e primeiros passos operacionais.
- IA consultiva recebe fatos da agenda V3.3 para explicar recomendacoes com dados reais.
- Metadata e validador de release atualizados para 3.3.0.

## 3.2.0 - 2026-07-14

### Added

- Added a shared operational context panel for premium operation screens.
- Added release contracts for the v3.2 navigation hierarchy and integrated operational UX.
- Added a dedicated release note for the 3.2.0 premium UX upgrade.

### Changed

- Refined Lançamentos around a single primary OCR action, statement import and secondary manual entry.
- Refined Contas e cartões as a cleaner financial hub with contextual side guidance.
- Standardized destructive buttons, badges and action menus through shared UI component contracts.
- Kept Assinaturas and Família under Operação, with Inteligência as the second primary menu group.
- Updated runtime metadata and README to Version 3.2.0.

## 3.1.0 - 2026-07-13

### Added

- Added a statement reconciliation engine that previews imported rows before writing financial data.
- Added duplicate detection against existing entries and repeated rows inside the same import file.
- Added subscription reconciliation during statement import, linking real charges to expected subscription charges.
- Added import session history with rollback support for created entries and reconciled charges.
- Added smarter statement preview UI in Lançamentos with create, duplicate and subscription reconciliation statuses.

### Changed

- Imported statement expenses now receive deterministic category suggestions instead of defaulting every row to Outros.
- Updated runtime metadata and README to Version 3.1.0.

## 3.0.0 - 2026-07-13

### Changed

- Consolidated the application as Version 3.0.0 after the product, billing, legal, subscriptions, visual polish, and production-readiness work.
- Added a runtime version source in `src/config/app-version.js` and surfaced it in Settings > Sobre.
- Added `npm run validate:v3-release` as a dedicated release metadata and documentation gate.
- Promoted Central de Comando to `/dashboard` and moved the former dashboard experience to `/analysis`.
- Added the V3 financial operating-system map connecting base financeira, controle do mês, assinaturas, decisões de compra, and IA consultiva.
- Simplified navigation so `Comando` is the single home entry and `Análises` lives under Inteligência.

### Validation

- `npm run build`
- `npm test -- --run --reporter=dot`
- `npm run validate:v3-release`
- `npm run validate:menu-architecture`
- `npm run validate:navigation`
