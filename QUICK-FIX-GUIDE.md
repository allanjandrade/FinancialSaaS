# Guia de Correção Rápida - Login e IA Não Funcionando

## Análise do Problema
A tela de login e o agente de IA não estão funcionando. Após investigação, descobri:

### Status do Módulo ES ✅
Todos os arquivos HTML já têm atributos `type="module"` corretos:
- `index.html`: `<script type="module" src="./app.js"></script>` ✅
- `login.html`: `<script type="module" src="./auth.js"></script>` ✅
- `family-setup.html`: `<script type="module" src="./family-setup.js"></script>` ✅
- `ai-admin.html`: `<script type="module">` ✅

### Arquivo de Conversas de IA ✅
O arquivo `ai-conversations.js` existe no local correto.

## Causa Raiz: Configuração do Supabase Ausente
O problema mais provável é que `config.js` não está configurado com suas credenciais do Supabase.

## Passos de Correção Imediata

### Passo 1: Verifique Seu config.js
Abra `config.js` e verifique se tem suas credenciais reais do Supabase:

```javascript
window.SUPABASE_CONFIG = {
  url: "YOUR_SUPABASE_URL_HERE",
  anonKey: "YOUR_SUPABASE_ANON_KEY_HERE"
};

**Se ainda tiver os valores placeholder**, esse é o problema.

### Passo 2: Obtenha Suas Credenciais do Supabase
1. Vá para https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá para Settings → API
4. Copie:
   - **Project URL** → substitua `YOUR_SUPABASE_URL_HERE`
   - **anon public key** → substitua `YOUR_SUPABASE_ANON_KEY_HERE`

### Passo 3: Atualize config.js
Substitua os valores placeholder por suas credenciais reais:

```javascript
window.SUPABASE_CONFIG = {
  url: "https://your-project-id.supabase.co",
  anonKey: "your-anon-key-here"
};
```

### Passo 4: Limpe o Cache do Navegador
Como você está usando módulos ES, o navegador pode cachear imports antigos:
1. Abra Developer Tools (F12)
2. Clique com o botão direito no botão de atualização
3. Selecione "Empty Cache and Hard Reload"
4. Ou use Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)

### Passo 5: Teste
1. Abra `http://localhost:8080/login.html`
2. Tente fazer login ou criar uma conta
3. Se bem-sucedido, o agente de IA também deve funcionar

## Alternativa: Use Ferramenta de Debug
Criei `debug-config.html` para ajudar a diagnosticar o problema:
1. Abra `http://localhost:8080/debug-config.html`
2. Ele verificará automaticamente sua configuração
3. Siga as instruções na tela

## Problemas Comuns

### "Cannot use import statement outside a module"
Este erro NÃO deve ocorrer já que todos os arquivos HTML já têm `type="module"`. Se você ver isso, verifique:
- Você está acessando o arquivo HTML diretamente (não através de um servidor)
- O servidor está servindo o arquivo HTML correto
- Limpe o cache do navegador

### "supabase is null" ou "Cannot read properties of null"
Isso significa que o cliente Supabase não foi inicializado. Verifique:
- `config.js` existe e tem credenciais corretas
- Credenciais não são valores placeholder
- Sem erros JavaScript no console antes da inicialização do Supabase

### Agente de IA Não Respondendo
Se o login funciona mas a IA não:
1. Verifique o console do navegador por erros
2. Verifique se a Edge Function está implantada no Supabase
3. Verifique se `GEMINI_API_KEY` está configurado nos secrets da Edge Function do Supabase

## Verificação
Após corrigir config.js, abra o console do navegador (F12) e verifique:
- Sem erros vermelhos
- `window.SUPABASE_CONFIG` está definido
- `window.supabase` está definido (no contexto do app.js)

## Ainda Não Funciona?
1. Abra `debug-config.html` para diagnóstico automatizado
2. Verifique o console do navegador por mensagens de erro específicas
3. Verifique se o projeto Supabase está ativo e não pausado
4. Verifique a aba network por requisições de API falhadas
