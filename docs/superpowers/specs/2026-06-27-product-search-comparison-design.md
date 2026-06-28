# Design: Pesquisa de Produtos e Comparador Financeiro

Data: 2026-06-27
Status: aprovado para planejamento

## Objetivo

Evoluir a area de compras planejadas para funcionar como um comparador estilo Buscape/Zoom com contexto financeiro pessoal. O sistema deve responder cinco perguntas:

- Este e o produto certo?
- Onde esta mais barato?
- O preco esta bom?
- Cabe no orcamento?
- Vale comprar agora ou esperar?

O produto nao deve ser apenas uma busca de preco. A camada diferencial e validar identidade, evitar mismatch, armazenar historico, alertar oportunidade e cruzar a melhor oferta compativel com a situacao financeira do usuario.

## Contexto Atual

O projeto ja possui uma base relevante:

- `src/views/PurchaseNew.vue`: entrada por descricao, link e imagem, incluindo multiplos links.
- `src/views/PurchaseWishlist.vue`: lista de compras planejadas com cards, alertas e atualizacao.
- `src/views/PurchaseDetail.vue`: detalhe do produto, historico, ofertas e decisao financeira.
- `src/composables/usePurchaseWorkflow.js`: fluxo de salvar, cotar, atualizar e analisar.
- `src/domain/products/canonicalizeProductUrl.js`: canonicalizacao, extracao de IDs e cache key.
- `supabase/functions/product-from-url/index.ts`: cria produto por URL com identidade travada.
- `supabase/functions/price-search/index.ts`: busca ofertas, classifica compatibilidade e usa cache.
- `supabase/migrations/*product_identity*` e `price_search_cache`: identidade e cache ja existem.
- Testes unitarios cobrem canonicalizacao, multiplos links, identidade travada, compatibilidade e cache.

A estrategia e evoluir em fases, aproveitando essa base em vez de reescrever o modulo.

## Principios

1. Produto por URL nunca vira busca generica.
2. Produto com identidade travada so aceita oferta com mesmo `source + source_product_id`.
3. Produto rejeitado nunca pode aparecer como melhor oferta.
4. Busca por descricao retorna candidatos revisaveis, nao confirma automaticamente produto exato.
5. Melhor preco usa preco total comparavel: produto + frete.
6. UI mostra estados humanos, nao estados tecnicos confusos.
7. Cache usa identidade canonica quando houver identidade.
8. Decisao financeira sempre usa o melhor preco compativel, nunca candidato parecido.

## Fases

### Fase 1: Regras Criticas e UX Operacional

Escopo:

- Melhorar a tela de entrada para reforcar os modos `Buscar por descricao` e `Adicionar por link`.
- Detectar automaticamente se o campo contem link, texto ou multiplos links.
- Manter `Imagem` como opcao secundaria, sem priorizar OCR nesta fase.
- Traduzir estados tecnicos para textos claros.
- Reformular cards da wishlist com informacoes de preco, identidade e acao.
- Bloquear visualmente mismatch e candidatos rejeitados.
- Garantir mobile sem scroll horizontal, card largo demais ou botoes espremidos.

Estados de UI:

- `Produto confirmado`
- `Buscando preco`
- `Cotacao encontrada`
- `Nenhuma oferta compativel`
- `Precisa revisar`
- `Monitorando`
- `Erro ao atualizar`

### Fase 2: Comparacao e Detalhes

Escopo:

- Separar candidatos em `compativeis`, `parecidos` e `rejeitados`.
- Rankear ofertas por produto exato, compatibilidade, menor preco total, confiabilidade, disponibilidade e menor risco.
- Melhorar tela de detalhes em secoes: Produto, Preco, Historico, Ofertas, Compatibilidade e Decisao financeira.
- Mostrar produto, frete e total estimado separadamente.
- Exibir ofertas rejeitadas sem permitir que influenciem melhor preco.

### Fase 3: Historico, Alertas e Operacao

Escopo:

- Estruturar historico rico com preco, frete, total, loja, disponibilidade e data.
- Mostrar preco atual, menor preco, preco medio, maior preco e variacao recente.
- Permitir alerta por preco alvo.
- Aplicar limites Free/Premium.
- Expandir observabilidade com eventos consistentes.
- Preparar migracao gradual para tabelas dedicadas.

### Fase 4: Consultor Financeiro

Escopo:

- Calcular se a compra cabe no orcamento.
- Mostrar impacto no mes, cartao, sobra mensal e metas.
- Sugerir comprar, esperar, parcelar ou ajustar plano.
- Usar somente preco compativel confirmado.
- Rebaixar recomendacao quando historico for insuficiente ou identidade estiver pendente.

## UX das Telas

### Compras Planejadas

Topo:

- Titulo: `Compras planejadas`
- Subtexto: `Acompanhe produtos, compare precos e decida se vale comprar agora.`
- CTA: `Pesquisar produto`

Entrada:

- Campo unico: `Descreva o produto ou cole um link`
- Abas continuam visiveis para controle manual.
- Se o usuario colar um link, o modo muda para `Adicionar por link`.
- Se digitar texto, usa `Buscar por descricao`.
- Se colar multiplos links, o sistema mostra cada link como item separado e oferece `Adicionar todos`.

Card ideal:

- Imagem do produto ou icone de produto consistente.
- Nome do produto.
- Loja de origem e codigo canonico.
- Melhor oferta compativel.
- Preco com frete.
- Historico resumido: menor preco e preco medio quando houver.
- Status claro.
- Acoes: `Atualizar preco`, `Ver detalhes`, `Excluir`.

Nao deve aparecer:

- `Status IA`
- `Compatibilidade pendente`
- `Aguardando cotacao compativel`

Esses estados internos devem ser traduzidos para textos humanos.

### Detalhe do Produto

Secoes:

- Produto: imagem, titulo, loja, ID canonico, URL canonica.
- Preco: preco atual, frete, total estimado, melhor oferta compativel.
- Historico: menor, medio, maior e variacao recente.
- Ofertas: compativeis primeiro, parecidas depois.
- Compatibilidade: atributos aceitos, faltantes e rejeitados.
- Decisao financeira: comprar, esperar, parcelar ou revisar.

Mobile:

- Cards em uma coluna.
- Acoes com area minima de 44px.
- Tabelas substituidas por cards.
- Nenhum scroll horizontal.
- Imagens com proporcao estavel.

## Regras de Dominio

### URL

Quando a entrada for URL:

- Extrair marketplace.
- Extrair ID canonico quando houver.
- Remover tracking e afiliados.
- Gerar URL canonica.
- Salvar `identity_locked=true`.
- Definir `identity_source=url` e `identity_confidence=1`.

Produto por link nunca pode ser convertido em busca generica. Se a busca por preco nao confirmar o mesmo ID, o resultado deve ser bloqueado.

Mensagem de mismatch:

`Nao conseguimos confirmar que este link corresponde ao produto correto. Tente novamente ou informe outro link.`

### Descricao

Quando a entrada for texto:

- Normalizar espacos e termos comuns.
- Identificar tipo, marca, modelo, variacao, cor, tamanho, voltagem e atributos relevantes quando possivel.
- Retornar candidatos revisaveis.
- Classificar candidatos em compativel, parecido e rejeitado.

Descricao nao deve criar identidade travada automaticamente sem revisao do usuario.

### Ranking

Ranking de ofertas:

1. Produto exato.
2. Produto compativel.
3. Menor preco total.
4. Loja confiavel.
5. Disponibilidade.
6. Menor risco de mismatch.

Campo comparavel:

`total_price = product_price + shipping_price`

## Dados

### Fase Atual

Manter `finance_states.data.wishlist` como fonte operacional e padronizar os campos:

- `source`
- `source_product_id`
- `canonicalUrl`
- `identity_locked`
- `identity_status`
- `identity_source`
- `product_identity`
- `accepted_candidates`
- `ambiguous_candidates`
- `last_rejected_candidates`
- `best_compatible_offer`
- `priceHistory`
- `targetPrice`
- `marketplaceOffers`

### Fase Futura

Promover gradualmente para tabelas dedicadas:

- `product_identities`
- `product_offers`
- `product_price_snapshots`
- `wishlist_items`
- `product_search_runs`
- `product_search_candidates`

A migracao deve ser incremental, mantendo compatibilidade com a wishlist em JSON ate a UI e jobs de monitoramento estarem prontos para ler das tabelas.

## Adaptadores de Preco

Contrato comum:

```json
{
  "source": "amazon",
  "offer_url": "...",
  "title": "...",
  "price": 199.9,
  "shipping_price": 19.9,
  "seller": "...",
  "image_url": "...",
  "source_product_id": "...",
  "availability": "in_stock",
  "captured_at": "..."
}
```

Adaptadores previstos:

- AmazonAdapter
- MercadoLivreAdapter
- GoogleShoppingAdapter
- SerpApiAdapter
- ManualPriceAdapter

Na fase inicial, os adaptadores podem continuar encapsulados nos provedores atuais, desde que o retorno seja normalizado antes de chegar na UI.

## Seguranca

Toda operacao deve:

- Validar JWT.
- Usar `user_id` do token.
- Ignorar `user_id` do body.
- Respeitar plano do usuario.
- Respeitar limite Free/Premium quando a fase de entitlements entrar.
- Nao vazar wishlist de outro usuario.
- Nao usar `service_role` sem filtro.
- Nao logar tokens, cookies, headers completos ou URLs com parametros sensiveis.

## Observabilidade

Eventos recomendados:

- `product_search_started`
- `product_url_canonicalized`
- `product_identity_confirmed`
- `product_identity_mismatch_blocked`
- `offers_collected`
- `offers_ranked`
- `price_alert_created`
- `price_search_failed`

Cada evento deve conter:

- `request_id`
- `user_id`
- `source`
- `source_product_id`
- `status`
- tempo de execucao
- erro normalizado, quando houver

## Free e Premium

Free:

- Wishlist limitada.
- Buscas mensais limitadas.
- Historico curto.
- Atualizacao manual.
- Alertas limitados.

Premium:

- Monitoramento automatico.
- Historico maior.
- Alertas multiplos.
- Simulacao de compra.
- Recomendacao financeira de comprar ou esperar.

Os limites exatos devem seguir o modelo de precificacao existente no projeto.

## Erros Amigaveis

Mensagens esperadas:

- Link invalido: `Nao reconhecemos este link de produto. Verifique o endereco e tente novamente.`
- Produto nao confirmado: `Nao conseguimos confirmar que este link corresponde ao produto correto.`
- Preco nao encontrado: `Ainda nao encontramos uma oferta compativel para este produto.`
- Limite Free: `Voce atingiu o limite de buscas do plano gratis.`
- Fornecedor falhou: `Nao foi possivel atualizar os precos agora. Tente novamente em alguns instantes.`

Erros tecnicos nao devem aparecer para o usuario.

## Testes e Validacao

Validacoes existentes a manter:

```bash
npm run validate-product-url-identity
npm run validate-product-search-description
npm run validate-product-cache-key
npm run validate-price-search-identity
npm run validate-valueserp-price-search
npm run test:run -- tests/unit/product-url-canonicalizer.test.js tests/unit/multiple-product-urls.test.js tests/unit/price-search-identity-locked.test.js tests/unit/price-search-compatibility.test.js tests/unit/purchase-intelligence-compatible-price.test.js
npm run build
```

Casos obrigatorios:

- Amazon mantem ASIN.
- Mercado Livre mantem ID canonico.
- Link generico usa URL canonica/hash.
- Multiplos links viram multiplos itens.
- Descricao retorna candidato revisavel.
- Produto rejeitado nao aparece como melhor oferta.
- Cache usa `source:source_product_id`.
- Melhor preco considera frete.
- UI mobile nao quebra cards, botoes e historico.
- Decisao financeira usa preco compativel correto.

## Definicao de Pronto

A evolucao esta pronta quando:

- Link salva o produto certo.
- Descricao retorna candidatos revisaveis.
- Produto errado e bloqueado.
- Cache nao contamina produto novo.
- Historico e armazenado.
- Alerta funciona.
- UI e responsiva.
- Free tem limite real.
- Premium tem valor claro.
- Decisao financeira usa o preco correto.
- Testes cobrem Amazon, Mercado Livre, multiplos links e mismatch.

## Decisoes Aprovadas

- Caminho escolhido: faseado por risco critico.
- Primeiro foco: regras criticas de identidade, URL, cache, estados claros e cards melhores.
- Banco dedicado entra depois, sem bloquear o MVP visual e funcional.
- OCR por imagem fica secundario ate URL e descricao estarem solidos.
