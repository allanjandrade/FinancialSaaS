# Fluid Ledger Global Design

## Objective

Replace the app-wide card-heavy visual language with a continuous financial interface that feels mature, institutional and operational. The product should stop reading as isolated boxes stacked on pages and start reading as a coherent financial ledger: headers, strips, tables, rails, contextual sidebars and precise dividers.

This is a global product upgrade. It applies to the authenticated app, public pages, pricing, authentication flows and legal/support pages.

## Approved Direction

- Visual direction: **Ledger fluido**.
- Scope: **entire product**.
- Card reduction level: **near-total elimination**.
- Implementation strategy: **hybrid in two layers**.

The product will first receive global surface and token changes that neutralize the current card look. Then the main surfaces will move toward explicit ledger components and page patterns.

## Problem

The current UI relies heavily on `.panel`, `.summary-card`, `.dashboard-panel`, `.app-card`, `.metric-card`, `.kpi-card` and page-local card classes. This creates:

- visual gaps between unrelated boxes;
- inconsistent density across pages;
- excessive shadows and rounded containers;
- repeated card grids that look assembled instead of designed;
- pages that feel more like stitched widgets than one financial system.

Because the card behavior is centralized in global CSS and repeated in page-level CSS, solving this only page by page would keep producing local fixes. The design system itself needs to change.

## Design Principles

1. **Continuity over containment**
   Use continuous page surfaces, horizontal bands, rows and dividers instead of standalone cards.

2. **Ledger density**
   Financial information should read like an operational ledger: aligned numbers, stable columns, strong row hierarchy and predictable scan paths.

3. **Cards are exceptions**
   Cards remain only for modals, empty states, marketplace/product result tiles, subscription/service tiles where repeated visual identity matters, toast/overlay surfaces and compact repeated objects that are inherently card-like.

4. **Headers belong to the page**
   Page heroes and section headers should integrate into the page surface. They should not float as decorative cards.

5. **Metrics become strips**
   KPIs should usually render as strips, inline stat groups or ledger summary rows, not as boxed cards.

6. **Tables and lists become primary UI**
   Where the system shows records, rows should be the main experience. Tables, grouped lists and action rows replace card mosaics.

7. **Fewer shadows, sharper hierarchy**
   Use borders, dividers, type, spacing and subtle background bands. Shadows become rare and reserved for floating UI such as menus, drawers and modals.

## Visual System

### Global Tokens

The token layer should introduce a ledger surface vocabulary:

- `--surface-page`: base page surface.
- `--surface-ledger`: main continuous content surface.
- `--surface-rail`: contextual side surface.
- `--surface-muted`: subtle band or row background.
- `--divider`: default row/section divider.
- `--divider-strong`: table header or major section divider.
- `--shadow-card`: should become visually near-flat.
- `--gradient-panel`: should stop creating a raised card effect.

Existing tokens can remain for compatibility, but their behavior should become flatter and more continuous.

### Surface Rules

Global classes should change behavior:

- `.panel`, `.summary-card`, `.dashboard-panel`, `.app-card` become ledger surfaces by default.
- They should use minimal border, little or no shadow, less radius and no hover lift.
- `.metric-card` and `.kpi-card` should move toward inline stat strips.
- Page-local card classes should either inherit the flattened treatment or be migrated to ledger classes.

### New Semantic Components

Add or formalize these reusable components:

- `LedgerPage`: full page frame with title/header and content rhythm.
- `LedgerSection`: continuous section with optional header and divider.
- `LedgerStrip`: horizontal KPI/stat strip.
- `LedgerTable`: table/list surface with dense rows and action affordances.
- `LedgerRail`: right-side contextual rail for alerts, next action and operational context.
- `LedgerEmptyState`: centered guidance surface, still allowed to feel like a contained object.

These names are implementation suggestions. If the codebase already has equivalent local components, they can be adapted instead of duplicating abstractions.

## Page-Level Application

### Authenticated App

Dashboard, Command Center, Analysis, Reports, Planning, Goals, Budget, Entries, Financial Structure, Card, Benefit, Subscriptions, Family, AI, Advisor, Automations, Settings and Operational pages should move to the ledger language.

Expected changes:

- page header integrated with content;
- KPI rows as strips;
- main data as tables/lists;
- contextual panels as rails;
- fewer nested bordered surfaces;
- action areas integrated into section headers or row controls.

### Public Pages

Landing and Pricing should also lose excessive card grids. They should become more institutional:

- hero as full-width narrative band;
- feature sections as rows or comparison tables;
- pricing as a clear plan comparison ledger instead of floating plan boxes where possible;
- trust/legal sections as structured bands.

### Authentication

Login, Signup, Forgot Password, Reset Password and Auth Callback should avoid "form card floating in empty space" as the primary impression. They can still contain a form surface, but the page should read as a split institutional surface with clean dividers, not a decorative card layout.

### Legal and Support

Legal pages, support and fallback pages should use continuous reading surfaces with strong typography and dividers. Standalone cards should be limited to callouts or action blocks.

## Exceptions

Cards are still acceptable for:

- modal/dialog surfaces;
- dropdowns, popovers and drawers;
- empty states;
- product/search result tiles;
- subscription/service identity tiles with logos;
- toasts and notifications;
- repeated compact objects where the card is the item itself;
- mobile-only containment when it improves touch usability.

Even in exceptions, cards should use the new flatter treatment unless elevation is required.

## Migration Strategy

### Layer 1: Global Deframing

Flatten the global surface system first:

- reduce `--shadow-card` and hover lift;
- reduce default radius for app surfaces;
- convert `.panel`, `.summary-card`, `.dashboard-panel`, `.app-card`, `.metric-card`, `.kpi-card` to ledger-style surfaces;
- add release contract tests ensuring shadows and card-heavy patterns do not return as defaults.

This should immediately reduce the amateur card-grid feel across the product.

### Layer 2: Semantic Ledger Components

Introduce reusable ledger components and migrate the most visible pages:

- Dashboard/Command Center;
- Entries;
- Financial Structure;
- Subscriptions;
- Public Landing/Pricing;
- Auth pages.

The migration should be incremental but visible. Each migrated page should replace card clusters with strips, rows, tables or rails.

### Layer 3: Page Cleanup

Remove local CSS that fights the ledger system:

- page-local `.panel` overrides that reintroduce shadows;
- repeated `box-shadow: var(--shadow-card)`;
- nested card layouts;
- hover transforms on static informational surfaces;
- unused card wrappers.

## Accessibility

- Rows and tables must remain keyboard navigable where interactive.
- Focus rings stay visible and must not depend only on shadows.
- Color contrast must remain valid in light and dark modes.
- Dense ledger layouts must preserve readable touch targets on mobile.
- If card removal reduces visual grouping, headers and dividers must restore semantic structure.

## Testing Strategy

Add contract tests for:

- global token flattening;
- `.panel`, `.app-card`, `.summary-card`, `.metric-card`, `.kpi-card` no longer acting as raised card defaults;
- new ledger components existing and using divider/strip semantics;
- key pages using ledger classes instead of card clusters;
- public/auth pages adopting the new surface language;
- no return of broad hover-lift behavior on static content surfaces.

Run:

- focused visual contract tests;
- page contract tests for migrated screens;
- full unit suite;
- production build.

## Acceptance Criteria

- The app no longer visually defaults to grids of floating cards.
- Global surfaces are flatter, continuous and more financial/institutional.
- Main authenticated pages use strips, tables, rails and dividers as primary layout tools.
- Public and auth pages no longer feel visually disconnected from the product.
- Cards remain only in documented exceptions.
- Build passes.
- Unit tests pass.
- New visual contract tests protect the ledger language from regression.

## Non-Goals

- No store or financial engine rewrite.
- No redesign of business logic.
- No automatic data migration.
- No new UI library.
- No full pixel-perfect redesign of every page in one pass; the global shift should be broad, then the highest-impact pages get explicit ledger components.
