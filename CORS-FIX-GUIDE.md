# Correção de Erro CORS - Problema de Protocolo de Arquivo

## Problema Identificado
Você está abrindo arquivos HTML diretamente via clique duplo (protocolo file://), o que causa erros CORS com módulos ES.

**Erro no console:**
```
Access to script at 'file:///C:/Users/.../auth.js' from origin 'null' has been blocked by CORS policy
```

## Por Que Isso Acontece
Navegadores bloqueiam o carregamento de módulos ES de origens file:// por segurança. Módulos requerem protocolo http:// ou https://.

## Correção Imediata

### Passo 1: Verificar se http-server Está Rodando
Seu terminal mostra que http-server já está rodando na porta 8080. ✅

### Passo 2: Acessar via URL Correta
**ERRADO:** `file:///C:/Users/.../login.html` (clique duplo)
**CORRETO:** `http://localhost:8080/login.html` (digite no navegador)

### Passo 3: Abrir no Navegador
Digite esta URL exata no seu navegador:
```
http://localhost:8080/login.html
```

Ou para o aplicativo principal:
```
http://localhost:8080/index.html
```

## Por Que Isso Funciona
- http-server serve arquivos via protocolo http://
- Navegadores permitem módulos ES via http://
- Isso imita o ambiente de produção (https://)

## Se http-server Parou
Reinicie-o na pasta do projeto:
```bash
npx http-server -p 8080
```

Em seguida acesse: `http://localhost:8080/login.html`

## Implantação em Produção
Quando você implantar no Netlify/Vercel, os arquivos serão servidos via https:// automaticamente, então este problema não ocorrerá em produção.

## Teste Rápido
1. Abra o navegador
2. Digite: `http://localhost:8080/login.html`
3. Login deve funcionar
4. Agente de IA deve funcionar
