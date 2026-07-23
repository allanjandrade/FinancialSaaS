# Release 3.2.0 - UX Operacional Integrado

## Objetivo

Elevar o produto para uma experiência operacional mais fluida e profissional, reduzindo telas remendadas, duplicidade visual e ações dispersas nas áreas de operação financeira.

## Principais mudanças

- Menu principal reorganizado com Inteligência como segundo grupo e Operação agrupando Lançamentos, Contas, Cartões, Benefícios, Assinaturas e Família.
- Lançamentos redesenhado com OCR como ação primária, importação de extrato como opção complementar e cadastro manual como caminho secundário.
- Contas e cartões refinado como hub financeiro, sem card de Perfil Familiar dentro da aba de contas.
- Painel contextual operacional criado para mostrar indicadores, pendências e alertas sem poluir a área principal.
- Botões destrutivos, badges e menus de ação padronizados nos componentes compartilhados.
- Painéis técnicos de integrações, auditoria e pendências rebaixados visualmente para não competir com o fluxo principal.

## Validação esperada

- `npm test -- --run --reporter=dot`
- `npm run build`
- `npm run validate:v3-release`

