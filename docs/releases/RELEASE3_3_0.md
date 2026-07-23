# Release 3.3.0 - Orquestracao Financeira Proativa

## Objetivo

Transformar a Central de Comando em uma camada proativa que prioriza agenda, melhor proxima acao, bloqueios de dados, alertas e fatos explicaveis pela IA.

## Principais mudancas

- Novo orquestrador puro em `src/domain/v3/proactiveOrchestrator.js`.
- Agenda financeira agrupada por horizonte: hoje, proximos 7 dias, este mes e depois.
- Melhor proxima acao calculada com prioridade, motivo, impacto e rota.
- Primeiro fluxo operacional para usuarios sem dados minimos.
- Central de Comando com componentes V3.3 dedicados para acao, agenda e primeiros passos.
- IA consultiva recebendo fatos da agenda para explicar o que fazer primeiro com dados reais.
- Validador de release atualizado para 3.3.0.

## Validacao esperada

- `npm test -- --run --reporter=dot`
- `npm run validate:v3-release`
- `npm run build`
