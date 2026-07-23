# Release 3.0.0 - Product Readiness

Date: 2026-07-13

## Decision

Version 3.0.0 consolidates the current application into a financial operating system. This is not a database-breaking release, but it is a product-architecture release: the authenticated home now starts from a single monthly command flow instead of isolated dashboard sections.

## Scope

- Package metadata moved from `2.0.0` to `3.0.0`.
- Runtime app version moved to `src/config/app-version.js`.
- Settings > Sobre now renders the same runtime version used by release validation.
- `/dashboard` now renders the Central de Comando as the authenticated home.
- `/command-center` remains as a compatibility route for the same command experience.
- `/analysis` preserves the previous analytical dashboard as a secondary intelligence surface.
- The V3 operating-system layer connects financial base, monthly control, subscriptions, purchase decisions, and AI into one execution map.
- The command center now turns finance data into score, pillars, operating-system map, action plan, execution rails, and AI-ready facts.
- The consultative analyst now receives V3 command facts, so explanations can use the same score and action plan as the dashboard.
- Navigation now exposes one home entry, `Comando`, and moves `Análises` under `Inteligência`.
- `CHANGELOG.md` records the 3.0.0 milestone.
- `npm run validate:v3-release` validates package metadata, app metadata, Settings copy, README, release documentation, V3 command-center behavior, and the operating-system map.

## Release Gate

Run these checks before tagging or deploying the 3.0.0 baseline:

```bash
npm run validate:v3-release
npm run validate:menu-architecture
npm run validate:navigation
npm run build
npm test -- --run --reporter=dot
```
