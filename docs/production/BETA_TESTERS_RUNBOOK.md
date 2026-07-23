# Runbook de beta testers

Grupo de go-live: `release11-production-beta`

## Convidar tester

Use o painel Admin > Testers. O convite gera token bruto uma unica vez e salva somente hash.

## Revogar tester

Use a acao administrativa de revogacao. O tester deve perder entitlements beta apos revogacao ou expiracao.

## Liberar feature

Use Admin > Feature flags ou override com justificativa. Toda liberacao deve ter audit log.

## Ver feedback

Consultar `tester_feedback` e logs administrativos sanitizados.

## Encerrar beta

Revogar testers expirados, remover overrides temporarios e migrar usuarios elegiveis para plano pago.
