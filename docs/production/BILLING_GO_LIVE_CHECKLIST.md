# Checklist de billing go-live

Estado inicial: `billing_checkout = testers_only`

- Checkout criado server-side.
- Portal criado server-side.
- Webhook valida assinatura.
- Evento de webhook e idempotente.
- Assinatura ativa libera entitlement.
- Cancelamento remove entitlement.
- `past_due` e tratado.
- Frontend nao define status de assinatura.
- Usuario comum nao acessa checkout no go-live controlado.
