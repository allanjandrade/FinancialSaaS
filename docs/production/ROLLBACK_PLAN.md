# Plano de rollback

## Frontend

Reverter para build anterior no provedor escolhido.

## Edge Functions

Redeployar versao anterior da funcao afetada.

## Feature flags

Flags de emergencia:

- `billing_checkout = false`
- `price_search = false`
- `ai_assist = false`
- `predictive_advisor = false`
- `automations = false`
- `maintenance_mode = true`

## Billing

Desabilitar checkout, manter portal/cancelamento e preservar dados.

## Testers

Revogar acesso beta ou reduzir expiracao.

## Modo manutencao

Bloqueia acoes nao essenciais e preserva login, leitura e exportacao basica.
