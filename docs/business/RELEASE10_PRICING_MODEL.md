# Release 10 - Modelo de precificacao

## Planos

- Free: uso pessoal inicial com limites baixos de busca de preco, wishlist, perguntas de IA, OCR e entidades basicas.
- Premium mensal: R$ 19,90 por mes, com planejamento preditivo, simulacao de cenarios, relatorios avancados, automacoes seguras, busca de preco ampliada e exportacao.
- Premium anual: R$ 199,00 por ano, equivalente a desconto frente ao mensal.
- Family e Pro: reservados para fases futuras, sem liberacao comercial nesta release.

## Premissas unitarias

- Gateway: 4,99% por cobranca.
- Impostos/encargos: 8%.
- Custo variavel estimado: R$ 2,40 por assinante premium ativo.
- Custo fixo mensal de operacao: R$ 2.500,00.
- Ticket principal: R$ 19,90.

## Metricas de decisao

- Receita liquida por assinante: preco menos gateway, impostos e custo variavel.
- Margem esperada: acima de 50% no plano premium mensal.
- Break-even: calculado a partir do custo fixo dividido pela receita liquida por assinante.
- LTV conservador: receita liquida mensal multiplicada por tempo medio de retencao.
- CAC maximo: ate 30% do LTV conservador.

## Regras de cobranca

- Checkout, portal, cancelamento e webhooks acontecem somente em Edge Functions.
- O frontend nunca recebe segredo de gateway, service_role ou webhook secret.
- Dados financeiros do usuario nao sao enviados ao gateway.
- O status de assinatura nao e aceito como verdade pelo frontend; entitlements sao resolvidos no servidor.
