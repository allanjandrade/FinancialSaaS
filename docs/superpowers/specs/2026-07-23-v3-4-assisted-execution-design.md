# V3.4 Assisted Execution Design

## Objective

Version 3.4 turns the V3.3 proactive agenda into guided execution. The user should be able to click a priority in the Command Center and complete the next financial step without being thrown into an unrelated page or a generic form.

The release must make the system feel less like separate modules and more like one operating flow: diagnose, act, confirm, and return to the monthly command view.

## Product Principle

The agenda can recommend, prepare, and guide. It cannot silently mutate financial data.

Every meaningful write remains human-confirmed. If an action cannot be safely completed inside the assisted drawer, the drawer explains why and sends the user to the correct page with context preserved.

## Primary Experience

Clicking a proactive agenda item opens a right-side assisted execution drawer.

The drawer has three fixed layers:

1. Diagnosis
   - Why the action exists.
   - Which real data produced it.
   - Estimated monthly or annual impact when available.

2. Execution
   - Minimal contextual form or controls for the selected action.
   - Pre-filled values when the agenda already has reliable data.
   - Clear fallback route when the action is too broad for drawer execution.

3. Confirmation
   - Summary of the exact change.
   - Explicit confirmation button before writing.
   - Success state with the resulting next step.

## Initial Supported Actions

### `first-income`

Purpose: let a new user create the first income from the Command Center.

Drawer behavior:
- Show why safe spending and advanced forecasts are blocked.
- Collect description, amount, date, recurrence hint, and optional target account.
- Confirm before adding income.
- After success, refresh agenda and first-steps strip.

### `review-ocr`

Purpose: make OCR/import pending reviews prominent without duplicating the full Entries workflow.

Drawer behavior:
- Show pending count and source type.
- Explain that imported rows still require review.
- Provide a primary action that navigates to `/entries` with review context.
- No direct write inside the drawer for OCR rows in 3.4.

### `subscription-charge`

Purpose: act on an upcoming subscription charge.

Drawer behavior:
- Show service name, due date, amount, and payment method if known.
- Offer quick actions: open service URL, pause subscription, cancel logically, edit next billing date.
- Any pause/cancel/edit requires confirmation.
- If the subscription has no URL, show a clean missing-link state instead of a dead button.

### `cut-dispensable-subscriptions`

Purpose: turn recurring savings into an actionable cut review.

Drawer behavior:
- List dispensable active subscriptions ordered by monthly equivalent.
- Show potential monthly and annual savings.
- Allow selecting one or more subscriptions for pause/cancel simulation.
- Confirm each real status change before writing.

### `create-first-goal`

Purpose: convert available margin into a first goal.

Drawer behavior:
- Collect goal name, target amount, current amount, deadline, and monthly contribution.
- Pre-suggest simple goals such as emergency reserve only as selectable suggestions, not hardcoded data.
- Confirm before creating the goal.

## Architecture

### Domain Module

Create `src/domain/v3/actionExecution.js`.

Responsibilities:
- Map proactive agenda items to execution descriptors.
- Decide whether the action is executable in drawer or route-only.
- Build confirmation summaries.
- Build post-success agenda hints.
- Stay pure and testable.

Public API:
- `buildAssistedExecution(item, context)`
- `buildExecutionConfirmation(execution, draft)`
- `executionFactsForAI(execution)`

The module must not import Vue, Pinia, router, or browser APIs.

### Agenda Contract Extension

Extend `src/domain/v3/proactiveOrchestrator.js` so agenda items include:

- `executionType`
- `executionMode`: `drawer`, `route`, or `unsupported`
- `requiresConfirmation`
- `contextKey`

Existing consumers must keep working if they only use `route`, `title`, `description`, and `priority`.

### UI Components

Create a shell component:
- `src/components/v3/AssistedActionDrawer.vue`

Create focused action panels:
- `src/components/v3/actions/IncomeActionForm.vue`
- `src/components/v3/actions/OcrReviewAction.vue`
- `src/components/v3/actions/SubscriptionActionPanel.vue`
- `src/components/v3/actions/SubscriptionCutReview.vue`
- `src/components/v3/actions/GoalActionForm.vue`

The drawer shell owns layout, open/close state, diagnosis, confirmation, and success. Action panels own only their local draft state and validation.

### Command Center Integration

`CommandCenter.vue` should:
- Keep `runAction(action)` as the entry point.
- Open the drawer when `action.executionMode === 'drawer'`.
- Navigate to `action.route` when the action is route-only.
- Recompute agenda after successful writes.

The page should not grow into a large procedural controller. If command actions need store writes, wrap them in small local handlers or store methods.

### Store Integration

Use existing finance store methods where available. Add small store methods only when they represent real domain operations:
- add income
- create planning goal
- pause/cancel subscription
- update subscription billing date

Do not add generic mutation helpers that accept arbitrary patches from the drawer.

## Data Safety

No assisted action may write automatically on drawer open.

Every write flow must include:
- visible draft
- confirmation summary
- explicit user confirmation
- success or error state

Destructive or status-changing actions, such as pause/cancel subscription, must reuse the existing confirmation pattern and visual hierarchy.

## AI Integration

The consultative AI should receive assisted execution facts only as context. It may explain the active execution and why it matters, but it must not invoke writes directly.

3.4 may expose:
- current execution type
- action title
- confirmation requirement
- estimated impact
- fallback route

The AI response should remain grounded in the real agenda and execution descriptor.

## UX Rules

- Drawer opens from the right on desktop and as a full-height sheet on mobile.
- Width target: 420px to 520px on desktop.
- Use dense, readable layout instead of stacked cards.
- Keep one primary action visible at a time.
- Empty or missing data states must explain the next action, not expose raw technical gaps.
- The drawer must be keyboard dismissible and trap focus while open.

## Out Of Scope

- Full automation engine.
- Open Finance connection.
- Background scheduled writes.
- AI-triggered mutations.
- Rebuilding Entries, Subscriptions, Goals, or the finance store.
- Bulk OCR review inside the drawer.

## Acceptance Criteria

- Command Center agenda items can open an assisted drawer.
- First income can be created through the drawer with confirmation.
- Subscription actions can pause/cancel/edit billing date through confirmation.
- Dispensable subscription review shows monthly and annual savings before changes.
- OCR review action has a clean route fallback to Entries.
- Create-first-goal action can create a basic goal through confirmation.
- No write happens before confirmation.
- Agenda recomputes after successful actions.
- AI receives execution facts without gaining mutation authority.
- Release metadata updates to 3.4.0.

## Test Plan

Unit/domain:
- agenda items expose execution metadata
- execution descriptors map supported action types
- route-only fallback is explicit for OCR review
- confirmation summaries describe exact writes
- unsupported actions do not write

UI contracts:
- Command Center imports and renders `AssistedActionDrawer`
- drawer opens for drawer-mode actions
- route-mode actions still navigate
- confirmation layer appears before any write
- success state refreshes the agenda

Store/behavior:
- first income write uses existing state shape
- goal creation uses existing goal shape
- subscription pause/cancel/edit uses existing subscription helpers
- errors leave drawer open with actionable message

Release:
- `npm test -- --run --reporter=dot`
- `npm run validate:v3-release`
- `npm run build`

## Risks And Mitigations

Risk: the drawer becomes a second copy of every page.
Mitigation: only implement minimal action panels; complex workflows route to the owning page.

Risk: confirmation logic becomes inconsistent.
Mitigation: centralize confirmation summary generation in `actionExecution.js` and reuse existing confirmation visual patterns.

Risk: Command Center becomes too procedural.
Mitigation: keep execution mapping in domain and keep write handlers small.

Risk: user expects AI to execute actions.
Mitigation: keep AI facts explanatory and require explicit UI confirmation for all writes.
