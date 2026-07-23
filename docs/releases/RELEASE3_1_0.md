# Release 3.1.0 - Motor de Entrada e Conciliação

Date: 2026-07-13

## Decision

Version 3.1.0 turns statement import into a controlled financial-entry pipeline. The product no longer treats imported rows as blind entries: it previews, classifies, reconciles, skips duplicates and records a rollback session.

## Scope

- Added `src/domain/reconciliation/reconciliationEngine.js` as the pure statement reconciliation engine.
- Statement imports now classify each row as `create`, `duplicate`, `reconcile` or `ignored`.
- Duplicate detection covers existing incomes/expenses and repeated rows in the imported file.
- Subscription-like charges can be reconciled with active subscriptions before writing the expense.
- Confirmed imports create `state.importSessions` with created entries, skipped rows, reconciled charges and subscription snapshots.
- Rollback removes entries and subscription charges created by the import session.
- Lançamentos now shows an actionable import preview with counts and per-row status before confirmation.
- Package metadata and runtime version moved to `3.1.0`.

## Release Gate

Run these checks before tagging or deploying the 3.1.0 baseline:

```bash
npm test -- --run tests/unit/reconciliation-engine.test.js tests/stores/finance.test.js tests/unit/entries-view-contract.test.js
npm run validate:v3-release
npm run build
npm test -- --run --reporter=dot
```
