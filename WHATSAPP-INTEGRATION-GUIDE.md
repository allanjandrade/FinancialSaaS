# Guia de Integração com WhatsApp

## Visão Geral
Este guia descreve a arquitetura para integrar o WhatsApp com seu aplicativo de controle financeiro, permitindo que os usuários enviem comprovantes e dados de despesas via mensagens do WhatsApp.

## Opções de Arquitetura

### Opção 1: Evolution API (Recomendado para Auto-Hospedagem)
**Prós:**
- Auto-hospedado, sem taxas mensais
- Controle total da privacidade dos dados
- Pode ser hospedado em sua própria infraestrutura
- Suporta múltiplos números do WhatsApp

**Contras:**
- Requer manutenção do servidor
- Complexidade inicial da configuração

**Passos de Configuração:**
1. Implantar servidor da Evolution API (Docker recomendado)
2. Configurar endpoints de webhook
3. Criar Edge Function do Supabase para processar mensagens
4. Vincular números de telefone dos usuários aos IDs de usuário do Supabase

### Opção 2: Twilio API (Recomendado para Início Rápido)
**Prós:**
- Configuração fácil
- Infraestrutura confiável
- Boa documentação
- Camada gratuita disponível

**Contras:**
- Taxas mensais para uso em produção
- Dados passam por servidores de terceiros
- Controle limitado

**Passos de Configuração:**
1. Criar conta Twilio
2. Obter credenciais do sandbox do WhatsApp
3. Configurar URL do webhook
4. Criar Edge Function do Supabase para processamento de mensagens

## Arquitetura Recomendada

```
┌─────────────┐
│  WhatsApp   │
│   Usuário   │
└──────┬──────┘
       │
       │ (Mensagem + Imagem/PDF)
       ↓
┌─────────────┐
│ Evolution   │
│ API Server  │
└──────┬──────┘
       │
       │ (Webhook)
       ↓
┌─────────────────────┐
│ Supabase Edge       │
│ Function            │
│ - Autenticar usuário│
│ - Processar imagem  │
│ - Chamar API Gemini │
│ - Salvar no banco   │
└──────┬──────────────┘
       │
       ↓
┌─────────────┐
│ Supabase DB │
│ (despesas)  │
└─────────────┘
```

## Passos de Implementação

### 1. Fluxo de Autenticação do Usuário

**Passo 1: Gerar Token Único**
- Quando o usuário ativa a integração do WhatsApp nas configurações
- Gerar um token único (ex: `wa_token_abc123`)
- Salvar token no perfil do usuário no Supabase
- Exibir token para o usuário com instruções para enviá-lo ao bot

**Passo 2: Vincular Número de Telefone**
- Usuário envia token para o bot do WhatsApp
- Edge Function recebe mensagem
- Busca token no banco de dados
- Vincula número de telefone ao user_id
- Confirma vinculação via mensagem do WhatsApp

### 2. Estrutura da Edge Function do Supabase

Criar `supabase/functions/whatsapp-webhook/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!

serve(async (req) => {
  try {
    const { message, from, media } = await req.json()
    
    // 1. Autenticar usuário por número de telefone
    const { data: userLink } = await supabase
      .from('whatsapp_links')
      .select('user_id')
      .eq('phone_number', from)
      .single()
    
    if (!userLink) {
      return new Response(JSON.stringify({ 
        message: 'Por favor, vincule seu número nas configurações do app.' 
      }))
    }
    
    // 2. Processar imagem se presente
    if (media) {
      const base64Data = media.data
      const extractedData = await processWithGemini(base64Data, media.mime_type)
      
      // 3. Salvar no banco de dados
      await supabase.from('expenses').insert({
        user_id: userLink.user_id,
        amount: extractedData.valor,
        description: extractedData.estabelecimento,
        category: extractedData.categoria,
        payment: extractedData.metodo,
        date: extractedData.data,
        created_at: new Date().toISOString()
      })
      
      return new Response(JSON.stringify({ 
        message: `Despesa registrada: ${extractedData.estabelecimento} - R$ ${extractedData.valor}` 
      }))
    }
    
    // 4. Manipular comandos de texto
    if (message.startsWith('/')) {
      return await handleCommand(message, userLink.user_id)
    }
    
    return new Response(JSON.stringify({ 
      message: 'Envie um comprovante ou use /help para ver os comandos.' 
    }))
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})

async function processWithGemini(base64Data: string, mimeType: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: JSON_PROMPT },
            { inline_data: { mime_type: mimeType, data: base64Data } }
          ]
        }]
      })
    }
  )
  
  const data = await response.json()
  const text = data.candidates[0].content.parts[0].text
  return JSON.parse(text)
}
```

### 3. Atualizações do Esquema do Banco de Dados

Adicionar ao seu esquema do Supabase:

```sql
-- Links de usuários do WhatsApp
CREATE TABLE whatsapp_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  wa_token TEXT UNIQUE NOT NULL,
  linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Índices para buscas rápidas
CREATE INDEX idx_whatsapp_links_phone ON whatsapp_links(phone_number);
CREATE INDEX idx_whatsapp_links_token ON whatsapp_links(wa_token);

-- Políticas RLS
ALTER TABLE whatsapp_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver seus próprios links"
  ON whatsapp_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role pode gerenciar links"
  ON whatsapp_links FOR ALL
  USING (auth.role() = 'service_role');
```

### 4. Integração do Frontend

Adicionar configurações do WhatsApp à sua visualização de configurações:

```javascript
// No app.js - adicionar ao formulário de configurações
async function generateWhatsAppToken() {
  const token = 'wa_' + crypto.randomUUID().split('-').join('')
  
  const { error } = await supabase
    .from('whatsapp_links')
    .upsert({
      user_id: currentUser.id,
      wa_token: token,
      phone_number: null, // Will be set when user links
      is_active: true
    })
  
  if (error) {
    alert('Erro ao gerar token: ' + error.message)
    return
  }
  
  // Mostrar token para o usuário
  const modal = document.createElement('div')
  modal.className = 'whatsapp-token-modal'
  modal.innerHTML = `
    <div class="token-content">
      <h3>Vincular WhatsApp</h3>
      <p>Envie este token para o bot do WhatsApp:</p>
      <code class="token-display">${token}</code>
      <p>Número do bot: +55 11 99999-9999</p>
      <button onclick="this.closest('.whatsapp-token-modal').remove()">Fechar</button>
    </div>
  `
  document.body.appendChild(modal)
}
```

### 5. Comandos Suportados

- `/saldo` - Ver saldo atual
- `/despesas` - Listar despesas recentes
- `/ajuda` - Mostrar mensagem de ajuda
- `/desvincular` - Desvincular número de telefone

## Considerações de Segurança

### Crítico: Proteção da Chave de API
**NUNCA exponha sua GEMINI_API_KEY no código frontend.**

O webhook do WhatsApp deve rodar em uma Edge Function do Supabase onde:
- Chaves de API são armazenadas em variáveis de ambiente
- Apenas o service role pode acessá-las
- O frontend não pode acessar essas chaves

### Limitação de Taxa
Mesmo com limites reduzidos no frontend, implemente limitação de taxa no backend:
- Máximo de 10 requisições por minuto por número de telefone
- Máximo de 50 requisições por hora por usuário
- Use middleware da Edge Function do Supabase

### Privacidade de Dados
- Todas as mensagens do WhatsApp são processadas no servidor
- Imagens não são armazenadas permanentemente após o processamento
- Números de telefone são hasheados no banco de dados para privacidade adicional

## Checklist de Produção

- [ ] Implantar Evolution API ou configurar conta Twilio
- [ ] Criar Edge Function do Supabase para webhook
- [ ] Adicionar tabela whatsapp_links ao banco de dados
- [ ] Implementar geração de token no frontend
- [ ] Adicionar UI de configurações do WhatsApp
- [ ] Testar fluxo completo com sandbox
- [ ] Configurar monitoramento e rastreamento de erros
- [ ] Configurar limitação de taxa
- [ ] Adicionar logs para debugging
- [ ] Documentar instruções para usuários

## Estimativas de Custo

### Evolution API (Auto-Hospedado)
- Servidor: $5-20/mês (dependendo do provedor)
- WhatsApp Business API: Camada gratuita disponível
- Total: ~$5-20/mês

### Twilio
- Sandbox do WhatsApp: Gratuito
- Produção: ~$0.005 por mensagem
- Estimado para 1000 mensagens/mês: ~$5/mês

### Supabase Edge Functions
- Camada gratuita: 500K invocações/mês
- Camada Pro: $20/mês para limites maiores

## Próximos Passos

1. Escolher seu provedor de API (Evolution ou Twilio)
2. Configurar o servidor de webhook
3. Criar a Edge Function do Supabase
4. Atualizar esquema do banco de dados
5. Adicionar UI do frontend para configurações do WhatsApp
6. Testar com ambiente de sandbox
7. Implantar em produção

## Solução de Problemas

**Problema: Webhook não está recebendo mensagens**
- Verificar configuração da URL do webhook na Evolution API/Twilio
- Verificar se o servidor está acessível pela internet (use ngrok para testes)
- Verificar logs da Edge Function do Supabase

**Problema: Limites de taxa da API Gemini**
- Implementar sistema de fila para processamento
- Adicionar lógica de retry com backoff exponencial
- Monitorar uso da API no Google AI Studio

**Problema: Número de telefone do usuário não está vinculando**
- Verificar se o token foi gerado e salvo corretamente
- Verificar formato do número de telefone (incluir código do país)
- Revisar logs da Edge Function para erros
