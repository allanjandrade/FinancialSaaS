# Release 10 - Privacidade de admin e testers

## Admin

- Admins gerenciam roles, convites, feature flags, overrides e auditoria operacional.
- Admin/tester nao acessa dados financeiros de outro usuario nesta release.
- Toda acao administrativa sensivel deve gerar log sanitizado em `admin_audit_logs`.
- `user_id`, role e permissoes enviados pelo cliente nunca sao aceitos como identidade confiavel.

## Testers

- Convites guardam apenas hash do token.
- O token bruto e exibido somente no momento da criacao do convite.
- Acesso de tester possui status, escopo e expiracao.
- Feedback de tester deve ser vinculado ao proprio usuario autenticado.

## Feature flags e entitlements

- Feature flag global define disponibilidade padrao.
- Override por usuario precisa de justificativa.
- Expiracao de override/tester e respeitada na resolucao de entitlements.
- Frontend pode esconder recursos, mas a decisao final deve ser server-side.

## Proibicoes

- Nada de `service_role` no frontend.
- Nada de painel admin expondo dados financeiros de usuarios.
- Nada de bypass por payload forjado.
- Nada de log com secrets, tokens, payload de gateway ou `finance_states`.
