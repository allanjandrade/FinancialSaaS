# Checklist Definitivo de Correção para Erros de Localhost

## Problemas Atuais
1. **403 Forbidden em family_members** - Políticas RLS não funcionando
2. **Agente de IA travado/não respondendo** - Edge Function não implantada ou configurada

## Verificações Prévias

### ✅ Item do Checklist 1: Verificar se config.js existe
- [ ] Arquivo `config.js` existe no diretório app
- [ ] Arquivo contém URL válida do Supabase e chave anon
- [ ] URL começa com `https://`
- [ ] Chave anon não é o placeholder "COLE_AQUI"

**Como verificar:**
```bash
# Verificar se arquivo existe
ls config.js

# Visualizar conteúdo
cat config.js
```

**Se ausente:**
- Copie `config.js.template` para `config.js`
- Adicione suas credenciais reais do Supabase

---

### ✅ Item do Checklist 2: Verificar Conexão com Banco de Dados
- [ ] Pode conectar ao Supabase do navegador
- [ ] Sem erro "supabaseUrl is not defined"
- [ ] Sem erro "SUPABASE_CONFIG is not defined"

**Como verificar:**
- Abra DevTools do navegador → Console
- Atualize a página
- Verifique erros de conexão

**Se houver erros:**
- Certifique-se de que config.js é carregado antes de app.js
- Verifique a ordem de carregamento de scripts em index.html

---

### ✅ Item do Checklist 3: Corrigir Erro 403 Forbidden (CRÍTICO)

#### Passo 3.1: Executar SQL de Correção de Produção
- [ ] Abra Painel do Supabase → SQL Editor
- [ ] Copie o conteúdo de `PRODUCTION-FIX.sql`
- [ ] Cole e execute
- [ ] Verifique se não há erros na execução SQL
- [ ] Verifique se a saída mostra RLS habilitado em family_members

**SQL to run:**
```sql
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can read their family membership" ON public.family_members
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can insert their own family membership" ON public.family_members
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can update their own family membership" ON public.family_members
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can delete their own family membership" ON public.family_members
FOR DELETE USING (user_id = auth.uid());
```

#### Passo 3.2: Verificar se RLS Está Funcionando
- [ ] Execute query de verificação no SQL Editor
- [ ] Confirme que family_members mostra `rowsecurity = true`
- [ ] Confirme que todas as tabelas necessárias têm RLS habilitado

**Query de verificação:**
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('family_members', 'families', 'finance_states');
```

**Saída esperada:**
- family_members: true
- families: true  
- finance_states: true

#### Passo 3.3: Testar Políticas RLS
- [ ] Faça login no aplicativo
- [ ] Verifique o console do navegador
- [ ] Sem erros 403 Forbidden em family_members
- [ ] Dados da família carregam com sucesso

**Se 403 persistir:**
- Verifique se o usuário está autenticado
- Verifique se user_id corresponde a auth.uid()
- Verifique a sintaxe da política RLS
- Revise logs do Supabase por violações de RLS

---

### ✅ Item do Checklist 4: Corrigir Agente de IA Não Respondendo (CRÍTICO)

#### Passo 4.1: Configurar Tabelas de IA
- [ ] Abra Painel do Supabase → SQL Editor
- [ ] Copie o conteúdo de `AI-FIX.sql`
- [ ] Cole e execute
- [ ] Verifique se não há erros na execução SQL
- [ ] Confirme que tabelas de IA foram criadas

**Tabelas para verificar:**
- ai_conversations
- ai_messages
- ai_system_prompts
- ai_audit_logs

#### Passo 4.2: Implantar Edge Function
- [ ] Instale CLI do Supabase: `npm install -g supabase`
- [ ] Vincule ao projeto: `supabase link --project-ref your-ref`
- [ ] Implante função: `supabase functions deploy ai-assistant`
- [ ] Verifique se a implantação foi bem-sucedida
- [ ] Verifique se a função aparece no Painel do Supabase

#### Passo 4.3: Configurar GEMINI_API_KEY
- [ ] Vá para Painel do Supabase → Edge Functions → ai-assistant
- [ ] Clique em "Environment Variables"
- [ ] Adicione variável: `GEMINI_API_KEY`
- [ ] Cole sua chave de API do Google Gemini
- [ ] Salve a configuração

**Como obter chave de API do Gemini:**
- Vá para https://makersuite.google.com/app/apikey
- Crie nova chave de API
- Copie a chave

#### Passo 4.4: Testar Edge Function Diretamente
- [ ] Use curl para testar a função
- [ ] Verifique se a função retorna resposta
- [ ] Verifique erros na resposta

**Comando de teste:**
```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/ai-assistant' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"message": "Olá", "acao": "chat-message"}'
```

**Resposta esperada:**
```json
{"response": "Olá! Como posso ajudar você hoje?"}
```

#### Passo 4.5: Testar IA no Aplicativo
- [ ] Atualize localhost (http://localhost:8080)
- [ ] Navegue até o painel do assistente de IA
- [ ] Digite uma mensagem
- [ ] Clique em enviar
- [ ] Verifique se a IA responde (não travada)
- [ ] Verifique o console do navegador por erros

---

### ✅ Item do Checklist 5: Limpar Cache do Service Worker
- [ ] Abra DevTools → Application → Service Workers
- [ ] Clique em "Unregister" para o service worker
- [ ] Atualize a página
- [ ] Verifique se não há erros de clone de service worker

---

### ✅ Item do Checklist 6: Validação Final

#### Verificação do Console do Navegador
- [ ] Sem erros vermelhos
- [ ] Sem erros 403 Forbidden
- [ ] Sem erros "supabaseUrl is not defined"
- [ ] Service worker funcionando sem erros de clone
- [ ] Agente de IA responde às mensagens

#### Verificação da Aba Network
- [ ] Todas as requisições retornam 200 OK
- [ ] Sem requisições falhadas (vermelho)
- [ ] Requisições family_members têm sucesso
- [ ] Chamadas de função de IA têm sucesso

#### Verificação de Funcionalidade
- [ ] Login funciona
- [ ] Dashboard carrega
- [ ] Pode adicionar despesas
- [ ] Pode adicionar receitas
- [ ] Dados da família carregam
- [ ] Assistente de IA responde

---

## Solução de Problemas Comuns

### Problema: 403 Forbidden persiste após correção SQL
**Causas possíveis:**
1. SQL não executado corretamente
2. Erro de sintaxe de política RLS
3. Usuário não autenticado
4. user_id errado na query

**Soluções:**
1. Execute novamente a correção SQL
2. Verifique logs de execução SQL
3. Verifique se o usuário está logado
4. Verifique se auth.uid() corresponde ao user_id da query

### Problema: Agente de IA ainda travado após implantação da Edge Function
**Causas possíveis:**
1. GEMINI_API_KEY não configurada
2. Edge Function tem erros
3. Problema de conectividade de rede
4. Cota da API Gemini excedida

**Soluções:**
1. Verifique se a variável de ambiente está configurada
2. Verifique logs da Edge Function no Painel do Supabase
3. Teste conectividade de rede
4. Verifique cota e faturamento da API Gemini

### Problema: config.js não carregando
**Causas possíveis:**
1. Arquivo não existe
2. Nome de arquivo errado
3. Problema de ordem de carregamento de script

**Soluções:**
1. Crie config.js a partir do template
2. Certifique-se do nome exato do arquivo "config.js"
3. Verifique a ordem de scripts em index.html

---

## Prontidão para Implantação em Produção

### Antes de Implantar em Produção
- [ ] Todos os testes de localhost passam
- [ ] Sem erros no console
- [ ] Sem erros de rede
- [ ] Agente de IA funcionando
- [ ] Migrações de banco de dados aplicadas
- [ ] Edge Function implantada
- [ ] Variáveis de ambiente configuradas
- [ ] config.js NÃO no git
- [ ] Service worker funcionando

### Passos de Implantação em Produção
1. Implante frontend no Netlify/Vercel
2. Banco de dados já migrado (SQL executado)
3. Edge Function já implantada
4. Variáveis de ambiente já configuradas
5. Teste URL de produção
6. Monitore logs por erros

---

## Comandos de Referência Rápida

```bash
# Iniciar servidor local
http-server -p 8080

# Implantar Edge Function
supabase functions deploy ai-assistant

# Vincular projeto Supabase
supabase link --project-ref your-ref

# Testar Edge Function
curl -X POST 'https://your-project.supabase.co/functions/v1/ai-assistant' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"message": "Olá", "acao": "chat-message"}'
```

---

## Recursos de Suporte

- Painel do Supabase: https://supabase.com/dashboard
- Logs da Edge Function: Painel → Edge Functions → ai-assistant → Logs
- Logs do Banco de Dados: Painel → Database → Logs
- SQL Editor: Painel → SQL Editor

---

## Critérios de Sucesso

✅ **Aplicativo está pronto para produção quando:**
- Login funciona sem erros
- Todas as queries de banco de dados têm sucesso (sem erros 403)
- Assistente de IA responde às mensagens
- Sem erros no console
- Sem erros de rede
- Service worker funcionando corretamente
