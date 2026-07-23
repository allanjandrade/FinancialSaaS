# Release 10 - Final closeout

Data: 2026-06-20

## Escopo entregue

- Billing server-side com checkout, portal, cancelamento, status de assinatura e webhook assinado.
- Modelo de planos Free, Premium mensal e Premium anual com entitlements e limites de uso.
- Admin controlado com roles, testers, feature flags, overrides, uso e auditoria sanitizada.
- Convites de tester com hash de token, expiracao e aceite autenticado.
- Feature gating e paywall no frontend, sem aceitar assinatura ativa vinda do cliente como verdade.
- Documentacao de preco, privacidade de billing, privacidade de admin/testers e atualizacao do dossie LGPD.

## Controles de seguranca

- Nenhum segredo de gateway, service role ou webhook no frontend.
- Gateway nao recebe `finance_states`, historico financeiro, cartoes, beneficios, wishlist, metas, relatorios ou dados de IA.
- Webhook rejeita payload sem assinatura valida antes de gravar eventos.
- Chamadas com `user_id`/identidade forjada sao rejeitadas pelo backend.
- Admin/tester nao acessa dados financeiros de outros usuarios.
- Acoes administrativas sensiveis geram auditoria com metadata sanitizada.

## Migrations aplicadas

- `20260620120000_release10_billing_admin_testers.sql`
- `20260620123500_release10_service_role_grants.sql`

## Edge Functions deployadas

- `billing-create-checkout`
- `billing-webhook`
- `billing-customer-portal`
- `billing-subscription-status`
- `billing-cancel-subscription`
- `admin-current-user`
- `admin-list-users`
- `admin-set-user-role`
- `admin-invite-tester`
- `admin-revoke-tester`
- `admin-set-feature-override`
- `admin-list-feature-flags`
- `admin-update-feature-flag`
- `admin-audit-log`
- `tester-accept-invite`
- `tester-status`
- `entitlements-resolve`

## Gates locais

- Snapshot pre-change: `backups/release-10-prechange-20260620-113204/project-source.zip`
- SHA-256: `922BD3534F1FF0AAA63B043BBC5CF7EE56D4E43E3DBFE3AD2472672AB6EC15A1`
- `npm run build`: PASS
- `npm run test`: PASS, 69 arquivos / 197 testes
- `npm run e2e`: PASS, 26 specs / 76 testes
- Cypress Release 10 isolado: PASS, 5 specs / 9 testes

## Validadores

- `validate:financial-consistency`: PASS
- `validate:financial-engine`: PASS
- `validate:ai-assist`: PASS
- `validate:ai-actions`: PASS
- `validate:automations`: PASS
- `validate:observability`: PASS
- `validate:ux`: PASS
- `validate:planning`: PASS
- `validate:layout`: PASS
- `validate:secrets`: PASS
- `validate:navigation`: PASS
- `validate:valueserp-price-search`: PASS
- `validate:rls-security`: PASS
- `validate:production-readiness`: PASS
- `validate:predictive-engine`: PASS
- `validate:advisor`: PASS
- `validate:release8-core`: PASS
- `validate:billing`: PASS
- `validate:pricing-model`: PASS
- `validate:payment-security`: PASS
- `validate:admin-access`: PASS
- `validate:tester-access`: PASS
- `validate:entitlements`: PASS

## Gates remotos

- `supabase db push --dry-run`: PASS
- `supabase db push`: PASS
- `supabase db lint --linked --level warning --fail-on error`: PASS, sem erros de schema
- Deploy das Edge Functions da Release 10: PASS
- `smoke:release10-remote`: PASS
- `smoke:release10-admin-testers-remote`: PASS

## Resultado dos smokes remotos

Billing:

```json
{
  "status": "PASS",
  "subscription": "free",
  "forged_user_id_status": 403,
  "checkout_without_jwt_status": 401,
  "invalid_webhook_status": 401,
  "financial_payload_sent": false
}
```

Admin/testers:

```json
{
  "status": "PASS",
  "admin_role": "user",
  "unauthorized_admin_status": 403,
  "entitlements_plan": "free",
  "tester_active": false
}
```

## Decisao

Release 10 aprovada no gate final.
