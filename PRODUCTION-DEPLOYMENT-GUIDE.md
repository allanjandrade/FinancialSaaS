# Guia de Implantação em Produção

Este guia fornece instruções passo a passo para implantar o aplicativo Controle Financeiro em produção.

## Fase 1: Ajustes de Código e Ambiente ✅

### 1.1 Configuração de Variáveis de Ambiente
O aplicativo agora suporta múltiplos métodos de injeção de variáveis de ambiente:

**Ordem de Prioridade:**
1. Configuração de runtime (config.js) - para desenvolvimento local
2. Variáveis de ambiente do Netlify - `SUPABASE_URL`, `SUPABASE_ANON_KEY`
3. Variáveis de ambiente do Vercel - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
4. Injeção no tempo de build - `window.ENV.SUPABASE_URL`, `window.ENV.SUPABASE_ANON_KEY`

**Para Netlify:**
- Vá para Site Settings → Environment Variables
- Adicione: `SUPABASE_URL` = sua URL de produção do Supabase
- Adicione: `SUPABASE_ANON_KEY` = sua chave anon de produção do Supabase

**Para Vercel:**
- Vá para Project Settings → Environment Variables
- Adicione: `VITE_SUPABASE_URL` = sua URL de produção do Supabase
- Adicione: `VITE_SUPABASE_ANON_KEY` = sua chave anon de produção do Supabase

### 1.2 Headers da Edge Function
✅ Corrigido: Todas as chamadas do assistente de IA agora incluem o header Authorization adequado com token de sessão e SUPABASE_ANON_KEY.

### 1.3 Limpeza de Console Log
✅ Concluído: Removidos todos os comandos console.log de:
- error-tracking.js
- analytics.js
- app.js (já tinha comentários de produção)

### 1.4 Tratamento de Erros de IA
✅ Aprimorado: Adicionado tratamento robusto de erros com:
- Mensagens de erro específicas para diferentes códigos de status HTTP (401, 429, 500)
- Redefinição de cooldown em erro para permitir nova tentativa
- Feedback visual na interface de chat

## Fase 2: Preparação do Supabase para Produção

### 2.1 Executar AI-FIX.sql em Produção

**Passos:**
1. Faça login no painel do Supabase
2. Navegue até o SQL Editor
3. Selecione seu projeto de **produção** (não local/teste)
4. Abra o arquivo `AI-FIX.sql` deste repositório
5. Execute o script completo

**O que isso faz:**
- Cria tabelas de IA: `ai_conversations`, `ai_messages`, `ai_system_prompts`, `ai_audit_logs`
- Habilita Row Level Security (RLS) em todas as tabelas de IA
- Cria políticas de segurança garantindo que usuários só acessem seus próprios dados
- Adiciona índices de performance
- Insere prompts de sistema padrão
- Cria triggers para atualizações automáticas de timestamp

### 2.2 Configurar Políticas RLS
✅ Já incluído no AI-FIX.sql:
- Usuários só podem ler/escrever suas próprias conversas
- Usuários só podem ler/escrever mensagens de suas próprias conversas
- Prompts de sistema são somente leitura para todos os usuários autenticados
- Logs de auditoria são isolados por usuário

### 2.3 Injetar Segredos de IA

**Passos:**
1. No painel do Supabase, vá para Edge Functions
2. Navegue até Settings → Environment Variables
3. Adicione: `GEMINI_API_KEY` = sua chave de API do Google Gemini
4. Certifique-se de que a Edge Function do assistente de IA está implantada

## Fase 3: Testes de Smoke

Antes de entrar ao vivo, execute estes cenários de teste críticos:

### Teste 1: Fluxo de Login Limpo
- Crie uma nova janela de navegador incógnito/privado
- Navegue até a URL de produção
- Tente fazer login com uma nova conta
- Verifique o redirecionamento bem-sucedido para o aplicativo principal
- Limpe cookies e tente novamente para garantir que o fluxo funciona

### Teste 2: Conversa Básica com IA
- Abra o chat do assistente de IA
- Envie uma mensagem simples: "Olá"
- Verifique se o Gemini responde adequadamente
- Verifique se a resposta aparece na interface de chat

### Teste 3: Processamento de Entrada Financeira
- Envie um comando financeiro: "Gastei 50 reais com combustível hoje"
- Verifique se a despesa aparece imediatamente no dashboard
- Verifique se a despesa é registrada no banco de dados
- Confirme se o valor e a categoria estão corretos

### Teste 4: Tratamento de Erros
- Desconecte a internet temporariamente
- Envie uma mensagem de IA
- Verifique se aparece uma mensagem de erro amigável
- Confirme se o botão não congela no estado "Processando..."
- Reconecte e verifique se a nova tentativa funciona

### Teste 5: Upload de Comprovante
- Faça upload de uma imagem de comprovante
- Verifique se o indicador de processamento de IA aparece
- Verifique se o formulário é preenchido automaticamente com os dados extraídos
- Confirme se a despesa pode ser salva com sucesso

## Considerações Adicionais de Produção

### Headers de Segurança
O arquivo `netlify.toml` inclui headers de segurança:
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Referrer-Policy
- Permissions-Policy

### Performance
- Service Worker está registrado para capacidade offline
- Imagens são otimizadas
- JavaScript é minificado no build de produção

### Monitoramento
- Integração com Sentry para rastreamento de erros (configure SENTRY_DSN)
- Integração com Google Analytics (configure GA_MEASUREMENT_ID)
- Ambos são opcionais e degradam graciosamente se não configurados

## Checklist de Implantação

- [ ] Variáveis de ambiente configuradas na plataforma de hospedagem
- [ ] AI-FIX.sql executado no Supabase de produção
- [ ] GEMINI_API_KEY adicionado às Edge Functions do Supabase
- [ ] Todos os testes de smoke passaram
- [ ] Headers de segurança verificados
- [ ] Rastreamento de erros configurado (opcional)
- [ ] Analytics configurado (opcional)
- [ ] Domínio/SSL configurado (se usando domínio personalizado)

## Monitoramento Pós-Implantação

Após a implantação, monitore:
1. Logs do Supabase para erros de banco de dados
2. Logs da Edge Function para problemas de processamento de IA
3. Console do navegador para erros do lado do cliente
4. Feedback dos usuários para problemas de UX

## Plano de Rollback

Se problemas críticos forem descobertos:
1. Reverta para a implantação anterior na plataforma de hospedagem
2. Nenhuma alteração no banco de dados precisa de rollback (SQL é idempotente)
3. Variáveis de ambiente permanecem inalteradas
4. Dados do usuário são preservados no Supabase

## Suporte

Para problemas durante a implantação:
- Verifique logs do Supabase: Dashboard → Logs
- Verifique logs da Edge Function: Dashboard → Edge Functions → Logs
- Revise o console do navegador para erros do lado do cliente
- Verifique se as variáveis de ambiente estão configuradas corretamente
