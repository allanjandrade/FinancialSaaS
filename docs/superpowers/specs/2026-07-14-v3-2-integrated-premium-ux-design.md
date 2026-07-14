# Design: Release 3.2.0 - Produto Integrado Premium

Data: 2026-07-14
Status: design aprovado pelo usuario; aguardando planejamento de implementacao
Direcao aprovada: B - Produto Integrado Premium

## Objetivo

Elevar a experiencia visual e operacional do aplicativo para a versao 3.2.0, removendo a sensacao de telas remendadas e transformando dashboard, inteligencia, lancamentos, contas, assinaturas e familia em partes de um mesmo produto.

A release deve entregar um salto perceptivel de qualidade sem reescrever a regra financeira. O foco e o sistema de experiencia: navegacao, hierarquia visual, componentes compartilhados, fluxo de tarefas e consistencia entre telas.

## Problema Atual

O produto ja possui boas capacidades financeiras, mas a camada de interface ainda carrega sinais de crescimento organico:

- Telas operacionais misturam CSS local, componentes antigos e componentes novos.
- Alguns botoes e paineis usam estilos paralelos, criando sensacao de produto fragmentado.
- `Lancamentos` tem boas funcoes, mas OCR, importacao, cadastro manual e revisao competem por atencao.
- `Contas e cartoes` ainda acumula muitos modos no mesmo espaco, com formularios e listagens disputando a tela.
- Informacoes tecnicas ou internas podem aparecer na UI quando falta uma camada de apresentacao.
- A navegacao ja esta mais coerente, mas ainda precisa reforcar contexto e continuidade entre areas.

## Principios da Release

1. Acao primaria sempre evidente, acao secundaria sempre discreta.
2. OCR deve ser o caminho preferencial para cadastrar despesas, sem repetir cards redundantes.
3. Cadastro manual deve existir, mas ficar recolhido ou em drawer/modal quando nao for o foco.
4. Telas vazias devem orientar o proximo passo, nao apenas dizer que nao ha dados.
5. Labels tecnicas nunca aparecem para o usuario final.
6. Formulario longo deve ser fatiado em blocos, drawer ou modal, conforme o contexto.
7. CSS local so deve existir para composicao especifica da tela; visual base vem de componentes/tokens.
8. Desktop deve usar duas colunas quando isso reduzir rolagem e aumentar clareza.
9. Mobile deve preservar foco em uma tarefa por vez.
10. A release nao deve alterar calculos financeiros sem necessidade direta de UX.

## Escopo Funcional

### 1. Shell Premium Integrado

Objetivo:

- Reforcar a estrutura do produto autenticado como um sistema unico.
- Melhorar a leitura da navegacao lateral e do contexto da pagina atual.
- Reduzir excesso visual sem esconder rotas importantes.

Diretrizes:

- Manter `Inteligencia` como grupo de destaque logo apos inicio/comando.
- Manter `Operacao` como grupo de execucao: lancamentos, contas, cartoes, beneficios, assinaturas e familia.
- Usar breadcrumb e PageHeader de forma consistente.
- Evitar barras cinzas, duplicidade de subtitulos e grupos redundantes.
- Preservar navegacao mobile inferior com poucas opcoes primarias e drawer para o restante.

Arquivos provaveis:

- `src/App.vue`
- `src/components/Sidebar.vue`
- `src/components/Topbar.vue`
- `src/components/layout/PageShell.vue`
- `src/components/layout/PageHeader.vue`
- `src/router/navigation.js`

### 2. Lancamentos como Fluxo Operacional Premium

Objetivo:

- Transformar `Lancamentos` em uma tela orientada a execucao rapida.
- Colocar OCR em evidencia como CTA principal.
- Remover redundancia entre OCR e importacao.
- Manter cadastro manual sem poluir a tela inicial.

Estrutura esperada:

- Hero operacional com CTA principal: `Escanear documento (OCR)`.
- CTA secundario para `Importar extrato`.
- Acao manual discreta: `Lancamento manual`.
- Bloco de metricas curto, apenas com informacoes acionaveis.
- Area principal para revisao pendente quando houver OCR/importacao.
- Cadastro manual em disclosure, drawer ou modal.
- Historico recente como lista limpa, com valores e status claros.
- Painel lateral de contexto com resumo do mes, alertas e origem financeira quando aplicavel.

Regras de UX:

- Nao exibir sugestao de origem se nao houver fonte realmente utilizavel.
- Nao mostrar CTA duplicado para OCR/importacao em mais de um card com a mesma funcao.
- Confirmacoes devem ser claras antes de criar lancamentos a partir de OCR/importacao.
- O usuario sempre revisa antes de salvar dados reconhecidos automaticamente.

Arquivo principal:

- `src/views/Entries.vue`

### 3. Contas e Cartoes como Hub Financeiro

Objetivo:

- Reduzir poluicao visual em `Contas e cartoes`.
- Separar visao, formulario e operacoes de massa.
- Fazer tabs reais parecerem parte estrutural da tela.

Estrutura esperada:

- Header limpo com CTA contextual.
- Tabs estruturadas para contas, cartoes, beneficios, familia, transferencias e paineis tecnicos.
- Na aba Contas:
  - KPIs no topo.
  - Listagem principal limpa.
  - Empty state centralizado com CTA.
  - Formulario em drawer/modal ou coluna lateral apenas quando aberto.
- Nas abas Cartoes/Beneficios/Familia:
  - Mesmo padrao de empty state, acao primaria e lista.
  - Acoes destrutivas protegidas por confirmacao.
- Paineis tecnicos como Auditoria, Pendencias e Integracoes devem ser visualmente secundarios.

Regras de UX:

- Remover qualquer card de perfil familiar que nao ajude no contexto da aba.
- Nao misturar cadastro, auditoria, sync e listagem como se tivessem a mesma prioridade.
- Labels devem estar em portugues correto e sem estados internos.

Arquivo principal:

- `src/views/FinancialStructure.vue`

### 4. Fundacao de Design System 3.2

Objetivo:

- Trocar padronizacoes remendadas por uma base visual compartilhada.
- Reduzir seletor global agressivo e CSS local duplicado gradualmente.

Componentes alvo:

- `AppButton`
- `AppCard`
- `AppBadge`
- `AppEmptyState`
- `AppActionMenu`
- `AppTabs`
- `AppInput`
- `AppSelect`
- `AppMoneyInput`
- `PageShell`
- `ResponsiveGrid`

Contratos visuais:

- Botao primario usa gradiente/acento e aparece no maximo uma vez por area de decisao.
- Botao secundario e neutro, sem competir com a acao principal.
- Botao destrutivo usa vermelho contido e exige confirmacao quando remove dados.
- Cards usam raio, borda e sombra consistentes.
- Badges traduzem estados de negocio, nao estados tecnicos.
- Empty states sempre tem titulo, descricao e acao quando houver proximo passo obvio.
- Menus de tres pontos concentram acoes secundarias e destrutivas em cards/listas.

Arquivos provaveis:

- `src/styles/tokens.css`
- `src/styles/main.css`
- `src/styles/layout.css`
- `src/components/ui/*`

### 5. Painel de Contexto Operacional

Objetivo:

- Criar um padrao reutilizavel para informacao lateral nas telas operacionais.
- Substituir blocos dispersos por um contexto claro e compacto.

Conteudos possiveis:

- Resumo do mes.
- Proxima cobranca ou alerta relevante.
- Impacto em conta/cartao.
- Sugestao de proxima acao.
- Estado de sincronizacao/importacao quando relevante.

Regras:

- O painel nunca deve ser requisito para concluir a acao principal.
- Em mobile, ele vira secao abaixo do fluxo principal.
- Ele deve usar apenas dados reais ou estados vazios acionaveis.

Componente candidato:

- `src/components/layout/OperationalContextPanel.vue`

## Fora de Escopo

- Reescrever store financeira.
- Alterar regras de calculo, conciliacao ou assinaturas sem motivo de apresentacao.
- Criar Open Finance real.
- Criar novo framework de UI.
- Refazer landing page publica nesta release.
- Mudar cobranca, planos ou regras premium.

## Fluxo de Dados

- Views continuam consumindo stores e domain services existentes.
- A camada 3.2 deve traduzir dados para modelos de apresentacao antes de renderizar.
- Labels tecnicas devem passar por funcoes de apresentacao ou componentes de badge.
- Acoes destrutivas continuam passando por confirmacao.
- OCR/importacao continuam sendo fluxos confirmados pelo usuario, nunca automaticos.

## Tratamento de Erros e Estados Vazios

- Erro tecnico deve virar mensagem acionavel.
- Estado vazio deve explicar o valor da primeira acao.
- Loading deve usar skeleton ou estado compacto, nao saltos bruscos de layout.
- Dados ausentes nao devem gerar metricas falsas ou textos como `stable`, `undefined`, `0,0x` sem contexto.
- Quando nao houver receita, dashboards e paineis devem orientar cadastro de receita antes de falar em capacidade segura.

## Testes Obrigatorios

Criar ou atualizar testes para:

- Navegacao 3.2 mantendo grupos e rotas principais coerentes.
- `Lancamentos` com OCR como CTA principal e sem card redundante.
- `Lancamentos` sem sugestao de origem quando nao houver fonte utilizavel.
- `Contas e cartoes` com tabs estruturadas e empty state acionavel.
- Componentes base mantendo contrato de botoes, badges, cards e empty states.
- Nenhum estado tecnico cru em telas principais (`stable`, `undefined`, labels internas).
- Build de producao passando.

## Criterios de Aceite

- `npm test -- --run` passa.
- `npm run build` passa.
- Largura desktop usa layout em duas colunas onde houver ganho real.
- Mobile nao tem sobreposicao, texto vertical, scroll horizontal ou botoes espremidos.
- OCR aparece como acao principal de lancamentos.
- Cadastro manual de lancamentos nao domina a tela inicial.
- Contas/cartoes nao exibem card familiar sem contexto.
- Empty states indicam proxima acao.
- Botoes antigos nao aparecem nas telas alvo.
- UI nao exibe estados tecnicos crus.
- Alteracoes ficam concentradas em componentes compartilhados e nas telas alvo, evitando refatoracao ampla sem retorno de UX.

## Ordem Recomendada de Implementacao

1. Criar contratos/testes da release 3.2.
2. Ajustar componentes base e tokens minimos.
3. Criar painel de contexto operacional reutilizavel.
4. Refatorar `Entries.vue` para fluxo operacional premium.
5. Refatorar `FinancialStructure.vue` para hub financeiro.
6. Ajustar shell/navegacao onde houver inconsistencias.
7. Fazer varredura de labels tecnicas e botoes antigos.
8. Rodar suite completa e build.

## Riscos

- `Entries.vue` e `FinancialStructure.vue` sao arquivos grandes; mudancas devem ser fatiadas.
- CSS global com `!important` pode mascarar problemas em componentes locais.
- Refatorar todas as paginas de uma vez pode aumentar regressao. A 3.2 deve focar nas telas operacionais e na base visual compartilhada.
- Se drawer/modal for introduzido sem componente acessivel, pode piorar teclado e mobile.

## Decisao

Seguir com a direcao B: Produto Integrado Premium.

A implementacao deve entregar um salto perceptivel nas telas operacionais e uma base mais limpa para futuras telas, sem prometer uma reescrita completa do produto.
