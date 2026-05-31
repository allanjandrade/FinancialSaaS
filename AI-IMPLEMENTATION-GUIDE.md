# Guia de Implementação da Arquitetura de IA

## Visão Geral
Este guia documenta as melhorias da arquitetura de IA implementadas para o aplicativo Controle Financeiro, seguindo o padrão Core + CRUD com Supabase e Edge Functions.

## Atualizações do Esquema do Banco de Dados

### Novas Tabelas Adicionadas

#### 1. `ai_conversations`
Armazena o histórico de conversas do assistente de IA.

```sql
CREATE TABLE public.ai_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
  title VARCHAR(255),
  context VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2. `ai_messages`
Armazena mensagens individuais dentro das conversas.

```sql
CREATE TABLE public.ai_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 3. `ai_system_prompts`
Armazena prompts de sistema configuráveis para diferentes contextos.

```sql
CREATE TABLE public.ai_system_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  prompt TEXT NOT NULL,
  context VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 4. `ai_audit_logs`
Registra todas as interações com IA para monitoramento e rastreamento de custos.

```sql
CREATE TABLE public.ai_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  cost DECIMAL(10,4) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'success',
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Políticas de Segurança (RLS)

Todas as tabelas têm Row Level Security habilitado com políticas apropriadas:

- **ai_conversations**: Usuários só podem acessar suas próprias conversas
- **ai_messages**: Usuários só podem acessar mensagens de suas conversas
- **ai_system_prompts**: Todos os usuários podem ler prompts ativos
- **ai_audit_logs**: Usuários podem ler seus próprios logs; administradores da família podem ler logs da família

## Atualizações da Edge Function

### Novas Ações Adicionadas ao `ai-assistant`

#### 1. `create-conversation`
Cria uma nova conversa.

```javascript
POST /functions/v1/ai-assistant
{
  "acao": "create-conversation",
  "message": "Conversation title",
  "context": "finance"
}
```

#### 2. `list-conversations`
Lista as conversas do usuário.

```javascript
POST /functions/v1/ai-assistant
{
  "acao": "list-conversations"
}
```

#### 3. `load-conversation`
Carrega mensagens de uma conversa específica.

```javascript
POST /functions/v1/ai-assistant
{
  "acao": "load-conversation",
  "conversationId": "uuid"
}
```

#### 4. `delete-conversation`
Exclui uma conversa.

```javascript
POST /functions/v1/ai-assistant
{
  "acao": "delete-conversation",
  "conversationId": "uuid"
}
```

### Ação de Mensagem de Chat Aprimorada

A ação `chat-message` agora suporta:

- **conversationId**: Vincula mensagens a uma conversa para contexto
- **context**: Especifica qual prompt de sistema usar (finance, receipt, general)
- **histórico de conversa**: Carrega automaticamente mensagens anteriores para contexto

## Componentes do Front-End

### 1. Gerenciador de Conversas de IA (`ai-conversations.js`)
Gerencia o ciclo de vida das conversas no front-end.

```javascript
class AIConversationManager {
  async createConversation(title, context)
  async loadConversations()
  async loadConversation(conversationId)
  async deleteConversation(conversationId)
  async updateConversationTitle(conversationId, title)
}
```

### 2. Atualizações da UI em `index.html`
Adicionada barra lateral de conversa e botões de gerenciamento:
- Botão de nova conversa
- Alternador de histórico de conversa
- Barra lateral de lista de conversas
- Botões de exclusão de conversa

### 3. Atualizações do CSS (`styles.css`)
Adicionados estilos para:
- Layout da barra lateral de conversa
- Itens da lista de conversas
- Destaque de conversa ativa
- Efeitos de hover no botão de exclusão

## Interface de Administração

### `ai-admin.html`
Interface completa de administração para gerenciar recursos de IA:

#### Recursos:
1. **Gerenciamento de Prompts de Sistema**
   - Criar, editar, excluir prompts de sistema
   - Alternar prompts ativos/inativos
   - Organizar por contexto (finance, receipt, general)

2. **Painel de Monitoramento**
   - Total de mensagens processadas
   - Contagem de processamento de recibos
   - Rastreamento de uso de tokens
   - Estimativa de custos
   - Gráficos de uso

3. **Logs de Auditoria**
   - Visualizar todas as interações com IA
   - Filtrar por tipo de ação
   - Filtrar por status
   - Visualizar metadados e erros

## Prompts de Sistema Padrão

Três prompts padrão são inseridos no banco de dados:

1. **finance_assistant**: Análise financeira e insights
2. **receipt_processor**: Extração de dados de recibos
3. **general_assistant**: Assistência de propósito geral

## Passos de Integração Manual

Como algumas edições em `app.js` falharam, você precisa adicionar manualmente as seguintes funções:

### 1. Adicionar Funções de Gerenciamento de Conversa

Adicione estas funções ao `app.js` após as funções de IA existentes:

```javascript
async function handleNewConversation() {
  if (!conversationManager) return;
  
  try {
    await conversationManager.createConversation('Nova Conversa', 'finance');
    clearChatMessages();
    renderConversationList();
  } catch (error) {
    alert('Erro ao criar nova conversa: ' + error.message);
  }
}

function toggleConversationSidebar() {
  els.conversationSidebar.style.display = 
    els.conversationSidebar.style.display === 'none' ? 'block' : 'none';
}

async function renderConversationList() {
  if (!conversationManager) return;
  
  const conversations = conversationManager.getConversations();
  els.conversationList.innerHTML = '';
  
  if (conversations.length === 0) {
    els.conversationList.innerHTML = '<p class="helper-text">Nenhuma conversa ainda</p>';
    return;
  }
  
  conversations.forEach(conv => {
    const convElement = document.createElement('div');
    convElement.className = 'conversation-item';
    if (conversationManager.getCurrentConversation()?.id === conv.id) {
      convElement.classList.add('active');
    }
    
    convElement.innerHTML = `
      <div class="conversation-title">${conv.title}</div>
      <div class="conversation-date">${new Date(conv.updated_at).toLocaleDateString('pt-BR')}</div>
      <button class="delete-conversation" data-id="${conv.id}" title="Excluir">
        <i data-lucide="trash-2"></i>
      </button>
    `;
    
    convElement.addEventListener('click', (e) => {
      if (!e.target.closest('.delete-conversation')) {
        loadConversation(conv.id);
      }
    });
    
    const deleteBtn = convElement.querySelector('.delete-conversation');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteConversation(conv.id);
    });
    
    els.conversationList.appendChild(convElement);
  });
  
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

async function loadConversation(conversationId) {
  if (!conversationManager) return;
  
  try {
    const messages = await conversationManager.loadConversation(conversationId);
    clearChatMessages();
    
    messages.forEach(msg => {
      if (msg.role === 'user') {
        addUserMessageToChat(msg.content);
      } else {
        addMessageToChat(msg.content, 'ai', true);
      }
    });
    
    renderConversationList();
  } catch (error) {
    alert('Erro ao carregar conversa: ' + error.message);
  }
}

async function deleteConversation(conversationId) {
  if (!confirm('Tem certeza que deseja excluir esta conversa?')) return;
  
  try {
    await conversationManager.deleteConversation(conversationId);
    
    if (conversationManager.getCurrentConversation()?.id === conversationId) {
      clearChatMessages();
    }
    
    renderConversationList();
  } catch (error) {
    alert('Erro ao excluir conversa: ' + error.message);
  }
}

function addUserMessageToChat(message) {
  addMessageToChat(message, 'user', false);
}

function clearChatMessages() {
  els.chatMessages.innerHTML = '';
  addMessageToChat('Nova conversa iniciada. Como posso ajudar você com suas finanças hoje?', 'ai', true);
}
```

### 2. Atualizar Função `handleAiMessage`

Modifique a função existente `handleAiMessage` para incluir suporte a conversa:

```javascript
async function handleAiMessage() {
  const message = els.aiInput.value.trim();
  if (!message) return;

  if (aiCooldown) {
    addMessageToChat("Por favor, aguarde alguns segundos antes de enviar outra mensagem.", 'ai', true);
    return;
  }

  addUserMessageToChat(message);
  els.aiInput.value = "";
  
  showAiLoading(true);
  aiCooldown = true;
  
  clearTimeout(aiCooldownTimer);
  aiCooldownTimer = setTimeout(() => {
    aiCooldown = false;
  }, 2000);

  try {
    const currentConversation = conversationManager?.getCurrentConversation();
    const response = await supabase.functions.invoke('ai-assistant', {
      body: { 
        message,
        acao: 'chat-message',
        conversationId: currentConversation?.id,
        context: 'finance'
      }
    });

    if (response.error) throw response.error;

    const data = await response.json();

    hideSkeletonLoading();
    
    const renderedMarkdown = marked.parse(data.response);
    addMessageToChat(renderedMarkdown, 'ai', true);
    scrollToBottom();
  } catch (error) {
    hideSkeletonLoading();
    
    const errorMessage = error.message || 'Desculpe, houve um erro ao processar sua mensagem.';
    addMessageToChat(`**Erro:** ${errorMessage}\n\nPor favor, tente novamente em instantes.`, 'ai', true);
    scrollToBottom();
  }
}
```

### 3. Adicionar Event Listeners

Adicione estes event listeners na seção de inicialização:

```javascript
// AI conversation management
if (els.newConversationButton) {
  els.newConversationButton.addEventListener("click", handleNewConversation);
}

if (els.toggleConversationList) {
  els.toggleConversationList.addEventListener("click", toggleConversationSidebar);
}
```

### 4. Inicializar Gerenciador de Conversa

Adicione isso ao código de inicialização após a autenticação do usuário:

```javascript
if (SUPABASE_READY && currentUser) {
  conversationManager = new AIConversationManager(supabase);
  await conversationManager.loadConversations();
  renderConversationList();
}
```

## Passos de Implantação

### 1. Migração do Banco de Dados
Execute o `supabase-setup-clean.sql` atualizado na sua instância do Supabase:

```bash
# Via Painel do Supabase
# SQL Editor → supabase-setup-clean.sql → Run
```

### 2. Implantar Edge Function
Implante a Edge Function `ai-assistant` atualizada:

```bash
supabase functions deploy ai-assistant
```

### 3. Configurar Variáveis de Ambiente
Certifique-se de que estas variáveis de ambiente estão configuradas no Supabase:

- `GEMINI_API_KEY`: Sua chave de API do Google Gemini

### 4. Atualizar Arquivos do Front-End
Copie os seguintes arquivos para seu projeto:
- `ai-conversations.js`
- `ai-admin.html`
- `index.html` atualizado
- `styles.css` atualizado

### 5. Integração Manual de Código
Siga os passos de integração manual acima para atualizar `app.js`.

## Testes

### 1. Testar Gerenciamento de Conversa
- Criar uma nova conversa
- Enviar mensagens dentro da conversa
- Carregar conversas anteriores
- Excluir conversas

### 2. Testar Prompts de Sistema
- Acessar `ai-admin.html`
- Criar um novo prompt de sistema
- Alternar prompts ativos/inativos
- Verificar se os prompts são usados nas respostas da IA

### 3. Testar Monitoramento
- Enviar várias mensagens de IA
- Verificar painel de monitoramento
- Verificar rastreamento de uso de tokens e custos
- Revisar logs de auditoria

## Benefícios

### 1. Consciência de Contexto
A IA agora se lembra do histórico de conversas, fornecendo respostas mais coerentes e contextualmente relevantes.

### 2. Comportamento Configurável
Prompts de sistema podem ser modificados sem reimplantar a Edge Function, permitindo ajustes rápidos no comportamento da IA.

### 3. Monitoramento de Custos
Logs de auditoria rastreiam uso de tokens e custos, permitindo melhor gerenciamento de orçamento e otimização.

### 4. Depuração
Registro abrangente ajuda a identificar problemas e entender padrões de uso.

### 5. Experiência do Usuário
Histórico de conversas permite que os usuários referenciem discussões anteriores e continuem sessões de planejamento financeiro em andamento.

## Architecture Diagram

```
[Front-end] 
    │
    ├──(CRUD)──> [Supabase Database]
    │              ├── ai_conversations
    │              ├── ai_messages
    │              ├── ai_system_prompts
    │              └── ai_audit_logs
    │
    └──(AI)──────> [Edge Function: ai-assistant]
                      ├── Conversation Management
                      ├── System Prompt Loading
                      ├── Context Building
                      └── Gemini API Integration
```

## Melhorias Futuras

1. **Compartilhamento de Conversas**: Permitir compartilhamento de conversas entre membros da família
2. **Modelos de Prompt**: Modelos de prompt pré-construídos para tarefas financeiras comuns
3. **Alertas de Custo**: Notificar usuários ao se aproximarem dos limites de uso
4. **Exportar Conversas**: Permitir que usuários exportem histórico de conversas
5. **Entrada por Voz**: Adicionar voz para texto para interações com IA
6. **Suporte Multilíngue**: Suportar múltiplos idiomas nas conversas

## Suporte

Para problemas ou dúvidas:
1. Verifique os logs de auditoria na interface de administração
2. Revise os logs da Edge Function do Supabase
3. Verifique se as políticas RLS do banco de dados estão funcionando corretamente
4. Certifique-se de que as variáveis de ambiente estão configuradas corretamente
