# Release 11.1 / 11.2 Closeout

Date: 2026-06-21

## Scope

- Release 11.1 hotfix: public product polish, branded authentication, controlled Google Auth, billing UX, settings UX, and removal of technical/public copy leaks.
- Release 11.2 legal pack: public legal pages, legal documentation, signup acceptance gate, and validation coverage.

## Implementation Summary

- Added branded login, signup, and auth callback flows.
- Gated Google Auth behind `VITE_ENABLE_GOOGLE_AUTH`.
- Added legal acceptance on signup before account creation.
- Added public legal pages and docs for privacy, terms, cookies, data processing, subscription policy, AI consent, security, LGPD requests, and financial disclaimer.
- Reworked public landing and pricing pages with user-facing copy and controlled go-live language.
- Reworked billing UI so common users cannot start checkout while controlled release is active, testers can test checkout, and premium users see premium state.
- Reworked settings into account, security, preferences, privacy/data, copilot, subscription, support, and about sections.
- Added focused validators and Cypress coverage for public copy, auth providers, branding, billing UX, settings UX, legal pack, and legal pages.
- Updated older Cypress contracts to match the current Release 11.1 user-facing copy and tester behavior.

## Validation Results

- `npm run build`: PASS
- `npm run test`: PASS, 78 files / 212 tests
- `npm run e2e`: PASS, 32 specs / 86 tests
- `npm run validate:billing`: PASS
- `npm run validate:payment-security`: PASS
- `npm run validate:entitlements`: PASS
- `npm run validate:production-readiness`: PASS
- `npm run validate:go-live-guards`: PASS
- `npm run validate:billing-ux`: PASS
- `npm run validate:public-copy`: PASS
- `npm run validate:page-layout`: PASS
- `npm run validate:auth-providers`: PASS
- `npm run validate:branding`: PASS
- `npm run validate:settings-ux`: PASS
- `npm run validate:legal-pack`: PASS
- `npm run validate:legal-pages`: PASS
- `npm run validate:layout`: PASS
- `npm run validate:ux`: PASS
- `npm run validate:secrets`: PASS
- `npm run validate:financial-consistency`: PASS
- `npm run validate:financial-engine`: PASS
- `npm run validate:ai-assist`: PASS
- `npm run validate:ai-actions`: PASS
- `npm run smoke:release11-local`: PASS
- `supabase db lint --linked --level warning --fail-on error`: PASS

## Notes

- No database migration was added for this closeout.
- No Edge Function redeploy was required by the frontend/legal changes in this pass.
- Public production domain/provider remains an operational step outside this code closeout.
