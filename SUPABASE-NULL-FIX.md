# Correção de Erro de Cliente Supabase Nulo

## Problema
Erros ocorrendo:
- `Cannot read properties of null (reading 'auth')` em auth.js
- `Cannot read properties of null (reading 'from')` em app.js

## Causa Raiz
O cliente Supabase está sendo inicializado como `null` porque a configuração não está carregada:

```javascript
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;  // ← Isso está acontecendo
```

Quando `SUPABASE_URL` ou `SUPABASE_ANON_KEY` são indefinidos, `supabase` torna-se `null`.

## Correção Imediata

### Passo 1: Verifique Seu config.js
Você tem `config.js` aberto em sua IDE. Verifique se tem credenciais REAIS, não placeholders:

**ERRADO (placeholders):**
```javascript
window.SUPABASE_CONFIG = {
  url: "YOUR_SUPABASE_URL_HERE",
  anonKey: "YOUR_SUPABASE_ANON_KEY_HERE"
};
```

**CORRETO (valores reais):**
```javascript
window.SUPABASE_CONFIG = {
  url: "https://your-project-id.supabase.co",
  anonKey "your-anon-key-here"
};
```

### Passo 2: Obtenha Credenciais Reais
1. Vá para https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá para **Settings → API**
4. Copie:
   - **Project URL** (começa com https://)
   - **anon public key** (token JWT longo)

### Passo 3: Atualize config.js
Substitua os valores placeholder por suas credenciais reais:

```javascript
window.SUPABASE_CONFIG = {
  url: "https://your-actual-project-id.supabase.co",
  anonKey: "your-actual-anon-key-here"
};
```

### Passo 4: Salve e Teste
1. Salve `config.js`
2. Abra o navegador: `http://localhost:8080/login.html`
3. Tente fazer login

## Verificação
Após corrigir, abra o console do navegador (F12) e verifique:
- `window.SUPABASE_CONFIG` deve estar definido com valores reais
- Sem erros "Cannot read properties of null"
- Login deve funcionar

## Para Produção (Netlify/Vercel)
Ao implantar, configure variáveis de ambiente:
- `VITE_SUPABASE_URL` = sua URL do projeto
- `VITE_SUPABASE_ANON_KEY` = sua chave anon

## Se config.js Estiver Ausente
Como config.js está no .gitignore, pode não existir:
1. Copie de `config.js.example`
2. Renomeie para `config.js`
3. Preencha com credenciais reais
