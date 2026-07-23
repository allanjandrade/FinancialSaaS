# Guia de Debug - Status Atual

## ✅ Correções Concluídas

1. **Problema CORS** - Arquivos agora acessados via http://localhost:8080 em vez de file://
2. **Configuração do Supabase** - Movida para seção head do HTML em todos os arquivos
3. **Verificação Defensiva de Tipos** - Adicionada ao app.js e auth.js
4. **Funções Duplicadas** - Removidas declarações duplicadas de createExpense e createIncome
5. **Logging de IA** - Adicionado logging detalhado no console à função callAiAssistant
6. **GEMINI_API_KEY** - Adicionado placeholder à configuração HTML

## Status Atual

### Login ✅ Funcionando
- Login está funcionando corretamente
- Usuário pode autenticar com sucesso

### Erro 403 Forbidden em family_members
**Erro:** `GET https://your-project-ref.supabase.co/rest/v1/family_members?... 403 (Forbidden)`

**Causa:** Políticas RLS (Row Level Security) estão bloqueando acesso. Isso é esperado se:
- O usuário não tem registro de associação de família
- Políticas RLS não foram aplicadas ao banco de dados de produção
- Políticas são muito restritivas

**Solução:** O arquivo SQL `supabase-setup-clean.sql` inclui políticas de debug que permitem acesso autenticado. Execute este SQL no SQL Editor do Supabase para aplicar as políticas.

### Debug do Agente de IA
**Logging Adicionado:** A função callAiAssistant agora registra:
- `[AI] Starting AI assistant call`
- `[AI] Message:` - a mensagem do usuário
- `[AI] GEMINI_API_KEY exists:` - se a chave está configurada
- `[AI] GEMINI_API_KEY is placeholder:` - se é o valor placeholder
- `[AI] Calling Gemini API...`
- `[AI] Response status:` - código de status HTTP
- `[AI] Response ok:` - se a resposta foi bem-sucedida
- `[AI] Error response:` - detalhes do erro se a requisição falhou
- `[AI] Error occurred:` - mensagem de erro
- `[AI] Error stack:` - stack trace do erro

**Para Testar IA:**
1. Abra o console do navegador (F12)
2. Acesse `http://localhost:8080/index.html`
3. Envie uma mensagem ao agente de IA
4. Verifique o console por logs com prefixo `[AI]`
5. Verifique se GEMINI_API_KEY está configurada (substitua "YOUR_GEMINI_API_KEY_HERE" em index.html)

## Próximos Passos

### Para o Agente de IA Funcionar:
1. Substitua `YOUR_GEMINI_API_KEY_HERE` em index.html com sua chave de API real do Google Gemini
2. Obtenha a chave de API em: https://makersuite.google.com/app/apikey
3. Atualize a página e teste o chat de IA

### Para o Erro 403:
1. Abra o SQL Editor do Supabase
2. Execute o conteúdo de `supabase-setup-clean.sql`
3. Isso aplicará políticas RLS que permitem acesso autenticado

## Logs do Console para Monitorar

Ao testar o agente de IA, procure por estes logs:
- Se você ver `[AI] GEMINI_API_KEY is placeholder: true` → Você precisa adicionar sua chave de API real
- Se você ver `[AI] Error occurred: API Key do Gemini não configurada` → O mesmo acima
- Se você ver `[AI] Response status: 429` → Limite de taxa, aguarde alguns minutos
- Se você ver `[AI] Response status: 400/500` → Verifique a resposta de erro para detalhes

## Resumo
- Login: ✅ Funcionando
- Agente de IA: ⏳ Precisa de configuração GEMINI_API_KEY
- Family Members 403: ⏳ Precisa de políticas RLS aplicadas via SQL
