# Release 11 Final Closeout

Data: 2026-06-20

## Status

Release 11 validada para fechamento técnico local e publicação da função alterada.

Go-live público real permanece condicionado à escolha futura de domínio/provedor de hospedagem, conforme decisão operacional do projeto.

## Escopo entregue

- Landing pública em `/`.
- Login e signup públicos em `/login` e `/signup`.
- Documentos legais públicos em `/privacy`, `/terms` e `/cookies`.
- Página pública de planos em `/pricing`.
- App autenticado centralizado em `/dashboard`.
- Redirecionamento pós-login e pós-onboarding para `/dashboard`.
- Controle frontend de menus por tipo de conta: comum, tester, premium, support, admin e owner.
- Checkout em modo controlado `testers_only`.
- Health-check remoto seguro, sem payload financeiro ou segredos.
- Runbooks de produção, domínio, ambiente, beta testers, billing e rollback.

## Correções durante o gate

- `Login.vue`: adicionou marcador estável `data-testid="login-page"` e redireciona login para `/dashboard`.
- `Onboarding.vue`: conclusão do onboarding agora redireciona para `/dashboard`.
- `production-go-live.js`: sanitização de health-check preservada sem expor assinatura textual sensível no bundle.
- Cypress antigo atualizado para o novo contrato da Release 11: `/` e landing pública, `/dashboard` e app autenticado.
- Teste do assistente contextual ajustado para comparar estado financeiro depois da normalização inicial da tela e antes da chamada de IA.

## Validação local

- `npm run build`: PASS
- `npm run test`: PASS, 76 arquivos / 206 testes
- Cypress focado Release 11: PASS, 4/4
- `npm run e2e`: PASS, 30 specs / 84 testes
- `npm run validate:navigation`: PASS
- `npm run validate:layout`: PASS
- `npm run validate:ux`: PASS
- `npm run validate:secrets`: PASS
- `npm run validate:production-readiness`: PASS
- `npm run validate:financial-consistency`: PASS
- `npm run validate:financial-engine`: PASS
- `npm run validate:ai-assist`: PASS
- `npm run validate:ai-actions`: PASS
- `npm run validate:admin-access`: PASS
- `npm run validate:tester-access`: PASS
- `npm run validate:entitlements`: PASS
- `npm run validate:billing`: PASS
- `npm run validate:payment-security`: PASS
- `npm run validate:production-config`: PASS
- `npm run validate:legal-pages`: PASS
- `npm run validate:go-live-guards`: PASS
- `npm run smoke:release11-local`: PASS

## Validação remota

- `supabase functions deploy health-check`: PASS
- `supabase db lint --linked --level warning --fail-on error`: PASS

Observação: a chamada HTTP direta ao endpoint remoto foi bloqueada pelas permissões do ambiente Codex depois do deploy. O deploy da função e o lint remoto vinculado foram concluídos com sucesso.

## Pendências operacionais para go-live real

- Contratar e configurar provedor de hospedagem definitivo.
- Configurar domínio real e HTTPS.
- Atualizar URLs públicas finais em ambiente de produção.
- Executar smoke final contra domínio real após publicação.

## Decisão

Release 11 aprovada tecnicamente para a base atual.

Não há liberação de go-live público real sem domínio/provedor definitivo e smoke no ambiente final.
