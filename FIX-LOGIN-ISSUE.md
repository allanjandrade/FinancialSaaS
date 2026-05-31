# Correção para Problema de Login

## Problema
A tela de login não estava abrindo e o sistema estava congelado após a implementação do recurso de conversa de IA.

## Causa Raiz
A declaração de import síncrona no topo de `app.js` estava bloqueando o carregamento de todo o aplicativo:
```javascript
import AIConversationManager from "./ai-conversations.js";
```

Se este módulo falhar ao carregar por qualquer motivo (CORS, arquivo não encontrado, etc.), todo o app.js falha ao executar, impedindo que a tela de login apareça.

## Solução
Tornar o import do gerenciador de conversa de IA condicional e opcional, para que o aplicativo funcione mesmo se os recursos de conversa falharem ao carregar.

## Correção Manual Necessária

Como edições automatizadas em app.js falharam, você precisa aplicar manualmente estas mudanças em `app.js`:

### 1. Remova o import problemático (já feito)
A linha 2 deve ser removida:
```javascript
// REMOVA ESTA LINHA:
import AIConversationManager from "./ai-conversations.js";
```

### 2. Adicione import condicional na inicialização
Encontre o código de inicialização (aproximadamente linha 1700-1800) onde a autenticação do usuário acontece, e substitua a inicialização do gerenciador de conversa por:

```javascript
// Replace this:
if (SUPABASE_READY && currentUser) {
  conversationManager = new AIConversationManager(supabase);
  await conversationManager.loadConversations();
  renderConversationList();
}

// With this:
if (SUPABASE_READY && currentUser) {
  try {
    const module = await import('./ai-conversations.js');
    AIConversationManager = module.default;
    conversationManager = new AIConversationManager(supabase);
    await conversationManager.loadConversations();
    renderConversationList();
  } catch (e) {
    // Conversation features optional - don't break app if module fails
    console.warn('AI conversation features not available:', e.message);
  }
}
```

### 3. Adicione funções de gerenciamento de conversa
Adicione estas funções ao app.js (após as funções de IA existentes):

```javascript
async function handleNewConversation() {
  if (!conversationManager || !AIConversationManager) return;
  
  try {
    await conversationManager.createConversation('Nova Conversa', 'finance');
    clearChatMessages();
    renderConversationList();
  } catch (error) {
    alert('Erro ao criar nova conversa: ' + error.message);
  }
}

function toggleConversationSidebar() {
  if (els.conversationSidebar) {
    els.conversationSidebar.style.display = 
      els.conversationSidebar.style.display === 'none' ? 'block' : 'none';
  }
}

async function renderConversationList() {
  if (!conversationManager || !els.conversationList) return;
  
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
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteConversation(conv.id);
      });
    }
    
    els.conversationList.appendChild(convElement);
  });
  
  // Reinitialize lucide icons
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
  if (els.chatMessages) {
    els.chatMessages.innerHTML = '';
    addMessageToChat('Nova conversa iniciada. Como posso ajudar você com suas finanças hoje?', 'ai', true);
  }
}
```

### 4. Atualize a função handleAiMessage
Encontre a função `handleAiMessage` e atualize-a para incluir suporte a conversa:

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
        conversationId: currentConversation?.id || null,
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

### 5. Adicione event listeners
Encontre a seção de inicialização de event listeners e adicione:

```javascript
// AI conversation management (optional features)
if (els.newConversationButton) {
  els.newConversationButton.addEventListener("click", handleNewConversation);
}

if (els.toggleConversationList) {
  els.toggleConversationList.addEventListener("click", toggleConversationSidebar);
}
```

### 6. Adicione declarações de variáveis
Encontre as declarações de variáveis no topo do arquivo e adicione:

```javascript
let conversationManager = null;
let AIConversationManager = null;
```

## Verificação
Após aplicar estas mudanças:
1. Atualize o aplicativo
2. A tela de login deve aparecer normalmente
3. Após o login, o aplicativo deve funcionar mesmo se os recursos de conversa falharem ao carregar
4. Se os recursos de conversa carregarem com sucesso, você verá os botões de gerenciamento de conversa no painel de IA

## Testes
1. Teste a funcionalidade de login
2. Teste a funcionalidade básica do aplicativo (adicionar despesas, visualizar dashboard)
3. Teste o chat de IA (com e sem recursos de conversa)
4. Verifique o console do navegador por erros
