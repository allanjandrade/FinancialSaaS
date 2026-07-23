# Incident: P0 User Isolation

Date: 2026-06-21
Severity: P0
Status: resolved

## Summary

A user-isolation gap was reported during the security hotfix review: financial data could still be cached, loaded, or synchronized through family/global scopes instead of the authenticated user scope. The release is blocked until no user can read, mutate, delete, or receive cached financial data from another user.

## Risk

- User B could receive financial state created by user A if a shared/global storage or family-scoped state path was used.
- Edge Functions running with service-role privileges could be exposed to forged `user_id` inputs if the authenticated user was not derived from the JWT before any financial operation.
- Wishlist and purchase flows could persist or remove the wrong user's item if the owner was inferred from client-provided data.

## Root Cause

- Frontend financial state used a single browser storage key.
- Some remote sync paths selected `finance_states` by family context only.
- Shared Edge Function helpers did not require the caller user id in every state load.
- Purchase and wishlist flows accepted broad product payloads instead of a strict allowlist.

## Containment And Fixes

- Financial browser storage is now scoped as `controle-financeiro-app-v2:{userId}`.
- In-memory finance state resets whenever the auth session changes.
- `finance_states` now has a required `user_id`, unique user ownership, forced RLS, and policies based on `auth.uid() = user_id`.
- Service-role Edge Functions derive user identity from the JWT and ignore/reject client identity overrides.
- AI action confirm/revert, financial engines, predictive engines, reports, automations, and price monitor state loads are filtered by user id.
- New purchase/wishlist creation rejects identity fields and writes through the logged-in finance store user.
- Wishlist delete removes only the authenticated user's own item.
- Security validators, Cypress specs, and an authenticated smoke were added for user isolation.

## Required Closure Evidence

- `npm run build`: PASS
- `npm run test`: PASS, 84 files / 227 tests
- `npx cypress verify`: PASS
- `npm run e2e`: PASS, 34 specs / 88 tests
- `npm run validate:financial-consistency`: PASS
- `npm run validate:financial-engine`: PASS
- `npm run validate:ai-assist`: PASS
- `npm run validate:ai-actions`: PASS
- `npm run validate:user-isolation`: PASS
- `npm run validate:rls-security`: PASS
- `supabase db push --dry-run`: PASS
- `supabase db push`: PASS
- `supabase db lint --linked --level warning --fail-on error`: PASS
- `npm run smoke:security-user-isolation`: PASS

## Closure Criteria

- `user_b_can_read_user_a = false`
- `frontend_cache_leak = false`
- `new_purchase_uses_logged_user = true`
- `user_b_can_read_user_a_wishlist = false`
- `user_b_can_delete_user_a_item = false`
- `direct_route_cross_user_denied = true`
- No global financial storage residue after authenticated load.

## Final Smoke Result

```json
{
  "status": "PASS",
  "user_b_can_read_user_a": false,
  "forged_user_id_select": 200,
  "forged_user_id_upsert": 403,
  "frontend_cache_leak": false,
  "new_purchase_uses_logged_user": true,
  "wishlist_user_a_visible_only_to_a": true,
  "user_b_can_read_user_a_wishlist": false,
  "user_b_can_delete_user_a_item": false,
  "deleted_item_hidden": true,
  "direct_route_cross_user_denied": true
}
```

`forged_user_id_select` returns HTTP 200 with an empty result under RLS; the denial criterion is `user_b_can_read_user_a = false`.
