# Guia de Teste Local

## Pré-requisitos

1. **Node.js instalado** (para executar servidor local)
2. **Projeto Supabase configurado** com variáveis de ambiente
3. **Arquivo config.js criado** com suas credenciais do Supabase

## Passo 1: Configurar Ambiente Local

### Criar config.js
Crie `config.js` no diretório app:

```javascript
window.SUPABASE_CONFIG = {
  url: 'https://your-project.supabase.co',
  anonKey: 'your-anon-key-here'
};
```

**Importante:** Nunca faça commit deste arquivo no git (já está no .gitignore)

## Passo 2: Iniciar Servidor Local

### Opção A: Usando Node.js (Recomendado)
```bash
# Instalar http-server globalmente (apenas primeira vez)
npm install -g http-server

# Iniciar servidor
cd app
http-server -p 8080
```

### Opção B: Usando Python
```bash
cd app
python -m http.server 8080
```

### Opção C: Usando PHP
```bash
cd app
php -S localhost:8080
```

### Opção D: Usando VS Code Live Server
1. Instale a extensão "Live Server" no VS Code
2. Clique com o botão direito em `index.html`
3. Selecione "Open with Live Server"

## Passo 3: Acessar Aplicação

Abra o navegador e navegue até:
- http://localhost:8080

## Passo 4: Testar Funcionalidade

### 1. Teste de Login
- [ ] Tela de login aparece
- [ ] Pode inserir email e senha
- [ ] Login bem-sucedido sem erros
- [ ] Redirecionado para o dashboard principal

### 2. Teste de Funcionalidade Básica
- [ ] Dashboard carrega corretamente
- [ ] Pode adicionar despesas
- [ ] Pode adicionar receitas
- [ ] Pode visualizar transações recentes
- [ ] Pode visualizar resumo mensal

### 3. Teste de Recursos de Família
- [ ] Dados da família carregam sem erros 403
- [ ] Pode visualizar membros da família
- [ ] Configurações são salvas corretamente

### 4. Teste do Assistente de IA
- [ ] Painel de IA carrega
- [ ] Pode digitar mensagem
- [ ] Mensagem é enviada sem erros
- [ ] IA responde (pode não funcionar se Edge Function não estiver implantada)

### 5. Teste do Service Worker
- [ ] Sem erros de clone de service worker no console
- [ ] Aplicação funciona offline (se service worker registrado)

## Passo 5: Verificar Console do Navegador

Abra DevTools (F12) e verifique a aba Console:

**Esperado:**
- Sem erros vermelhos
- Avisos sobre SENTRY_DSN e GA_MEASUREMENT_ID estão OK (esperados)
- Sem erros 403 Forbidden

**Se erros aparecerem:**
- Anote a mensagem de erro exata
- Verifique a aba Network para requisições falhadas
- Veja ERROR-RESOLUTION.md para solução de problemas

## Passo 6: Testar Edge Function Localmente (Opcional)

Se você quiser testar a Edge Function antes de implantar:

### Instalar CLI do Supabase
```bash
npm install -g supabase
```

### Vincular ao seu projeto
```bash
supabase link --project-ref your-project-ref
```

### Iniciar funções locais
```bash
supabase functions serve
```

### Testar função
```bash
curl -X POST 'http://localhost:54321/functions/v1/ai-assistant' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"message": "Olá", "acao": "chat-message"}'
```

## Passo 7: Teste de Banco de Dados

### Testar Políticas RLS
No SQL Editor do Supabase, execute:

```sql
-- Testar se usuário pode ler sua própria associação de família
SELECT * FROM family_members WHERE user_id = auth.uid();

-- Testar se usuário pode ler finanças da família
SELECT * FROM finance_states 
WHERE family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid());
```

### Testar Tabelas de IA
```sql
-- Verificar se tabelas de IA existem
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'ai_%';

-- Verificar se RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE 'ai_%';
```

## Problemas Comuns e Soluções

### Problema: "SUPABASE_CONFIG is not defined"
**Solução:** Crie o arquivo `config.js` com suas credenciais

### Problema: Erros 403 Forbidden
**Solução:** Execute a configuração SQL atualizada para aplicar políticas RLS

### Problema: Erros de Service Worker
**Solução:** Limpe o cache do service worker em DevTools → Application → Service Workers

### Problema: IA não respondendo
**Solução:**
1. Implante Edge Function: `supabase functions deploy ai-assistant`
2. Configure GEMINI_API_KEY no Painel do Supabase

### Problema: Erros de importação
**Solução:** Certifique-se de que todos os arquivos estão na estrutura de diretórios correta

## Checklist Pré-Produção

Antes de implantar em produção:

- [ ] Todos os testes passam localmente
- [ ] Sem erros no console
- [ ] Migrações de banco de dados aplicadas
- [ ] Edge Function implantada
- [ ] Variáveis de ambiente configuradas
- [ ] Service Worker funcionando corretamente
- [ ] Recursos de IA testados (se aplicável)
- [ ] config.js NÃO commitado no git
- [ ] .env.example atualizado com variáveis necessárias
- [ ] README atualizado com instruções de implantação

## Implantação em Produção

Após o teste local estar completo:

1. **Implantar no Netlify/Vercel:**
   ```bash
   # Netlify
   netlify deploy --prod
   
   # Vercel
   vercel --prod
   ```

2. **Implantar Edge Function:**
   ```bash
   supabase functions deploy ai-assistant
   ```

3. **Configurar Variáveis de Ambiente de Produção:**
   - GEMINI_API_KEY
   - SENTRY_DSN (opcional)
   - GA_MEASUREMENT_ID (opcional)

4. **Executar Migrações de Banco de Dados:**
   - Execute `supabase-setup-clean.sql` em produção

5. **Testar Produção:**
   - Visite a URL de produção
   - Execute todos os passos de teste novamente
   - Monitore logs da Edge Function
   - Verifique logs do banco de dados

## Teste de Performance

### Teste de Carga (Opcional)
Use ferramentas como:
- Apache Bench (ab)
- JMeter
- k6

Exemplo:
```bash
ab -n 100 -c 10 http://localhost:8080/
```

### Limitação de Rede
No Chrome DevTools:
1. Abra DevTools → Network
2. Clique no dropdown "Network Throttling"
3. Selecione "Slow 3G" ou "Fast 3G"
4. Teste a performance do aplicativo

## Teste de Acessibilidade

Use extensões do navegador ou ferramentas:
- Axe DevTools
- WAVE
- Lighthouse (integrado ao Chrome)

Execute Lighthouse:
```bash
# No Chrome DevTools → Lighthouse
# Ou usando CLI
npm install -g lighthouse
lighthouse http://localhost:8080
```

## Teste de Segurança

### Verificar:
- [ ] Sem credenciais codificadas no código
- [ ] HTTPS em produção
- [ ] Headers de segurança configurados (netlify.toml)
- [ ] Políticas RLS funcionando corretamente
- [ ] Sem console.log com dados sensíveis

### Testar com:
- OWASP ZAP
- Burp Suite (Community Edition)

## Monitoramento em Produção

Após a implantação:

1. **Painel do Supabase:**
   - Monitore logs do banco de dados
   - Verifique logs da Edge Function
   - Monitore uso da API

2. **Rastreamento de Erros:**
   - Configure Sentry (se usando)
   - Monitore relatórios de erros

3. **Analytics:**
   - Configure Google Analytics (se usando)
   - Monitore comportamento do usuário

4. **Performance:**
   - Monitore tempos de carregamento de página
   - Rastreie Core Web Vitals

## Plano de Rollback

Se problemas ocorrerem em produção:

1. **Rollback Imediato:**
   ```bash
   # Netlify
   netlify deploy --prod --rollback
   
   # Vercel
   vercel rollback
   ```

2. **Rollback do Banco de Dados:**
   - Use recuperação point-in-time do Supabase
   - Restaure do backup se necessário

3. **Rollback da Edge Function:**
   ```bash
   supabase functions deploy ai-assistant --version <versão-anterior>
   ```
