<template>
  <div class="ai-view">
    <section class="ai-workspace">
      <aside class="ai-brief-panel" aria-label="Contexto do copiloto">
        <div class="ai-identity">
          <span class="ai-mark"><Bot aria-hidden="true" /></span>
          <p class="eyebrow">Copiloto financeiro</p>
          <h1>Análise assistida para decisões financeiras.</h1>
          <p>Use o chat para investigar variações, limites, categorias e próximas ações com base no seu contexto.</p>
        </div>

        <div class="brief-list">
          <div>
            <span>Modo</span>
            <strong>Somente leitura</strong>
            <small>O copiloto sugere; você confirma qualquer ação.</small>
          </div>
          <div>
            <span>Entrada</span>
            <strong>Texto, imagem ou PDF</strong>
            <small>Anexe recibos para revisar antes de registrar.</small>
          </div>
          <div>
            <span>Saída</span>
            <strong>Resposta auditável</strong>
            <small>Exporte a conversa quando precisar documentar.</small>
          </div>
        </div>

        <div class="ai-disclaimer">
          <ShieldCheck aria-hidden="true" />
          <p>Conteúdo gerado por IA pode conter imprecisões. Revise valores e datas antes de tomar decisão financeira.</p>
        </div>
      </aside>

      <section class="panel ai-panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Analista assistido</p>
            <h2>Conversa financeira</h2>
            <span>Faça perguntas objetivas sobre gastos, limites e riscos do período.</span>
          </div>
          <div class="ai-actions">
            <button class="icon-button" type="button" @click="clearChat" title="Limpar conversa" aria-label="Limpar conversa">
              <Trash2 aria-hidden="true" />
            </button>
            <button class="icon-button" type="button" @click="exportChat" title="Exportar conversa" aria-label="Exportar conversa">
              <Download aria-hidden="true" />
            </button>
          </div>
        </div>

        <div class="chat-container">
          <div class="chat-messages" ref="messagesContainer">
            <div v-if="messages.length === 0" class="welcome-message">
              <span class="welcome-icon"><Bot aria-hidden="true" /></span>
              <div>
                <h3>Comece com uma pergunta operacional</h3>
                <p>Escolha um atalho ou descreva a análise que você precisa. Quanto mais específica a pergunta, melhor a resposta.</p>
              </div>
              <div class="suggestion-grid" data-testid="chat-suggestion-cards">
                <button
                  v-for="suggestion in suggestions"
                  :key="suggestion"
                  type="button"
                  @click="askSuggestion(suggestion)"
                >
                  {{ suggestion }}
                </button>
              </div>
            </div>

            <div v-for="(msg, index) in messages" :key="index" class="message" :class="messageClass(msg)">
              <div class="message-content">
                <span class="message-role">{{ msg.role === 'user' ? 'Você' : 'Copiloto' }}</span>
                <div v-if="msg.isMarkdown" v-html="aiStore.renderMarkdown(msg.content)"></div>
                <p v-else>{{ msg.content }}</p>
                <div v-if="msg.role !== 'user'" class="message-feedback" aria-label="Feedback da resposta">
                  <button type="button" @click="registerFeedback('positive')">
                    <ThumbsUp aria-hidden="true" />
                    Útil
                  </button>
                  <button type="button" @click="registerFeedback('negative')">
                    <ThumbsDown aria-hidden="true" />
                    Revisar
                  </button>
                </div>
              </div>
            </div>

            <div v-if="loading" class="message ai loading">
              <div class="message-content loading-card">
                <span class="message-role">Copiloto</span>
                <div class="typing-indicator" aria-label="Gerando resposta">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>

          <div class="chat-input-wrapper">
            <div v-if="pendingFile" class="file-preview">
              <File aria-hidden="true" />
              <span>{{ pendingFile.name }}</span>
              <button type="button" @click="clearFile" aria-label="Remover arquivo">
                <X aria-hidden="true" />
              </button>
            </div>

            <div class="chat-input-bar">
              <input
                type="file"
                ref="fileInput"
                accept="image/*,application/pdf"
                @change="handleFileSelect"
                style="display: none;"
              />
              <button class="icon-button attach-button" type="button" @click="selectFile" title="Anexar arquivo" aria-label="Anexar arquivo">
                <Paperclip aria-hidden="true" />
              </button>
              <input
                v-model="userMessage"
                type="text"
                placeholder="Pergunte sobre gastos, riscos, limites ou anexos..."
                @keypress.enter="sendMessage"
                :disabled="loading"
              />
              <button
                class="send-button"
                type="button"
                @click="sendMessage"
                :disabled="loading || (!userMessage.trim() && !pendingFile)"
                aria-label="Enviar mensagem"
              >
                <Send v-if="!loading" aria-hidden="true" />
                <Loader2 v-else class="spin" aria-hidden="true" />
              </button>
            </div>
            <p class="input-note">Respostas são assistivas e não substituem revisão financeira humana.</p>
          </div>
        </div>
      </section>
    </section>

    <ReceiptReviewModal
      :show="showReceiptReview"
      :draft="aiStore.receiptDraft"
      @confirm="handleConfirmReceipt"
      @cancel="aiStore.closeReceiptReview"
    />
    <ConfirmModal
      :show="showConfirmModal"
      title="Confirmar"
      message="Deseja limpar a conversa?"
      @confirm="handleConfirmClear"
      @cancel="showConfirmModal = false"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useAIStore } from '@/stores/ai'
import { useNotification } from '@/composables/useNotification'
import ConfirmModal from '@/components/ConfirmModal.vue'
import ReceiptReviewModal from '@/components/ReceiptReviewModal.vue'
import {
  Bot,
  Download,
  File,
  Loader2,
  Paperclip,
  Send,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-vue-next'

const aiStore = useAIStore()
const { showToast } = useNotification()

const userMessage = ref('')
const messagesContainer = ref(null)
const fileInput = ref(null)
const showConfirmModal = ref(false)
const suggestions = [
  'Resumo dos gastos do mês',
  'Quanto gasto por mês com assinaturas?',
  'Quais assinaturas posso cortar?',
  'Quanto posso gastar esta semana?',
  'Quais categorias estão em atenção?',
  'Posso comprar um item agora?',
  'Como melhorar meu orçamento?',
  'O que mudou desde o mês passado?',
]

const messages = computed(() => aiStore.messages)
const loading = computed(() => aiStore.loading)
const pendingFile = computed(() => aiStore.pendingFile)
const showReceiptReview = computed(() => aiStore.receiptDraft != null)

async function sendMessage() {
  if (!userMessage.value.trim() && !pendingFile.value) return
  if (loading.value) return

  const message = userMessage.value
  userMessage.value = ''

  await aiStore.sendMessage(message)

  await nextTick()
  scrollToBottom()
}

function askSuggestion(suggestion) {
  userMessage.value = suggestion
  sendMessage()
}

function clearChat() {
  showConfirmModal.value = true
}

function handleConfirmClear() {
  showConfirmModal.value = false
  aiStore.clearMessages()
  showToast('Conversa limpa com sucesso!', 'success')
}

function handleConfirmReceipt(normalized) {
  const saved = aiStore.confirmReceiptFromReview(normalized)
  if (saved) {
    showToast('Despesa registrada com sucesso', 'success')
  } else {
    showToast('Informe um valor válido para registrar a despesa.', 'error')
  }
  nextTick(() => scrollToBottom())
}

function registerFeedback(kind) {
  const message = kind === 'positive'
    ? 'Feedback registrado.'
    : 'Feedback registrado para revisar a resposta.'
  showToast(message, 'info')
}

function messageClass(msg) {
  return msg.role === 'user' ? 'user' : 'ai'
}

function exportChat() {
  const chatData = JSON.stringify(messages.value, null, 2)
  const blob = new Blob([chatData], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `chat-ia-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function selectFile() {
  fileInput.value?.click()
}

function handleFileSelect(event) {
  const file = event.target.files[0]
  if (file) {
    aiStore.setPendingFile(file)
  }
}

function clearFile() {
  aiStore.clearPendingFile()
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

onMounted(() => {
  scrollToBottom()
})
</script>

<style scoped>
.ai-view {
  min-height: calc(100vh - 120px);
  padding: var(--content-pad);
}

.ai-workspace {
  width: min(var(--content-max), 100%);
  min-height: calc(100vh - 160px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
  gap: 1rem;
  align-items: stretch;
}

.ai-brief-panel,
.panel {
  border: 1px solid var(--divider);
  border-radius: var(--radius-sm);
  background: var(--surface-ledger);
  box-shadow: none;
}

.ai-brief-panel {
  min-width: 0;
  padding: 1rem;
  display: grid;
  align-content: start;
  gap: 1rem;
}

.ai-identity {
  display: grid;
  gap: 0.75rem;
}

.ai-mark,
.welcome-icon {
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  background: var(--blue-dim);
  color: var(--accent);
}

.ai-mark {
  width: 44px;
  height: 44px;
}

.ai-mark svg,
.welcome-icon svg {
  width: 22px;
  height: 22px;
}

.eyebrow {
  margin: 0;
  color: var(--accent);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: var(--eyebrow-letter-spacing);
  text-transform: uppercase;
}

h1,
h2,
h3,
p {
  margin: 0;
}

h1 {
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: var(--page-title-size);
  font-weight: var(--page-title-weight);
  line-height: var(--page-title-line-height);
  letter-spacing: 0;
}

.ai-identity p:not(.eyebrow),
.panel-head span,
.welcome-message p,
.brief-list small,
.ai-disclaimer p,
.input-note {
  color: var(--text-secondary);
  line-height: 1.55;
}

.brief-list {
  display: grid;
  gap: 0.6rem;
}

.brief-list > div {
  padding: 0.8rem;
  display: grid;
  gap: 0.25rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
}

.brief-list span,
.message-role {
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.brief-list strong {
  color: var(--text-primary);
  font-size: 0.9rem;
}

.ai-disclaimer {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.65rem;
  padding: 0.85rem;
  border: 1px solid color-mix(in srgb, var(--warning) 28%, var(--border-color));
  border-radius: var(--radius-md);
  background: var(--savings-dim);
}

.ai-disclaimer svg {
  width: 18px;
  height: 18px;
  color: var(--warning);
}

.ai-panel {
  width: min(800px, 100%);
  min-width: 0;
  justify-self: stretch;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-head {
  min-height: 76px;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.panel-head h2 {
  margin: 0.15rem 0;
  color: var(--text-primary);
  font-size: 1.2rem;
  font-weight: 700;
}

.ai-actions {
  display: flex;
  gap: 0.5rem;
}

.icon-button,
.send-button {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.icon-button {
  border: 1px solid var(--border-color);
  background: var(--bg-panel);
  color: var(--text-secondary);
  transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
}

.icon-button:hover,
.icon-button:focus-visible {
  background: var(--blue-dim);
  border-color: color-mix(in srgb, var(--accent) 32%, var(--border-color));
  color: var(--accent);
}

.icon-button svg,
.send-button svg {
  width: 18px;
  height: 18px;
}

.chat-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  background: var(--bg-elevated);
}

.welcome-message {
  min-height: 100%;
  padding: 1.5rem;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 1rem;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--bg-panel);
  text-align: center;
}

.welcome-icon {
  width: 52px;
  height: 52px;
}

.welcome-message h3 {
  color: var(--text-primary);
  font-size: 1.05rem;
}

.welcome-message p {
  max-width: 560px;
}

.suggestion-grid {
  width: min(640px, 100%);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.suggestion-grid button {
  min-height: 44px;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-panel);
  color: var(--text-primary);
  cursor: pointer;
  font-weight: 700;
  text-align: left;
}

.suggestion-grid button:hover,
.suggestion-grid button:focus-visible {
  border-color: color-mix(in srgb, var(--accent) 32%, var(--border-color));
  background: var(--blue-dim);
}

.message {
  display: flex;
  max-width: min(86%, 680px);
}

.message.user {
  align-self: flex-end;
}

.message.ai {
  align-self: flex-start;
}

.message-content {
  min-width: 0;
  padding: 0.85rem 1rem;
  display: grid;
  gap: 0.45rem;
  border-radius: var(--radius-md);
  line-height: 1.55;
}

.message-content p {
  color: inherit;
}

.message.user .message-content {
  background: var(--accent);
  color: white;
}

.message.user .message-role {
  color: rgba(255, 255, 255, 0.76);
}

.message.ai .message-content {
  background: var(--bg-panel);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.loading-card {
  min-width: 150px;
}

.message-feedback {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  padding-top: 0.35rem;
  border-top: 1px solid var(--border-color);
}

.message-feedback button {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 800;
}

.message-feedback svg {
  width: 14px;
  height: 14px;
}

.typing-indicator {
  display: flex;
  gap: 0.25rem;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: var(--accent);
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-6px);
  }
}

.chat-input-wrapper {
  padding: 1rem;
  display: grid;
  gap: 0.55rem;
  border-top: 1px solid var(--border-color);
  background: var(--bg-panel);
}

.file-preview {
  min-height: 40px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--border-color));
  border-radius: var(--radius-sm);
  background: var(--blue-dim);
  color: var(--accent);
  font-size: 0.875rem;
}

.file-preview button {
  margin-left: auto;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--danger);
  display: flex;
  align-items: center;
}

.chat-input-bar {
  min-height: 52px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.35rem;
  background: var(--bg-input);
}

.chat-input-bar:focus-within {
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}

.chat-input-bar input[type="text"] {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  padding: 0.5rem;
  font-size: 0.875rem;
  outline: none;
  color: var(--text-primary);
}

.chat-input-bar input[type="text"]:disabled {
  opacity: 0.5;
}

.attach-button {
  flex: 0 0 auto;
}

.send-button {
  flex: 0 0 auto;
  border: none;
  background: var(--accent);
  color: white;
  transition: background 0.16s ease, box-shadow 0.16s ease;
}

.send-button:hover:not(:disabled),
.send-button:focus-visible:not(:disabled) {
  background: var(--accent-hover);
  box-shadow: var(--shadow-glow);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-note {
  font-size: 0.75rem;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 980px) {
  .ai-workspace {
    grid-template-columns: 1fr;
  }

  .ai-brief-panel {
    grid-template-columns: minmax(0, 1fr);
  }

  .ai-panel {
    min-height: 680px;
  }
}

@media (max-width: 640px) {
  .ai-view {
    padding: 0.75rem;
  }

  .ai-workspace {
    min-height: auto;
  }

  .panel-head,
  .chat-input-bar {
    align-items: stretch;
  }

  .panel-head {
    display: grid;
  }

  .suggestion-grid {
    grid-template-columns: 1fr;
  }

  .message {
    max-width: 100%;
  }

  .chat-input-bar {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
  }
}
</style>
