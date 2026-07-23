# LGPD Dossier

## Dados coletados

- Dados de conta: e-mail, identificador do usuario e associacao familiar.
- Dados financeiros informados pelo usuario: contas, cartoes, beneficios, receitas, despesas, metas, orcamentos, wishlist e automacoes.
- Dados operacionais: eventos de sistema, limites de uso, erros sanitizados e diagnosticos exportaveis.
- Dados de IA: prompts operacionais minimizados, consentimento, respostas e logs sem `finance_states` completo.

## Finalidade e base legal

- Execucao do servico contratado: organizacao financeira, planejamento e simulacoes.
- Consentimento: uso de IA e envio de query de produto para provedores externos de preco.
- Legitimio interesse operacional: seguranca, auditoria, antifraude, observabilidade e melhoria de estabilidade.

## IA e consentimento

O usuario deve poder habilitar ou revogar recursos de IA. Edge Functions fazem chamadas a provedores de IA; o browser nao chama Gemini diretamente e nao recebe chaves.

## Retencao e exclusao

Dados financeiros permanecem enquanto a conta estiver ativa ou enquanto houver obrigacao operacional. O usuario pode solicitar exclusao da conta/dados. Diagnosticos exportados devem ser sanitizados.

## Auditoria e logs

Eventos sao registrados em `system_events` com metadados sanitizados. Nao registrar tokens, secrets, `Authorization`, `finance_states` completo, payload bruto de provider ou chaves de API.

## Terceiros

- Supabase: autenticacao, banco de dados, Edge Functions e storage operacional.
- Gemini: IA server-side, quando habilitada.
- ValueSERP: somente provider de candidatos de preco via Edge Function.
- Provedor de pagamento: somente dados minimos de cobranca, plano, cliente e eventos de assinatura. Nao recebe dados financeiros do usuario.

## ValueSERP

Apenas a query de produto e enviada ao provider. Nao enviar dados financeiros, identidade pessoal, `finance_states`, historico financeiro, e-mail, user id ou chaves do projeto. A chave `VALUE_SERP_API_KEY` deve existir somente em Supabase Secrets.

Controles obrigatorios da Release 8:

- ValueSERP recebe apenas query de produto e identidade tecnica do produto.
- ValueSERP nao recebe e-mail.
- ValueSERP nao recebe `user_id`.
- ValueSERP nao recebe `finance_states`.
- ValueSERP nao recebe historico financeiro.
- ValueSERP nao recebe dados de cartao, conta, renda ou despesa.
- O browser nao chama ValueSERP diretamente.
- O bundle nao contem `VALUE_SERP_API_KEY`.
- Candidatos rejeitados nao entram em preco atual, melhor oferta compativel, historico valido ou decisao financeira.

## Dados financeiros

Dados financeiros sao usados para calculos locais/server-side autorizados. Respostas para IA e observabilidade devem ser minimizadas e mascaradas.

## Revogacao, exportacao e exclusao

- Revogar consentimento de IA em configuracoes.
- Exportar diagnostico pelo painel operacional.
- Solicitar exclusao de conta/dados por fluxo de suporte ou configuracao dedicada.

## Diagnosticos e logs

- Diagnostico exportavel deve ser sanitizado.
- Logs nao salvam token, segredo ou prompt completo.
- `system_events.metadata` deve conter apenas metadados operacionais minimizados.
- `Authorization`, `Bearer`, chaves de API e service_role nao devem aparecer em logs exportaveis.

## Billing, admin e testers

Controles obrigatorios da Release 10:

- Checkout, portal, cancelamento e webhook rodam somente em Edge Functions.
- O frontend nao contem segredo de gateway, webhook secret ou `service_role`.
- Gateway de pagamento nao recebe `finance_states`, historico financeiro, receitas, despesas, cartoes, beneficios, wishlist, metas, relatorios ou dados de IA.
- Webhook de billing valida assinatura antes de gravar eventos.
- Admin/tester nao acessa dados financeiros de outros usuarios.
- Convite de tester armazena hash do token e possui expiracao.
- Acoes administrativas sensiveis geram auditoria sanitizada.
