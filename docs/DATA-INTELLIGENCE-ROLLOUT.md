# Data Intelligence Rollout

## Estado comercial

- Durante testes, Gemini pode ser habilitado com `EMBEDDING_PROVIDER=gemini` e
  `EMBEDDINGS_TEST_ONLY=true` exclusivamente para dados sinteticos temporarios.
- Nao enviar documentos, extratos, comprovantes ou dados pessoais/financeiros reais ao nivel gratuito.
- A presenca de uma chave nao habilita o recurso sem `EMBEDDINGS_ENABLED=true`.
- Na etapa comercial, trocar para OpenAI faturado, desativar o modo de teste e reindexar os documentos.
- O banco vetorial pode permanecer provisionado sem gerar chamadas ou custos de API.

## Implementado

- RLS reforçado para famílias, membros, estado financeiro, comprovantes e preços.
- Edge Functions exigem usuário autenticado e limitam arquivos a 12 MB.
- OCR tenta texto nativo, código de barras/QR e OCR tradicional configurável antes da visão generativa.
- Projeções normalizadas para documentos e eventos financeiros, mantendo o JSON atual intacto.
- Base vetorial no Supabase com `pgvector`, índice HNSW, hash de conteúdo, versão do modelo e isolamento por família.
- Contrato de conectores com cursor incremental, deduplicação, lotes e histórico de sincronização.

## Ordem de implantação

1. Fazer backup do banco no painel Supabase.
2. Aplicar todas as migrations pendentes em ordem.
3. Configurar os segredos server-side necessários.
4. Publicar as Edge Functions atualizadas e as novas funções `embeddings` e `connector-sync`.
5. Validar com um usuário autenticado de teste antes de liberar o frontend.

## Segredos

- `EMBEDDING_API_KEY`: necessário para gerar embeddings.
- `EMBEDDING_MODEL`: padrão `text-embedding-3-small`, com 1536 dimensões.
- `EMBEDDING_VERSION`: versão lógica usada para reindexação.
- `DOCUMENT_OCR_ENDPOINT`: opcional; OCR tradicional que recebe `{ imageBase64, mimeType }`.
- `DOCUMENT_OCR_API_KEY`: opcional; credencial do OCR tradicional.

Tokens de Open Finance, e-mail ou marketplaces não devem ser gravados em `connector_accounts.config`.
Armazene-os no Vault e registre somente o nome do segredo em `credential_secret_name`.

## Conectores prioritários

- `open_finance`: transações e saldos via provedor regulado.
- `document`: documentos enviados ou obtidos em armazenamento autorizado.
- `email`: mensagens/documentos após consentimento e escopos mínimos.
- `marketplace`: observações de preço e disponibilidade.

Cada provedor deve produzir registros canônicos para `connector-sync`; webhooks externos precisam validar assinatura antes da ingestão.

## Rollback

- As tabelas novas são aditivas; não apague dados para desativar a funcionalidade.
- Interrompa chamadas a `embeddings` ou `connector-sync` e restaure a versão anterior das Edge Functions.
- As projeções normalizadas podem ficar pausadas sem afetar `finance_states`, que permanece compatível.
- Para problemas de RLS, restaure somente a policy afetada após confirmar o caso com um usuário de teste.
