# Guia de Resolução de Erros

## Problemas Atuais e Correções

### 1. Erro de Clone do Service Worker ✅ CORRIGIDO
**Erro:** `Failed to execute 'clone' on 'Response': Response body is already used`
**Correção:** Modificada linha 61 do `sw.js` para clonar a resposta antes de usá-la na operação de cache put.

### 2. 403 Forbidden em family_members ✅ CORRIGIDO
**Erro:** `GET https://your-project-ref.supabase.co/rest/v1/family_members 403 (Forbidden)`
**Correção:** Adicionadas políticas RLS ausentes para family_members (update e delete) e garantido que RLS está habilitado em todas as tabelas.

**Ação Necessária:** Você precisa executar novamente a configuração SQL para aplicar as mudanças nas políticas RLS:
```sql
-- Run this in Supabase SQL Editor
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can update their own family membership" ON public.family_members
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own family membership" ON public.family_members
FOR DELETE USING (user_id = auth.uid());
```

### 3. Agente de IA Não Respondendo ⚠️ REQUER AÇÃO
**Problema:** Agente de IA fica travado pensando e nunca responde.

**Causas Possíveis:**
1. Edge Function não implantada
2. Variável de ambiente GEMINI_API_KEY não configurada
3. Edge Function tem erros

**Passos de Resolução:**

#### Passo 1: Implantar Edge Function
```bash
supabase functions deploy ai-assistant
```

#### Passo 2: Configurar Variável de Ambiente
No Painel do Supabase → Edge Functions → ai-assistant → Environment Variables:
- Adicione `GEMINI_API_KEY` com sua chave de API do Google Gemini

#### Passo 3: Verificar Logs da Edge Function
No Painel do Supabase → Edge Functions → ai-assistant → Logs:
- Procure por erros na execução da função
- Verifique se a função está recebendo requisições corretamente

#### Passo 4: Testar Edge Function Diretamente
```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/ai-assistant' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"message": "Hello", "acao": "chat-message"}'
```

### 4. Avisos Esperados (Sem Ação Necessária)
- "Error tracking disabled - no SENTRY_DSN configured" - Esperado quando Sentry não configurado
- "Analytics disabled - no GA_MEASUREMENT_ID configured" - Esperado quando Google Analytics não configurado
- "Tracking Prevention blocked access to storage" - Recurso de privacidade do navegador, não é erro

## Migração de Banco de Dados Necessária

Para corrigir o erro 403 e habilitar recursos de IA, você precisa executar o SQL atualizado:

```sql
-- Execute no SQL Editor do Supabase
-- Isso habilitará RLS nas tabelas de IA e adicionará políticas ausentes

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_system_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can update their own family membership" ON public.family_members
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own family membership" ON public.family_members
FOR DELETE USING (user_id = auth.uid());
```

## Testes Após Correções

1. **Limpar Cache do Service Worker:**
   - Abra DevTools do navegador → Application → Service Workers
   - Clique em "Unregister" para o service worker
   - Atualize a página

2. **Testar Login:**
   - Tela de login deve aparecer
   - Sem erros JavaScript no console

3. **Testar Acesso à Família:**
   - Após fazer login, dados da família devem carregar sem erros 403

4. **Testar Chat de IA:**
   - Navegue até o assistente de IA
   - Envie uma mensagem
   - Deve receber resposta (não travado pensando)

## Se os Problemas Persistirem

### Verificar Console do Navegador
- Abra DevTools → Console
- Procure por erros vermelhos
- Anote as mensagens de erro exatas

### Verificar Aba Network
- Abra DevTools → Network
- Procure por requisições falhadas (vermelho)
- Verifique o status da resposta e detalhes do erro

### Verificar Logs do Supabase
- Painel do Supabase → Database → Logs
- Procure por violações de políticas RLS
- Verifique por erros de banco de dados

### Contatar Suporte
Se os problemas persistirem após aplicar todas as correções, forneça:
- Erros do console do navegador
- Requisições falhadas na aba Network
- Logs da Edge Function do Supabase
- Logs do Banco de Dados do Supabase
