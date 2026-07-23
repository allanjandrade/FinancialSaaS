# Release 10 - Privacidade de billing

## Dados permitidos no gateway

- E-mail do usuario autenticado, quando necessario para criar cliente.
- Identificador tecnico do cliente de cobranca.
- Codigo do plano escolhido.
- Status de assinatura e identificadores de evento do gateway.

## Dados proibidos no gateway

- `finance_states`, historico financeiro, receitas, despesas, cartoes, beneficios, metas, orcamentos, wishlist, relatorios, prompts de IA e decisoes financeiras.
- Chaves Supabase, `service_role`, tokens de usuario e payloads internos brutos.

## Controles obrigatorios

- Webhook exige assinatura antes de gravar qualquer evento.
- Eventos de billing sao idempotentes por identificador externo.
- Logs de billing devem ser sanitizados.
- Checkout e portal sao criados server-side.
- O frontend apenas solicita a operacao autenticada e recebe uma URL de redirecionamento.

## Retencao

Eventos de billing ficam restritos a auditoria operacional, suporte, conciliacao e cumprimento de obrigacoes legais. Dados financeiros do produto permanecem separados do provedor de pagamento.
