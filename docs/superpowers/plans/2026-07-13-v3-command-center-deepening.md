# V3 Command Center Deepening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Version 3.0.0 into an execution-first financial command center with score, prioritized monthly plan, route, dashboard entry point, navigation, and AI facts.

**Architecture:** Extend the existing pure V3 domain module with scoring and action-plan builders, then consume that single output from a new `CommandCenter.vue` route and the existing dashboard card. Keep the IA integration as structured facts so current analyst flows can explain the same plan without inventing generic advice.

**Tech Stack:** Vue 3, Vue Router, Pinia finance store, Vitest, existing CSS tokens.

---

### Task 1: Deep Domain Contract

**Files:**
- Modify: `src/domain/v3/commandCenter.js`
- Create: `tests/unit/v3-command-center-deep.test.js`

- [x] **Step 1: Write failing tests**

Cover `buildV3FinancialScore`, `buildV3ActionPlan`, `buildV3CommandCenter`, and `v3CommandFactsForAI`.

- [x] **Step 2: Run tests and confirm failure**

Run: `npm test -- --run tests/unit/v3-command-center-deep.test.js --reporter=dot`
Expected: FAIL because deep V3 exports do not exist.

- [x] **Step 3: Implement score and plan**

Add score pillars, action priorities, estimated impact, and AI facts.

### Task 2: Route and UI

**Files:**
- Create: `src/views/CommandCenter.vue`
- Modify: `src/router/index.js`
- Modify: `src/router/navigation.js`
- Modify: `src/components/Sidebar.vue`
- Modify: `src/views/Home.vue`
- Create: `tests/unit/v3-command-center-route.test.js`

- [x] **Step 1: Write failing source contract**

Assert route, meta, navigation, dashboard CTA, and view test ids.

- [x] **Step 2: Run tests and confirm failure**

Run: `npm test -- --run tests/unit/v3-command-center-route.test.js --reporter=dot`
Expected: FAIL because the route and view do not exist.

- [x] **Step 3: Implement route and UI**

Render score, pillars, action plan, risks, and execution buttons.

### Task 3: V3 Release Gate

**Files:**
- Modify: `scripts/validate-v3-release.js`
- Modify: `docs/releases/RELEASE3_0_0.md`

- [x] **Step 1: Expand validator**

Require the deep command center route, view, score and AI facts.

- [x] **Step 2: Verify**

Run:

```bash
npm test -- --run tests/unit/v3-command-center-deep.test.js tests/unit/v3-command-center-route.test.js --reporter=dot
npm run validate:v3-release
npm run build
npm test -- --run --reporter=dot
```
