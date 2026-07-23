# V3 Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a functional Version 3.0.0 command layer that turns dashboard data into clear next actions.

**Architecture:** Create a pure domain module that receives finance state and summary inputs, returns prioritized actions, KPIs, risks, and navigation targets, then render it in `Home.vue`. Keep the UI as a compact dashboard section instead of adding another route.

**Tech Stack:** Vue 3, Pinia finance store, Vitest, existing CSS tokens and dashboard layout.

---

### Task 1: Domain Contract

**Files:**
- Create: `tests/unit/v3-command-center.test.js`
- Create: `src/domain/v3/commandCenter.js`

- [x] **Step 1: Write failing tests**

Assert onboarding, subscription, wishlist, and reserve scenarios against `buildV3CommandCenter`.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/v3-command-center.test.js --reporter=dot`
Expected: FAIL because the module does not exist.

- [x] **Step 3: Implement minimal domain module**

Return a stable object with `mode`, `headline`, `primaryAction`, `kpis`, `risks`, and `actions`.

- [x] **Step 4: Run focused tests**

Run: `npm test -- --run tests/unit/v3-command-center.test.js --reporter=dot`
Expected: PASS.

### Task 2: Dashboard Integration

**Files:**
- Create: `tests/unit/v3-dashboard-command-center.test.js`
- Modify: `src/views/Home.vue`
- Modify: `scripts/validate-v3-release.js`

- [x] **Step 1: Write failing source contract**

Assert `Home.vue` imports the domain module, exposes `data-testid="v3-command-center"`, and validates it in the V3 release gate.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/v3-dashboard-command-center.test.js --reporter=dot`
Expected: FAIL because the dashboard does not render the V3 command center yet.

- [x] **Step 3: Implement dashboard card**

Add a compact command card below the dashboard tabs, with primary action, KPIs, risks, and secondary actions.

- [x] **Step 4: Run focused tests and validator**

Run:

```bash
npm test -- --run tests/unit/v3-command-center.test.js tests/unit/v3-dashboard-command-center.test.js --reporter=dot
npm run validate:v3-release
```

Expected: PASS.

### Task 3: Final Verification

- [x] **Step 1: Build**

Run: `npm run build`
Expected: exit 0.

- [x] **Step 2: Full unit suite**

Run: `npm test -- --run --reporter=dot`
Expected: all tests pass.

- [x] **Step 3: Product validators**

Run:

```bash
npm run validate:global-ux
npm run validate:layout
npm run validate:production-readiness
```

Expected: all validators pass.
