# Design: Release 3.3.0 - Orquestracao Financeira Proativa

Data: 2026-07-23
Status: design aprovado pelo usuario; aguardando planejamento de implementacao
Direcao aprovada: 3.3.0 incremental forte

## Objetivo

Transformar o aplicativo de um conjunto de paineis financeiros sofisticados em um sistema que conduz o usuario com prioridade, agenda e proxima acao clara.

A versao 3.3.0 deve aproveitar a base 3.0, 3.1 e 3.2: comando financeiro, conciliacao/importacao, assinaturas, wishlist, contas, lancamentos, familia e IA consultiva. O salto agora nao e visual isolado. O salto e de comportamento: o sistema deve dizer o que merece atencao primeiro, por que isso importa e qual acao segura pode ser tomada.

## Problema Atual

O produto ja tem muitos modulos relevantes, mas o usuario ainda precisa interpretar varias telas para decidir o que fazer:

- O comando mensal mostra score e plano, mas ainda nao organiza uma agenda de execucao do periodo.
- Alertas, automacoes, assinaturas, lancamentos e previsoes vivem em fluxos diferentes.
- A IA recebe dados reais em alguns pontos, mas ainda nao atua como camada de orquestracao do produto.
- Onboarding e estados vazios melhoraram, mas ainda nao conduzem o usuario por uma sequencia operacional curta.
- Acoes importantes podem competir visualmente com informacoes secundarias.
- O sistema ainda pode parecer analitico demais para quem quer apenas saber a proxima decisao correta.

## Principios da Release

1. Uma tela principal deve responder: "o que eu faco agora?"
2. Cada recomendacao precisa ter motivo, impacto e acao.
3. Alertas devem ser priorizados por risco financeiro, prazo e reversibilidade.
4. IA nunca deve inventar dado, executar silenciosamente ou substituir confirmacao do usuario.
5. Dados ausentes geram orientacao de preenchimento, nao metricas falsas.
6. A agenda deve considerar compromissos reais: assinaturas, cartao, contas, metas, importacoes pendentes e wishlist.
7. O sistema deve preferir listas fluidas, trilhas e blocos de decisao a uma pagina cheia de cards soltos.
8. Toda acao sugerida deve apontar para a tela certa com contexto suficiente.
9. A release nao deve reescrever a store financeira nem mudar calculos sem necessidade direta de orquestracao.
10. A versao deve ser validavel por contratos automatizados, nao apenas por avaliacao visual.

## Escopo Funcional

### 1. Agenda Financeira do Periodo

Objetivo:

- Criar uma camada de agenda que transforma dados financeiros em itens priorizados de execucao.
- Mostrar proximas cobrancas, tarefas pendentes, riscos e oportunidades em uma sequencia clara.

Entradas esperadas:

- Receitas e despesas do periodo atual.
- Assinaturas ativas, testes gratis e renovacoes proximas.
- Faturas/cartoes e contas vinculadas quando disponiveis.
- Lancamentos pendentes de OCR/importacao.
- Metas, reservas, wishlist e simulacoes.
- Alertas de automacao existentes.

Saida esperada:

- Lista priorizada com tipo, titulo, descricao, impacto financeiro, prazo, rota de destino e acao primaria.
- Agrupamentos por horizonte: hoje, proximos 7 dias, este mes e depois.
- Marcadores de risco: baixo, atencao, critico.
- Indicador de dados faltantes quando a agenda nao puder calcular algo com confianca.

Arquivos provaveis:

- `src/domain/v3/proactiveOrchestrator.js`
- `tests/unit/v3-proactive-orchestrator.test.js`
- `src/views/CommandCenter.vue`

### 2. Central de Comando Proativa

Objetivo:

- Evoluir a tela de comando para exibir plano acionavel, agenda e contexto de decisao.
- Reduzir leitura passiva de KPI e aumentar continuidade operacional.

Estrutura esperada:

- Faixa principal com a melhor proxima acao.
- Agenda do periodo em formato de trilha/lista, nao grade de cards.
- Painel de impacto mostrando quanto esta comprometido e o que pode ser evitado.
- Secao de bloqueios: dados faltantes, importacoes pendentes ou contas nao vinculadas.
- Links contextuais para lancamentos, assinaturas, planejamento, wishlist e contas.

Regras de UX:

- Quando nao houver receita cadastrada, a acao primaria deve ser cadastrar receita, nao calcular capacidade de gasto.
- Quando houver cobranca proxima, a agenda deve mostrar data, valor, origem e acao.
- Quando houver OCR/importacao pendente, isso deve subir de prioridade.
- Quando uma assinatura dispensavel estiver ativa, o sistema deve mostrar economia mensal/anual possivel.

Arquivos provaveis:

- `src/views/CommandCenter.vue`
- `src/components/v3/FinancialAgenda.vue`
- `src/components/v3/NextBestAction.vue`
- `tests/unit/v3-command-center-proactive.test.js`

### 3. IA Consultiva como Explicadora da Agenda

Objetivo:

- Fazer a IA explicar a agenda e responder perguntas usando os mesmos fatos da orquestracao.
- Evitar respostas genericas quando existem dados reais.

Comportamento esperado:

- A IA deve receber um resumo estruturado da agenda financeira.
- Perguntas como "o que faco primeiro?", "o que vence essa semana?" e "onde posso cortar?" devem usar os itens reais da agenda.
- A resposta deve explicar motivo, impacto e proxima acao.
- Se faltarem dados, a IA deve dizer exatamente quais dados faltam.

Fora do comportamento esperado:

- Nao executar cancelamento, exclusao ou lancamento sem confirmacao.
- Nao criar assinatura, despesa ou meta automaticamente.
- Nao afirmar economia ou risco sem base nos dados do usuario.

Arquivos provaveis:

- `src/api/financial-analyst.js`
- `src/views/IntelligenceCenter.vue`
- `src/domain/v3/proactiveOrchestrator.js`
- `tests/unit/v3-ai-proactive-agenda.test.js`

### 4. Alertas Priorizados e Menos Ruidosos

Objetivo:

- Consolidar alertas dispersos em uma fila priorizada.
- Evitar que alertas tecnicos ou repetidos prejudiquem a experiencia.

Tipos de alerta:

- Cobranca de assinatura proxima.
- Fatura/cartao com impacto relevante.
- Despesa recorrente detectada sem assinatura vinculada.
- Importacao/OCR aguardando revisao.
- Receita ausente no mes atual.
- Meta em risco.
- Compra da wishlist que nao deve ser feita agora.
- Assinatura dispensavel ainda ativa.

Regras:

- Alertas criticos aparecem antes de sugestoes.
- Alertas resolvidos ou ignorados nao devem reaparecer imediatamente.
- Estados tecnicos como `stable`, `undefined`, nomes internos ou erros brutos nunca aparecem para o usuario.
- Cada alerta deve ter acao primaria, acao secundaria opcional e rota de destino.

Arquivos provaveis:

- `src/domain/v3/proactiveOrchestrator.js`
- `src/utils/simple-automation-rules.js`
- `src/views/Automations.vue`
- `tests/unit/v3-prioritized-alerts.test.js`

### 5. Onboarding Operacional Curto

Objetivo:

- Criar um modo de primeiros passos que ativa a agenda sem sobrecarregar o usuario novo.

Fluxo esperado:

1. Cadastrar primeira receita.
2. Cadastrar ou importar primeira despesa.
3. Criar primeira meta ou reserva.
4. Revisar resumo do mes.

Regras:

- Enquanto faltarem dados minimos, ocultar metricas que dependem desses dados.
- Mostrar CTAs diretos para cada passo.
- Nao exibir dezenas de categorias antes de haver contexto.
- A tela inicial deve mostrar progresso e proxima acao, nao varios blocos zerados.

Arquivos provaveis:

- `src/views/Onboarding.vue`
- `src/views/CommandCenter.vue`
- `src/utils/release7-ux.js`
- `tests/unit/v3-3-onboarding-mode.test.js`

### 6. Metadata da Release

Objetivo:

- Promover a aplicacao para 3.3.0 com rastreabilidade.

Alteracoes esperadas:

- Atualizar `package.json` e `package-lock.json` para `3.3.0`.
- Atualizar `src/config/app-version.js`.
- Criar `docs/releases/RELEASE3_3_0.md`.
- Atualizar `CHANGELOG.md` e `README.md`.
- Atualizar `scripts/validate-v3-release.js` para validar a nova release.

## Fora de Escopo

- Open Finance real.
- Reescrita completa da store financeira.
- Novo framework de UI.
- Nova estrutura de banco obrigatoria.
- Execucao automatica de acoes financeiras sem confirmacao.
- Cancelamento real de servicos externos por API.
- Refazer landing page publica.
- Redesenhar todas as paginas novamente sem relacao direta com a agenda.

## Fluxo de Dados

1. Stores e domain services atuais continuam como fonte de dados.
2. A nova camada `proactiveOrchestrator` recebe um snapshot do estado financeiro.
3. A camada retorna agenda, melhor proxima acao, bloqueios e fatos para IA.
4. `CommandCenter.vue` renderiza a agenda e envia o usuario para rotas de acao.
5. `financial-analyst.js` recebe os mesmos fatos para explicar recomendacoes.
6. Automacoes e alertas passam a poder consumir prioridades calculadas, sem duplicar regra de negocio.

## Tratamento de Erros e Estados Vazios

- Se nao houver receita, orientar cadastro de receita.
- Se nao houver dados suficientes para projetar saldo, informar o dado faltante.
- Se nao houver assinaturas, nao inventar economia possivel.
- Se uma data estiver ausente, nao criar prazo ficticio.
- Erros tecnicos devem virar mensagens acionaveis.
- A agenda deve ter estado vazio util: "Complete receita, primeira despesa e meta para ativar sua agenda financeira."

## Testes Obrigatorios

Criar ou atualizar testes para:

- Agenda priorizando receita ausente antes de recomendacoes de gasto.
- Agenda mostrando cobranca de assinatura nos proximos 7 dias.
- Agenda subindo importacao/OCR pendente.
- Agenda sugerindo corte de assinatura dispensavel com impacto mensal/anual.
- Agenda direcionando cada acao para a rota correta.
- IA recebendo e respondendo com fatos reais da agenda.
- Alertas nao exibindo estados tecnicos crus.
- Onboarding mostrando primeiros passos e ocultando metricas sem dados.
- Versionamento 3.3.0 validado por `validate:v3-release`.
- Build de producao passando.

## Criterios de Aceite

- `npm test -- --run --reporter=dot` passa.
- `npm run build` passa.
- `npm run validate:v3-release` passa.
- A tela de comando mostra uma melhor proxima acao clara.
- A agenda do periodo usa dados reais e rotas corretas.
- A IA explica a agenda com fatos do usuario.
- Estados vazios orientam o proximo passo sem metricas falsas.
- Alertas priorizados nao mostram labels tecnicas.
- A release esta documentada em `docs/releases/RELEASE3_3_0.md`.
- `package.json`, `package-lock.json`, runtime version e README apontam para `3.3.0`.

## Ordem Recomendada de Implementacao

1. Criar testes de contrato da agenda 3.3.
2. Criar `proactiveOrchestrator` como modulo puro e testavel.
3. Integrar a agenda no `CommandCenter.vue`.
4. Adicionar componentes de apresentacao da agenda.
5. Conectar fatos da agenda na IA consultiva.
6. Ajustar alertas priorizados e estados vazios.
7. Ajustar onboarding operacional curto.
8. Atualizar metadata, changelog e validador da release.
9. Rodar testes, validador e build.

## Riscos

- Misturar orquestracao com store pode aumentar acoplamento. A regra deve ficar em modulo puro.
- Criar recomendacoes sem dados suficientes pode quebrar confianca. Melhor bloquear com orientacao clara.
- Excesso de alertas pode transformar a agenda em outra tela poluida.
- Alterar muitas telas em paralelo pode reintroduzir aspecto remendado. A 3.3 deve orbitar a central de comando, IA e onboarding.

## Decisao

Seguir com 3.3.0 - Orquestracao Financeira Proativa.

A release deve aprofundar o comportamento do produto: menos paineis passivos, mais conducao financeira com prioridade, explicacao e acao segura.
