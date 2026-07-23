# Runbook de suporte

## Usuario nao consegue logar

Verificar Supabase Auth, email confirmado e erro exibido. Nao solicitar senha.

## Usuario nao ve plano premium

Verificar `billing_subscriptions`, `entitlements-resolve` e status `active`/`past_due`.

## Pagamento aprovado mas feature nao liberou

Verificar webhook assinado, evento em `billing_events` e assinatura vigente.

## Tester expirou

Verificar `beta_testers.access_expires_at`. Reativar somente com justificativa.

## Convite nao funciona

Verificar status do convite, expiracao e hash do token.

## Price-search falha

Verificar `price-search`, secrets server-side e logs sanitizados.

## Consultor preditivo falha

Verificar `advisor-report`, `predictive-snapshot` e entitlements.

## Erro 403 legitimo

Confirmar role, entitlement e policy. Nao burlar RLS.

## OCR falha

Usar revisao manual e preservar arquivo do usuario.

## Cancelamento

Usar portal/cancelamento server-side; nao apagar dados financeiros.

## Exclusao de conta/dados

Seguir fluxo LGPD e registrar auditoria sanitizada.
