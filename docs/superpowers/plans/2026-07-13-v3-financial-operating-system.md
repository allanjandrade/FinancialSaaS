# V3 Financial Operating System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Version 3.0 feel like one coherent financial operating system instead of disconnected financial pages.

**Architecture:** Promote the command center to the authenticated home at `/dashboard`, move the previous dashboard experience to `/analysis`, and introduce a V3 operating-system domain layer that ties entries, accounts, subscriptions, wishlist, planning, and AI into one monthly execution flow. Keep existing analytical dashboard code intact by moving it rather than rewriting it.

**Tech Stack:** Vue 3, Vue Router, Pinia finance store, Vitest, existing CSS tokens.

---

### Task 1: V3 Operating-System Domain

**Files:**
- Create: `src/domain/v3/financialOperatingSystem.js`
- Test: `tests/unit/v3-operating-system.test.js`

- [x] **Step 1: Write failing tests**

Tests assert `buildV3OperatingSystem` returns five connected stages: foundation, control, commitments, decisions, and intelligence.

- [x] **Step 2: Run tests and confirm failure**

Run:

```bash
npm test -- --run tests/unit/v3-operating-system.test.js tests/unit/v3-product-shell-unification.test.js --reporter=dot
```

Expected: FAIL because `src/domain/v3/financialOperatingSystem.js` does not exist and the shell still uses the old dashboard contract.

- [x] **Step 3: Implement domain**

Create `buildV3OperatingSystem({ command, state, monthData, availableBalance })` with deterministic stage status, active stage, home route, analysis route, headline, and summary.

### Task 2: Shared V3 Operating-System UI

**Files:**
- Create: `src/components/v3/FinancialOSMap.vue`
- Modify: `src/views/CommandCenter.vue`

- [x] **Step 1: Render the map**

Add a reusable map component with `data-testid="v3-operating-system-map"` and stage buttons routing to the correct module.

- [x] **Step 2: Integrate command center**

Import `FinancialOSMap`, compute `operatingSystem`, remove “Voltar ao dashboard”, and add an “Abrir análises” route to `/analysis`.

### Task 3: Product Shell and Navigation

**Files:**
- Modify: `src/router/index.js`
- Modify: `src/router/navigation.js`
- Modify: `src/components/Sidebar.vue`
- Test: `tests/unit/v3-product-shell-unification.test.js`
- Modify: `tests/unit/navigation-contract.test.js`
- Modify: `tests/unit/sidebar-menu.test.js`
- Modify: `tests/unit/mobile-navigation.test.js`

- [x] **Step 1: Promote command center**

Make `/dashboard` render `CommandCenter.vue`; keep `/command-center` as a compatibility route to the same component.

- [x] **Step 2: Move old dashboard**

Add `/analysis` rendering `Home.vue`, with route metadata under Inteligência.

- [x] **Step 3: Simplify menu**

Change Início to only `Comando` and add `Análises` under Inteligência.

### Task 4: Release Gates

**Files:**
- Modify: `scripts/validate-v3-release.js`
- Modify: `scripts/validate-menu-architecture.js`
- Modify: `scripts/validate-navigation.js` if route lists are hardcoded
- Modify: `docs/releases/RELEASE3_0_0.md`

- [x] **Step 1: Update validators**

Require the operating-system domain, map component, `/dashboard` command-home contract, and `/analysis` route.

- [x] **Step 2: Verify**

Run:

```bash
npm test -- --run tests/unit/v3-operating-system.test.js tests/unit/v3-product-shell-unification.test.js tests/unit/v3-command-center-route.test.js tests/unit/navigation-contract.test.js tests/unit/sidebar-menu.test.js tests/unit/mobile-navigation.test.js --reporter=dot
npm run validate:v3-release
npm run validate:menu-architecture
npm run validate:navigation
npm run build
npm test -- --run --reporter=dot
```
