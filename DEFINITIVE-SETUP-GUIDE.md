# Guia Definitivo de Configuração - Leia Isso Primeiro

## DISTINÇÃO CRÍTICA

### config.js = Arquivo JavaScript (NÃO SQL)
- **Localização:** Edite em sua IDE (VS Code)
- **Propósito:** Contém credenciais do Supabase para o frontend
- **Formato:** Código JavaScript
- **Como usar:** Abra na IDE, edite, salve
- **NÃO:** Execute no SQL Editor do Supabase

### Arquivos .sql = Scripts de Banco de Dados SQL
- **Localização:** Execute no Painel do Supabase → SQL Editor
- **Propósito:** Criar/modificar tabelas e políticas do banco de dados
- **Formato:** Código SQL
- **Como usar:** Copie o conteúdo, cole no SQL Editor do Supabase, execute
- **NÃO:** Edite como JavaScript ou execute no navegador

## CONFIGURAÇÃO PASSO A PASSO

### Passo 1: Configure config.js (NA SUA IDE)

1. Abra `config.js` no VS Code
2. Substitua com suas credenciais reais do Supabase:

```javascript
window.SUPABASE_CONFIG = {
  url: "https://oedbaemzavzvxysikkpk.supabase.co",
  anonKey: "sua-chave-anon-real-aqui"
};
```

3. Salve o arquivo
4. **NÃO** execute isso no SQL Editor
5. **NÃO** cole isso em outro lugar

**Onde obter credenciais:**
- Vá para https://supabase.com/dashboard
- Selecione seu projeto
- Vá para Settings → API
- Copie "Project URL" → cole como `url`
- Copie a chave "anon/public" → cole como `anonKey`

### Passo 2: Execute AI-FIX.sql (NO SQL EDITOR DO SUPABASE)

1. Vá para https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá para SQL Editor (barra lateral esquerda)
4. Clique em "New Query"
5. Copie TODO o conteúdo do arquivo `AI-FIX.sql`
6. Cole no SQL Editor
7. Clique em "Run" (ou pressione Ctrl+Enter)
8. Aguarde a conclusão (deve mostrar "Success")
9. **Isso cria tabelas de IA**

### Passo 3: Execute PRODUCTION-FIX.sql (NO SQL EDITOR DO SUPABASE)

1. No mesmo SQL Editor
2. Clique em "New Query"
3. Copie TODO o conteúdo do arquivo `PRODUCTION-FIX.sql`
4. Cole no SQL Editor
5. Clique em "Run" (ou pressione Ctrl+Enter)
6. Aguarde a conclusão (deve mostrar "Success")
7. **Isso corrige erros 403 Forbidden**

### Passo 4: Teste Aplicação Local

1. Inicie o servidor local:
```bash
http-server -p 8080
```

2. Abra o navegador: http://localhost:8080

3. Teste o login:
   - Deve ver a tela de login
   - Sem erro "supabaseUrl is not defined"
   - Sem erros 403 Forbidden

### Passo 5: Implantar Edge Function

1. Instale o CLI do Supabase (se não estiver instalado):
```bash
npm install -g supabase
```

2. Vincule ao seu projeto:
```bash
supabase link --project-ref oedbaemzavzvxysikkpk
```

3. Implante a Edge Function:
```bash
supabase functions deploy ai-assistant
```

4. Configure a variável de ambiente:
   - Vá para Painel do Supabase → Edge Functions → ai-assistant
   - Clique em "Environment Variables"
   - Adicione: `GEMINI_API_KEY` = sua chave de API do Google Gemini

### Passo 6: Teste Assistente de IA

1. Atualize o navegador
2. Navegue até o painel do assistente de IA
3. Digite uma mensagem
4. Envie a mensagem
5. Deve receber resposta (não travado)

## ERROS COMUNS PARA EVITAR

❌ **ERRADO:** Colar conteúdo do config.js no SQL Editor
✅ **CORRETO:** Edite config.js na IDE, execute arquivos .sql no SQL Editor

❌ **ERRADO:** Executar scripts SQL no console do navegador
✅ **CORRETO:** Execute scripts SQL no SQL Editor do Supabase

❌ **ERRADO:** Editar arquivos .sql como JavaScript
✅ **CORRETO:** Arquivos .sql são SQL, edite como SQL

❌ **ERRADO:** Executar config.js no terminal
✅ **CORRETO:** config.js é carregado automaticamente pelo index.html

## CHECKLIST DE VERIFICAÇÃO

Após concluir todos os passos:

- [ ] config.js contém credenciais reais do Supabase (não placeholders)
- [ ] AI-FIX.sql executou com sucesso no SQL Editor do Supabase
- [ ] PRODUCTION-FIX.sql executou com sucesso no SQL Editor do Supabase
- [ ] Servidor local rodando (http-server -p 8080)
- [ ] Navegador abre http://localhost:8080
- [ ] Tela de login aparece sem erros
- [ ] Sem erro "supabaseUrl is not defined"
- [ ] Sem erros 403 Forbidden
- [ ] Edge Function implantada
- [ ] GEMINI_API_KEY configurada
- [ ] Assistente de IA responde às mensagens

## SOLUÇÃO DE PROBLEMAS

### Erro: "supabaseUrl is not defined"
**Causa:** config.js não configurado corretamente
**Solução:** Edite config.js na IDE com credenciais reais

### Erro: Erro de sintaxe SQL perto de "window"
**Causa:** Tentando executar JavaScript no SQL Editor
**Solução:** Execute apenas arquivos .sql no SQL Editor, edite config.js na IDE

### Erro: 403 Forbidden em family_members
**Causa:** Políticas RLS não aplicadas
**Solução:** Execute PRODUCTION-FIX.sql no SQL Editor

### Erro: Agente de IA travado/não respondendo
**Causa:** Edge Function não implantada ou GEMINI_API_KEY não configurada
**Solução:** Implante a Edge Function e configure a variável de ambiente

## PROPÓSITOS DOS ARQUIVOS

| Arquivo | Tipo | Propósito | Onde Usar |
|---------|------|----------|-----------|
| config.js | JavaScript | Credenciais do frontend | Edite na IDE |
| AI-FIX.sql | SQL | Criar tabelas de IA | SQL Editor do Supabase |
| PRODUCTION-FIX.sql | SQL | Corrigir políticas RLS | SQL Editor do Supabase |
| app.js | JavaScript | Aplicação principal | Carregado pelo navegador |
| index.html | HTML | Página principal | Carregado pelo navegador |

## REFERÊNCIA RÁPIDA

**config.js** → Edite no VS Code → Salve
**AI-FIX.sql** → Copie → Cole no SQL Editor do Supabase → Execute
**PRODUCTION-FIX.sql** → Copie → Cole no SQL Editor do Supabase → Execute
**Edge Function** → Implante via CLI → Configure GEMINI_API_KEY no Painel

## SUPORTE

Se você ainda estiver confuso:
1. Leia este guia novamente
2. Siga cada passo exatamente como escrito
3. Não misture tipos de arquivo
4. Não execute arquivos em locais errados
