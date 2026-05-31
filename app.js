import AIConversationManager from "./ai-conversations.js";

// Use global Supabase client initialized in HTML
const supabase = window.supabase;

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

const monthNames = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const expenseCategories = ["Alimentação", "Transporte", "Lazer", "Carro", "Moradia", "Saúde", "Educação", "Vestuário", "Outro"];
const incomeTypes = ["Salário", "Vale alimentação", "Extra", "Reembolso", "Pix recebido", "Investimentos", "Outro"];
const paymentMethods = ["Pix", "Débito", "Dinheiro", "Vale alimentação", "Cartão de crédito", "Outro"];
const vaCategories = new Set(["Mercado", "Açougue", "Feira"]);

const EMPTY_STATE = {
  settings: {
    year: new Date().getFullYear(),
    selectedMonth: new Date().getMonth() + 1,
    cardLimit: 0,
    cardClosingDay: 1,
    cardDueDay: 10,
    vaInitialBalance: 0,
    hideBalance: false,
  },
  incomes: [],
  expenses: [],
};

const STORAGE_KEY = "controle-financeiro-app-v1";
const CACHE_KEY = "controle-financeiro-cache-v1";

let state = null;
let currentUser = null;
let currentFamily = null;
let currentUserRole = null;
let remoteReady = false;
let syncTimer = null;
let realtimeSubscription = null;
let familyMembersSubscription = null;
let aiCooldown = false;
let aiCooldownTimer = null;
let conversationManager = null;

const els = {
  title: document.querySelector("#screenTitle"),
  monthSelect: document.querySelector("#monthSelect"),
  summaryGrid: document.querySelector("#summaryGrid"),
  recentList: document.querySelector("#recentList"),
  entriesTable: document.querySelector("#entriesTable"),
  monthlyList: document.querySelector("#monthlyList"),
  cardLedger: document.querySelector("#cardLedger"),
  benefitGrid: document.querySelector("#benefitGrid"),
  entryForm: document.querySelector("#entryForm"),
  entryType: document.querySelector("#entryType"),
  entryDate: document.querySelector("#entryDate"),
  entryAmount: document.querySelector("#entryAmount"),
  entryCategory: document.querySelector("#entryCategory"),
  entryPayment: document.querySelector("#entryPayment"),
  entryDescription: document.querySelector("#entryDescription"),
  entryPaid: document.querySelector("#entryPaid"),
  categoryLabel: document.querySelector("#categoryLabel"),
  paymentLabel: document.querySelector("#paymentLabel"),
  paidLabel: document.querySelector("#paidLabel"),
  sidebarToggle: document.querySelector("#sidebarToggle"),
  sidebar: document.querySelector(".sidebar"),
  mobileMenuButton: document.querySelector("#mobileMenuButton"),
  mobileDrawer: document.querySelector("#mobileDrawer"),
  drawerOverlay: document.querySelector("#drawerOverlay"),
  drawerClose: document.querySelector("#drawerClose"),
  toggleBalanceButton: document.querySelector("#toggleBalanceButton"),
  clearEntryButton: document.querySelector("#clearEntryButton"),
  exportButton: document.querySelector("#exportButton"),
  moreOptionsButton: document.querySelector("#moreOptionsButton"),
  moreOptionsPopover: document.querySelector("#moreOptionsPopover"),
  chatMessages: document.querySelector("#chatMessages"),
  aiInput: document.querySelector("#aiInput"),
  aiFileInput: document.querySelector("#aiFileInput"),
  attachFileButton: document.querySelector("#attachFileButton"),
  filePreviewChip: document.querySelector("#filePreviewChip"),
  chipFileName: document.querySelector("#chipFileName"),
  chipRemove: document.querySelector("#chipRemove"),
  smartChipsContainer: document.querySelector("#smartChipsContainer"),
  sendAiMessage: document.querySelector("#sendAiMessage"),
  newConversationButton: document.querySelector("#newConversationButton"),
  settingsMenuButton: document.querySelector("#settingsMenuButton"),
  settingsPopover: document.querySelector("#settingsPopover"),
  closeSettingsPopover: document.querySelector("#closeSettingsPopover"),
  toggleConversationList: document.querySelector("#toggleConversationList"),
  conversationSidebar: document.querySelector("#conversationSidebar"),
  conversationList: document.querySelector("#conversationList"),
  typingIndicator: document.querySelector("#typingIndicator"),
  entryInstallment: document.querySelector("#entryInstallment"),
  installmentCountRow: document.querySelector("#installmentCountRow"),
  entryInstallmentCount: document.querySelector("#entryInstallmentCount"),
  payCardBillButton: document.querySelector("#payCardBillButton"),
  barChart: document.querySelector("#barChart"),
  donutChart: document.querySelector("#donutChart"),
  authUserEmail: document.querySelector("#authUserEmail"),
  settingsForm: document.querySelector("#settingsForm"),
  cardSettingsForm: document.querySelector("#cardSettingsForm"),
  cardLimitInput: document.querySelector("#cardLimitInput"),
  cardClosingDayInput: document.querySelector("#cardClosingDayInput"),
  cardDueDayInput: document.querySelector("#cardDueDayInput"),
  settingCardLimit: document.querySelector("#settingCardLimit"),
  settingVaInitialBalance: document.querySelector("#settingVaInitialBalance"),
  settingCardClosingDay: document.querySelector("#settingCardClosingDay"),
  settingCardDueDay: document.querySelector("#settingCardDueDay"),
  familyInfo: document.querySelector("#familyInfo"),
  familyActions: document.querySelector("#familyActions"),
  createFamilyButton: document.querySelector("#createFamilyButton"),
  inviteMemberButton: document.querySelector("#inviteMemberButton"),
  membersList: document.querySelector("#membersList"),
  uploadComprovante: document.querySelector("#upload-comprovante"),
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  loadState();
  populateMonths();
  setDefaultDate();
  wireEvents();
  setEntryType("expense");
  render();
  lucide.createIcons();
  initSupabase();
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function getState() {
  return state;
}

function setState(newState) {
  state = newState;
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    state = structuredClone(EMPTY_STATE);
    return state;
  }
  try {
    const parsed = JSON.parse(saved);
    state = {
      settings: { ...EMPTY_STATE.settings, ...parsed.settings },
      incomes: Array.isArray(parsed.incomes) ? parsed.incomes : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    };
    return state;
  } catch {
    state = structuredClone(EMPTY_STATE);
    return state;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  scheduleRemoteSave();
}

function monthKeyFromDate(dateString, shift = 0) {
  const [year, month] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1 + shift, 1);
  return date.getFullYear() * 100 + (date.getMonth() + 1);
}

function calculateCardCompetency(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const closingDay = state.settings.cardClosingDay || 1;
  
  let competencyMonth, competencyYear;
  
  if (day <= closingDay) {
    const nextMonth = new Date(year, month, 1);
    competencyMonth = nextMonth.getMonth() + 1;
    competencyYear = nextMonth.getFullYear();
  } else {
    const nextNextMonth = new Date(year, month + 1, 1);
    competencyMonth = nextNextMonth.getMonth() + 1;
    competencyYear = nextNextMonth.getFullYear();
  }
  
  return { competencyMonth, competencyYear };
}

function createExpense(data) {
  const { competencyMonth, competencyYear } = calculateCardCompetency(data.date);
  return {
    id: data.id || crypto.randomUUID?.() || Math.random().toString(36).substring(2, 11),
    date: data.date,
    category: data.category,
    description: data.description || "Sem descrição",
    payment: data.payment,
    amount: Number(data.amount),
    paid: Boolean(data.paid),
    cardCompetencyMonth: competencyMonth,
    cardCompetencyYear: competencyYear,
    created_at: data.created_at || new Date().toISOString()
  };
}

function createIncome(data) {
  return {
    id: data.id || crypto.randomUUID?.() || Math.random().toString(36).substring(2, 11),
    date: data.date,
    type: data.type,
    description: data.description || "Sem descrição",
    amount: Number(data.amount),
    created_at: data.created_at || new Date().toISOString()
  };
}

function selectedKey() {
  return state.settings.year * 100 + state.settings.selectedMonth;
}

function expenseImpactKey(expense) {
  if (expense.payment === "Cartao de credito") {
    if (expense.cardCompetencyMonth && expense.cardCompetencyYear) {
      return expense.cardCompetencyYear * 100 + expense.cardCompetencyMonth;
    }
    return monthKeyFromDate(expense.date, 1);
  }
  return monthKeyFromDate(expense.date, 0);
}

function isVaExpense(expense) {
  return expense.payment === "Vale alimentacao" && vaCategories.has(expense.category);
}

function calcMonth(month) {
  const key = state.settings.year * 100 + month;
  const incomeCash = state.incomes
    .filter((item) => monthKeyFromDate(item.date) === key && item.type !== "Vale alimentacao")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const vaIncome = state.incomes
    .filter((item) => monthKeyFromDate(item.date) === key && item.type === "Vale alimentacao")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  
  const cashExpenses = state.expenses
    .filter((item) => {
      const isCashPayment = item.payment !== "Cartao de credito";
      const impactsThisMonth = expenseImpactKey(item) === key;
      return isCashPayment && impactsThisMonth;
    })
    .reduce((sum, item) => sum + Number(item.amount), 0);
  
  const cardBill = state.expenses
    .filter((item) => item.payment === "Cartao de credito" && expenseImpactKey(item) === key)
    .reduce((sum, item) => sum + Number(item.amount), 0);
  
  const vaUse = state.expenses
    .filter((item) => expenseImpactKey(item) === key && isVaExpense(item))
    .reduce((sum, item) => sum + Number(item.amount), 0);
  
  return {
    key,
    incomeCash,
    vaIncome,
    cashExpenses,
    cardBill,
    vaUse,
    cashBalance: incomeCash - (cashExpenses - vaUse),
  };
}

function vaBalanceUntil(month) {
  let balance = Number(state.settings.vaInitialBalance || 0);
  for (let current = 1; current <= month; current += 1) {
    const item = calcMonth(current);
    balance += item.vaIncome - item.vaUse;
  }
  return balance;
}

function categoryTotals() {
  const key = selectedKey();
  return state.expenses
    .filter((item) => expenseImpactKey(item) === key)
    .reduce((totals, item) => {
      totals[item.category] = (totals[item.category] || 0) + Number(item.amount);
      return totals;
    }, {});
}

function cardCount(key) {
  return state.expenses.filter((item) => expenseImpactKey(item) === key && item.payment === "Cartao de credito").length;
}

function formatDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return shortDate.format(new Date(year, month - 1, day));
}

function formatImpact(key) {
  const year = Math.floor(key / 100);
  const month = key % 100;
  return `${monthNames[month - 1]}/${year}`;
}

function populateMonths() {
  const state = getState();
  els.monthSelect.innerHTML = monthNames
    .map((name, index) => `<option value="${index + 1}">${name}/${state.settings.year}</option>`)
    .join("");
  els.monthSelect.value = String(state.settings.selectedMonth);
}

function setDefaultDate() {
  const state = getState();
  const month = String(state.settings.selectedMonth).padStart(2, "0");
  els.entryDate.value = `${state.settings.year}-${month}-01`;
}

function wireEvents() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      switchView(button.dataset.view);
    });
  });

  document.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.go));
  });

  document.querySelectorAll("[data-open-entry]").forEach((button) => {
    button.addEventListener("click", () => {
      switchView("entries");
      setEntryType(button.dataset.openEntry);
    });
  });

  document.querySelectorAll("[data-entry-type]").forEach((button) => {
    button.addEventListener("click", () => setEntryType(button.dataset.entryType));
  });

  if (els.monthSelect) {
    els.monthSelect.addEventListener("change", () => {
      const state = getState();
      state.settings.selectedMonth = Number(els.monthSelect.value);
      setState(state);
      saveState();
      setDefaultDate();
      render();
    });
  }

  if (els.entryForm) {
    els.entryForm.addEventListener("submit", handleSubmit);
  }
  
  const exportButton = document.querySelector("#exportButton");
  if (exportButton) {
    exportButton.addEventListener("click", exportData);
  }
  
  const clearButton = document.querySelector("#clearButton");
  if (clearButton) {
    clearButton.addEventListener("click", resetData);
  }
  
  const logoutButton = document.querySelector("#logoutButton");
  if (logoutButton) {
    logoutButton.addEventListener("click", logout);
  }
  
  if (els.settingsForm) {
    els.settingsForm.addEventListener("submit", handleSettingsSubmit);
  }
  
  if (els.cardSettingsForm) {
    els.cardSettingsForm.addEventListener("submit", handleCardSettingsSubmit);
  }
  
  if (els.createFamilyButton) {
    els.createFamilyButton.addEventListener("click", () => {
      const familyName = prompt("Nome da família:");
      if (familyName) createFamily(familyName);
    });
  }
  
  if (els.inviteMemberButton) {
    els.inviteMemberButton.addEventListener("click", () => {
      const email = prompt("E-mail do membro para convidar:");
      if (email) inviteMember(email);
    });
  }
  
  if (els.sidebarToggle) {
    els.sidebarToggle.addEventListener("click", toggleSidebar);
  }
  
  if (els.toggleBalanceButton) {
    els.toggleBalanceButton.addEventListener("click", toggleBalance);
  }
  
  if (els.uploadComprovante) {
    els.uploadComprovante.addEventListener("change", handleReceiptUpload);
  }
  
  if (els.clearEntryButton) {
    els.clearEntryButton.addEventListener("click", clearEntryForm);
  }
  if (els.sendAiMessage) {
    els.sendAiMessage.addEventListener("click", sendAiMessageHandler);
  }
  if (els.aiInput) {
    els.aiInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendAiMessageHandler();
    });
  }
  if (els.attachFileButton) {
    els.attachFileButton.addEventListener("click", () => els.aiFileInput.click());
  }
  if (els.aiFileInput) {
    els.aiFileInput.addEventListener("change", handleChatFileUpload);
  }
  if (els.chipRemove) {
    els.chipRemove.addEventListener("click", removeFilePreview);
  }
  if (els.smartChipsContainer) {
    els.smartChipsContainer.querySelectorAll('.smart-chip').forEach(chip => {
      chip.addEventListener('click', handleSmartChip);
    });
  }
  if (els.settingsMenuButton) {
    els.settingsMenuButton.addEventListener("click", toggleSettingsPopover);
  }
  if (els.closeSettingsPopover) {
    els.closeSettingsPopover.addEventListener("click", toggleSettingsPopover);
  }
  if (els.settingsPopover) {
    els.settingsPopover.querySelectorAll('.popover-item').forEach(item => {
      item.addEventListener('click', handleSettingsAction);
    });
  }
  // Close popover when clicking outside
  document.addEventListener('click', (e) => {
    if (els.settingsPopover && els.settingsMenuButton) {
      if (!els.settingsPopover.contains(e.target) && !els.settingsMenuButton.contains(e.target)) {
        els.settingsPopover.style.display = 'none';
      }
    }
  });
  if (els.newConversationButton) {
    els.newConversationButton.addEventListener("click", startNewConversation);
  }
  if (els.toggleConversationList) {
    els.toggleConversationList.addEventListener("click", toggleConversationSidebar);
  }
  if (els.entryInstallment) {
    els.entryInstallment.addEventListener("change", toggleInstallmentField);
  }
  if (els.payCardBillButton) {
    els.payCardBillButton.addEventListener("click", handlePayCardBill);
  }
  
  // Mobile menu listeners
  if (els.mobileMenuButton) {
    els.mobileMenuButton.addEventListener("click", (e) => {
      e.preventDefault();
      openMobileDrawer();
    });
  }
  if (els.drawerClose) {
    els.drawerClose.addEventListener("click", closeMobileDrawer);
  }
  if (els.drawerOverlay) {
    els.drawerOverlay.addEventListener("click", closeMobileDrawer);
  }
  
  // Drawer navigation items
  document.querySelectorAll('.drawer-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const view = e.currentTarget.dataset.view;
      switchView(view);
      closeMobileDrawer();
    });
  });
  
  // Initialize sidebar as collapsed on mobile
  if (window.innerWidth <= 980 && els.sidebar) {
    els.sidebar.classList.add('collapsed');
  }
  
  // Show/hide mobile menu button based on screen size
  window.addEventListener('resize', handleResize);
  handleResize();
  
  // Debug script to identify elements causing overflow
  document.querySelectorAll('*').forEach(el => {
    if (el.offsetWidth > document.documentElement.clientWidth) {
      console.warn('Elemento causando quebra:', el, 'Largura:', el.offsetWidth, 'Viewport:', document.documentElement.clientWidth);
      el.style.outline = '2px solid red';
    }
  });
  
  // More options popover
  if (els.moreOptionsButton) {
    els.moreOptionsButton.addEventListener("click", toggleMoreOptionsPopover);
  }
  
  // Close popover when clicking outside
  document.addEventListener('click', (e) => {
    if (els.moreOptionsPopover && els.moreOptionsButton) {
      if (!els.moreOptionsPopover.contains(e.target) && !els.moreOptionsButton.contains(e.target)) {
        els.moreOptionsPopover.style.display = 'none';
      }
    }
  });
  
  // More options popover items
  if (els.moreOptionsPopover) {
    els.moreOptionsPopover.querySelectorAll('.popover-item').forEach(item => {
      item.addEventListener('click', handleMoreOptionsAction);
    });
  }
  
  // Handle resize events
  window.addEventListener('resize', () => {
    if (window.innerWidth <= 980 && els.sidebar) {
      els.sidebar.classList.add('collapsed');
    } else if (els.sidebar) {
      els.sidebar.classList.remove('collapsed');
    }
  });
}

function toggleSidebar() {
  if (!els.sidebar) return;
  els.sidebar.classList.toggle('collapsed');
}

function toggleBalance() {
  const state = getState();
  state.settings.hideBalance = !state.settings.hideBalance;
  setState(state);
  saveState();
  render();
  updateBalanceButtonIcon();
}

function updateBalanceButtonIcon() {
  const state = getState();
  const icon = els.toggleBalanceButton?.querySelector('i');
  if (icon) {
    icon.setAttribute('data-lucide', state.settings.hideBalance ? 'eye-off' : 'eye');
    lucide.createIcons();
  }
}

function clearEntryForm() {
  if (!els.entryForm) return;
  els.entryForm.reset();
  setDefaultDate();
  setEntryType(els.entryType.value || 'expense');
  toggleInstallmentField();
}

async function handleReceiptUpload(event) {
  const arquivo = event.target.files[0];
  if (!arquivo) return;

  // Validate file type (images and PDFs)
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
  if (!validTypes.includes(arquivo.type)) {
    alert('Por favor, selecione uma imagem (JPEG, PNG, WebP) ou um PDF.');
    return;
  }

  // Validate file size (max 10MB)
  if (arquivo.size > 10 * 1024 * 1024) {
    alert('O arquivo é muito grande. Por favor, selecione um arquivo com até 10MB.');
    return;
  }

  // Show preview modal before processing
  showReceiptPreview(arquivo);
}

async function handleChatFileUpload(event) {
  const arquivo = event.target.files[0];
  if (!arquivo) return;

  // Validate file type (images and PDFs)
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
  if (!validTypes.includes(arquivo.type)) {
    alert('Por favor, selecione uma imagem (JPEG, PNG, WebP) ou um PDF.');
    return;
  }

  // Validate file size (max 10MB)
  if (arquivo.size > 10 * 1024 * 1024) {
    alert('O arquivo é muito grande. Por favor, selecione um arquivo com até 10MB.');
    return;
  }

  // Show file preview
  showFilePreview(arquivo);
  
  // Store file for later processing
  window.pendingFile = arquivo;
}

function showFilePreview(arquivo) {
  if (!els.filePreviewChip || !els.chipFileName) return;
  
  els.chipFileName.textContent = arquivo.name;
  els.filePreviewChip.style.display = 'flex';
  
  if (els.chipRemove) {
    lucide.createIcons();
  }
}

function removeFilePreview() {
  if (!els.filePreviewChip) return;
  
  els.filePreviewChip.style.display = 'none';
  els.aiFileInput.value = '';
  window.pendingFile = null;
}

function handleSmartChip(e) {
  const suggestion = e.currentTarget.dataset.suggestion;
  
  if (suggestion === 'Anexar nota fiscal') {
    if (els.aiFileInput) {
      els.aiFileInput.click();
    }
  } else {
    // Add suggestion to input
    if (els.aiInput) {
      els.aiInput.value = suggestion;
      els.aiInput.focus();
    }
  }
}

function toggleSettingsPopover() {
  if (!els.settingsPopover) return;
  
  const isVisible = els.settingsPopover.style.display === 'flex';
  els.settingsPopover.style.display = isVisible ? 'none' : 'flex';
  
  if (!isVisible) {
    lucide.createIcons();
  }
}

function handleSettingsAction(e) {
  const action = e.currentTarget.dataset.action;
  
  switch (action) {
    case 'clear-history':
      // Clear chat history
      if (els.chatMessages) {
        els.chatMessages.innerHTML = `
          <div class="ai-message">
            <div class="message-content">
              <p>Olá! Sou seu assistente financeiro pessoal. Posso ajudar você a analisar seus gastos, calcular limites disponíveis e responder perguntas sobre suas finanças. Como posso ajudar hoje?</p>
            </div>
          </div>
        `;
      }
      break;
    case 'export-chat':
      // Export chat functionality
      alert('Funcionalidade de exportação em desenvolvimento.');
      break;
    case 'ai-settings':
      // Open AI settings
      switchView('settings');
      break;
  }
  
  // Close popover
  if (els.settingsPopover) {
    els.settingsPopover.style.display = 'none';
  }
}

function startNewConversation() {
  // Clear chat messages and start fresh
  if (els.chatMessages) {
    els.chatMessages.innerHTML = `
      <div class="ai-message">
        <div class="message-content">
          <p>Olá! Sou seu assistente financeiro pessoal. Posso ajudar você a analisar seus gastos, calcular limites disponíveis e responder perguntas sobre suas finanças. Como posso ajudar hoje?</p>
        </div>
      </div>
    `;
  }
  
  // Clear input
  if (els.aiInput) {
    els.aiInput.value = '';
  }
  
  // Clear file preview
  removeFilePreview();
  
  // Scroll to top
  if (els.chatMessages) {
    els.chatMessages.scrollTop = 0;
  }
}

function toggleConversationSidebar() {
  if (!els.conversationSidebar) return;
  
  const isVisible = els.conversationSidebar.style.display === 'block';
  els.conversationSidebar.style.display = isVisible ? 'none' : 'block';
  
  // Load conversation list when opening
  if (!isVisible) {
    loadConversationList();
  }
}

function loadConversationList() {
  if (!els.conversationList) return;
  
  // Get conversation history from localStorage
  const conversations = JSON.parse(localStorage.getItem('aiConversations') || '[]');
  
  if (conversations.length === 0) {
    els.conversationList.innerHTML = '<p class="helper-text">Nenhuma conversa salva.</p>';
    return;
  }
  
  els.conversationList.innerHTML = conversations.map(conv => `
    <div class="conversation-item" data-id="${conv.id}">
      <div class="conversation-title">${conv.title || 'Nova conversa'}</div>
      <div class="conversation-date">${new Date(conv.createdAt).toLocaleDateString('pt-BR')}</div>
    </div>
  `).join('');
  
  // Add click listeners to conversation items
  els.conversationList.querySelectorAll('.conversation-item').forEach(item => {
    item.addEventListener('click', () => loadConversation(item.dataset.id));
  });
}

function loadConversation(conversationId) {
  const conversations = JSON.parse(localStorage.getItem('aiConversations') || '[]');
  const conversation = conversations.find(c => c.id === conversationId);
  
  if (conversation && els.chatMessages) {
    // Restore messages
    els.chatMessages.innerHTML = conversation.messages.map(msg => `
      <div class="${msg.role === 'user' ? 'user-message' : 'ai-message'}">
        <div class="message-content">
          ${msg.isMarkdown ? marked.parse(msg.content) : msg.content}
        </div>
      </div>
    `).join('');
    
    // Close sidebar
    if (els.conversationSidebar) {
      els.conversationSidebar.style.display = 'none';
    }
    
    // Scroll to bottom
    scrollToBottom();
  }
}

function openMobileDrawer() {
  if (!els.mobileDrawer) {
    return;
  }
  els.mobileDrawer.style.display = 'flex';
  setTimeout(() => {
    els.mobileDrawer.classList.add('is-open');
  }, 10);
  document.body.style.overflow = 'hidden';
  console.log('Drawer aberto');
}

function closeMobileDrawer() {
  if (!els.mobileDrawer) return;
  els.mobileDrawer.classList.remove('is-open');
  setTimeout(() => {
    els.mobileDrawer.style.display = 'none';
  }, 300);
  document.body.style.overflow = '';
}

function handleResize() {
  if (!els.mobileMenuButton || !els.sidebar) return;
  
  const isMobile = window.innerWidth <= 768;
  
  if (isMobile) {
    els.mobileMenuButton.style.display = 'flex';
    els.sidebar.classList.add('collapsed');
  } else {
    els.mobileMenuButton.style.display = 'none';
    els.sidebar.classList.remove('collapsed');
  }
}

function toggleMoreOptionsPopover() {
  if (!els.moreOptionsPopover) return;
  
  const isVisible = els.moreOptionsPopover.style.display === 'flex';
  els.moreOptionsPopover.style.display = isVisible ? 'none' : 'flex';
  
  if (!isVisible) {
    lucide.createIcons();
  }
}

function handleMoreOptionsAction(e) {
  const action = e.currentTarget.dataset.action;
  
  switch (action) {
    case 'settings':
      switchView('settings');
      break;
    case 'profile':
      alert('Funcionalidade de perfil em desenvolvimento.');
      break;
    case 'help':
      alert('Funcionalidade de ajuda em desenvolvimento.');
      break;
    case 'logout':
      if (confirm('Deseja realmente sair?')) {
        window.location.reload();
      }
      break;
  }
  
  // Close popover
  if (els.moreOptionsPopover) {
    els.moreOptionsPopover.style.display = 'none';
  }
}

function showReceiptPreview(arquivo) {
  const leitor = new FileReader();
  leitor.onload = () => {
    const isPdf = arquivo.type === 'application/pdf';
    
    // Create preview modal
    const previewModal = document.createElement('div');
    previewModal.className = 'receipt-preview-modal';
    previewModal.innerHTML = `
      <div class="receipt-preview-content">
        <div class="preview-header">
          <h3>Pré-visualização do Comprovante</h3>
          <button class="close-button" id="closePreview"><i data-lucide="x"></i></button>
        </div>
        <div class="preview-image-container">
          ${isPdf 
            ? `<div class="pdf-preview">
                <i data-lucide="file-text" class="pdf-icon"></i>
                <p>Arquivo PDF selecionado</p>
              </div>`
            : `<img src="${leitor.result}" alt="Comprovante" class="preview-image" />`
          }
        </div>
        <div class="preview-actions">
          <button class="button-secondary" id="cancelPreview">Cancelar</button>
          <button class="button-primary" id="processReceipt">
            <i data-lucide="scan-line"></i>
            Processar com IA
          </button>
        </div>
        <div class="preview-info">
          <small>Arquivo: ${arquivo.name}</small>
          <small>Tipo: ${isPdf ? 'PDF' : 'Imagem'}</small>
          <small>Tamanho: ${(arquivo.size / 1024).toFixed(1)} KB</small>
        </div>
      </div>
    `;
    
    document.body.appendChild(previewModal);
    lucide.createIcons();
    
    // Add event listeners
    document.getElementById('closePreview').addEventListener('click', closeReceiptPreview);
    document.getElementById('cancelPreview').addEventListener('click', closeReceiptPreview);
    document.getElementById('processReceipt').addEventListener('click', () => {
      closeReceiptPreview();
      processReceiptWithAI(arquivo, leitor.result);
    });
  };
  
  leitor.readAsDataURL(arquivo);
}

function closeReceiptPreview() {
  const modal = document.querySelector('.receipt-preview-modal');
  if (modal) {
    modal.style.opacity = '0';
    setTimeout(() => modal.remove(), 300);
  }
}

async function processReceiptWithAI(arquivo, imageData, autoSave = false) {
  // Show loading state
  showAiLoading(true);

  const base64Puro = imageData.split(',')[1];
  const mimeType = arquivo.type;

  try {
    // Call Supabase Edge Function (sem key no front)
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('ai-assistant', {
      body: {
        acao: 'processar-comprovante',
        imagemBase64: base64Puro,
        mimeType
      }
    });

    if (aiError) throw new Error(aiError.message || 'Erro ao processar comprovante com IA');

    const extractedData = aiResponse;

    // Save receipt to history
    saveReceiptToHistory(arquivo, imageData, extractedData);

    // Auto-fill the entry form with AI data
    if (extractedData) {
      if (autoSave) {
        await autoSaveEntry(extractedData);
        addMessageToChat(
          `✅ Registro salvo automaticamente: ${extractedData.estabelecimento || 'Desconhecido'} - R$ ${extractedData.valor || '0'}`,
          'ai',
          true
        );
      } else {
        switchView('entries');

        if (els.entryAmount && extractedData.valor) els.entryAmount.value = extractedData.valor;
        if (els.entryDescription && extractedData.estabelecimento) els.entryDescription.value = extractedData.estabelecimento;
        if (els.entryDate && extractedData.data) els.entryDate.value = extractedData.data;

        if (els.entryPayment && extractedData.metodo) {
          const paymentMapping = {
            'Cartão de Crédito': 'Cartao de credito',
            'PIX': 'Pix',
            'Dinheiro': 'Dinheiro',
            'Vale Alimentação': 'Vale alimentacao'
          };
          const mappedMethod = paymentMapping[extractedData.metodo] || extractedData.metodo;

          const options = Array.from(els.entryPayment.options);
          const matchingOption = options.find(opt =>
            opt.value.toLowerCase() === mappedMethod.toLowerCase() ||
            opt.value.toLowerCase().includes(mappedMethod.toLowerCase())
          );

          if (matchingOption) {
            els.entryPayment.value = matchingOption.value;
          }
        }

        if (els.entryCategory && extractedData.categoria) {
          const options = Array.from(els.entryCategory.options);
          const matchingOption = options.find(opt =>
            opt.value.toLowerCase() === extractedData.categoria.toLowerCase() ||
            opt.value.toLowerCase().includes(extractedData.categoria.toLowerCase())
          );

          if (matchingOption) {
            els.entryCategory.value = matchingOption.value;
          } else {
            els.entryCategory.value = extractedData.categoria;
          }
        }

        setTimeout(() => {
          if (els.entryForm) {
            els.entryForm.style.boxShadow = '0 0 20px rgba(0, 230, 118, 0.3)';
            els.entryForm.style.borderColor = '#00E676';

            setTimeout(() => {
              els.entryForm.style.boxShadow = '';
              els.entryForm.style.borderColor = '';
            }, 2000);
          }
        }, 100);
      }
    }

    // Processado pela Edge Function. Nada mais a fazer.
    return;


  } catch (err) {
    console.error('[Receipt Processing] Error:', err);
    alert("Não conseguimos ler este comprovante. Tente novamente ou insira manualmente.\n\nErro: " + err.message);
  } finally {
    showAiLoading(false);
    // Re-enable send button
    if (els.sendAiMessage) {
      els.sendAiMessage.disabled = false;
      els.sendAiMessage.innerHTML = '<svg><use href="#icon-send"></use></svg>';
    }
    // Reset file input
    if (els.uploadComprovante) els.uploadComprovante.value = '';
  }
}

function saveReceiptToHistory(arquivo, imageData, extractedData) {
  const history = JSON.parse(localStorage.getItem('receiptHistory') || '[]');
  
  const receipt = {
    id: Date.now(),
    fileName: arquivo.name,
    fileSize: arquivo.size,
    mimeType: arquivo.type,
    imageData: imageData,
    extractedData: extractedData,
    processedAt: new Date().toISOString(),
    usedInTransaction: false
  };
  
  history.unshift(receipt);
  
  // Keep only last 20 receipts
  if (history.length > 20) {
    history.pop();
  }
  
  localStorage.setItem('receiptHistory', JSON.stringify(history));
}

async function autoSaveEntry(extractedData) {
  try {
    // Create entry object from extracted data
    const entry = {
      id: Date.now(),
      amount: parseFloat(extractedData.valor) || 0,
      description: extractedData.estabelecimento || 'Despesa não identificada',
      date: extractedData.data || new Date().toISOString().split('T')[0],
      category: extractedData.categoria || 'Outros',
      payment: extractedData.metodo || 'Dinheiro',
      type: 'expense',
      created_at: new Date().toISOString()
    };

    // Get current entries
    const entries = JSON.parse(localStorage.getItem('entries') || '[]');
    entries.unshift(entry);
    localStorage.setItem('entries', JSON.stringify(entries));

    // Sync with Supabase if available
    if (window.supabase && currentUser) {
      const { error } = await window.supabase
        .from('finance_states')
        .insert([{
          user_id: currentUser.id,
          state: entries,
          updated_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('[AutoSave] Supabase sync error:', error);
      }
    }

    // Refresh UI
    renderEntries();
    updateDashboard();
    
    return true;
  } catch (error) {
    console.error('[AutoSave] Error:', error);
    return false;
  }
}

function showAiLoading(show) {
  // Show/hide loading indicator
  const loadingIndicator = document.querySelector('.ai-loading-indicator');
  
  if (show) {
    if (!loadingIndicator) {
      const indicator = document.createElement('div');
      indicator.className = 'ai-loading-indicator';
      indicator.innerHTML = `
        <div class="ai-loading-content">
          <i data-lucide="scan-line" class="ai-loading-icon"></i>
          <p>Analisando comprovante...</p>
          <small>A IA está processando a imagem</small>
        </div>
      `;
      document.body.appendChild(indicator);
      lucide.createIcons();
    }
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
  } else {
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
      setTimeout(() => loadingIndicator.remove(), 300);
    }
  }
}

function sendAiMessageHandler() {
  const message = els.aiInput.value.trim();
  const hasFile = window.pendingFile;
  
  if (!message && !hasFile) return;
  
  // Removido rate limiting artificial para permitir mensagens consecutivas
  // O sistema agora processa mensagens de forma assíncrona sem bloqueio
  
  // Disable send button and show loading state
  if (els.sendAiMessage) {
    els.sendAiMessage.disabled = true;
    els.sendAiMessage.innerHTML = '<div class="spinner"></div>';
  }
  
  // Add message to chat
  if (message) {
    addMessageToChat(message, 'user');
    els.aiInput.value = '';
  }
  
  // Process file if attached
  if (hasFile) {
    const arquivo = window.pendingFile;
    const isPdf = arquivo.type === 'application/pdf';
    const fileMessage = isPdf 
      ? `📎 Arquivo PDF anexado: ${arquivo.name}`
      : `📎 Imagem anexada: ${arquivo.name}`;
    
    addMessageToChat(fileMessage, 'user');
    
    // Process with AI
    const leitor = new FileReader();
    leitor.onload = () => {
      processReceiptWithAI(arquivo, leitor.result, true);
    };
    leitor.readAsDataURL(arquivo);
    
    // Clear file preview
    removeFilePreview();
  }
  
  // Show skeleton loading
  showSkeletonLoading();
  scrollToBottom();
  
  // Call Supabase Edge Function (only if there's a text message)
  if (message) {
    callAiAssistant(message);
  }
}

function showSkeletonLoading() {
  const skeletonDiv = document.createElement('div');
  skeletonDiv.className = 'skeleton-message';
  skeletonDiv.id = 'aiSkeleton';
  
  const avatar = document.createElement('div');
  avatar.className = 'skeleton-avatar';
  
  const content = document.createElement('div');
  content.className = 'skeleton-content';
  
  const line1 = document.createElement('div');
  line1.className = 'skeleton-line long';
  
  const line2 = document.createElement('div');
  line2.className = 'skeleton-line medium';
  
  const line3 = document.createElement('div');
  line3.className = 'skeleton-line short';
  
  content.appendChild(line1);
  content.appendChild(line2);
  content.appendChild(line3);
  
  skeletonDiv.appendChild(avatar);
  skeletonDiv.appendChild(content);
  
  els.chatMessages.appendChild(skeletonDiv);
}

function hideSkeletonLoading() {
  const skeleton = document.getElementById('aiSkeleton');
  if (skeleton) {
    skeleton.remove();
  }
}

async function callAiAssistant(message, retryCount = 0, maxRetries = 3) {
  try {
    console.log('[AI] Starting AI assistant call');
    console.log('[AI] Message:', message);
    
    // Call AI assistant Edge Function (sem key no front)
    const { data: aiResponse, error: aiError } = await supabase.functions.invoke('ai-assistant', {
      body: {
        acao: 'chat',
        message,
      },
    });

    if (aiError) {
      throw new Error(aiError.message || 'Erro ao chamar assistente IA');
    }

    const aiText = aiResponse?.response || aiResponse?.aiResponse || aiResponse?.text || '';

    hideSkeletonLoading();

    // Re-enable send button
    if (els.sendAiMessage) {
      els.sendAiMessage.disabled = false;
      els.sendAiMessage.innerHTML = '<svg><use href="#icon-send"></use></svg>';
    }

    // Render markdown
    const renderedMarkdown = marked.parse(aiText || 'Desculpe, não consegui processar sua mensagem.');
    addMessageToChat(renderedMarkdown, 'ai', true);
    scrollToBottom();
  } catch (error) {
    console.log('[AI] Error occurred:', error.message);
    console.log('[AI] Error stack:', error.stack);
    
    hideSkeletonLoading();
    
    // Re-enable send button on error
    if (els.sendAiMessage) {
      els.sendAiMessage.disabled = false;
      els.sendAiMessage.innerHTML = '<svg><use href="#icon-send"></use></svg>';
    }
    
    const errorMessage = error.message || 'Desculpe, houve um erro ao processar sua mensagem.';
    addMessageToChat(`**Erro:** ${errorMessage}\n\nPor favor, tente novamente em instantes. Se o problema persistir, verifique sua conexão ou entre em contato com o suporte.`, 'ai', true);
    scrollToBottom();
    
    // Reset cooldown on error to allow retry
    aiCooldown = false;
    if (aiCooldownTimer) clearTimeout(aiCooldownTimer);

    if (retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return callAiAssistant(message, retryCount + 1, maxRetries);
    }
  }
}


function addMessageToChat(message, type, isMarkdown = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = type === 'user' ? 'user-message' : 'ai-message';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  
  if (isMarkdown && type === 'ai') {
    contentDiv.innerHTML = message;
  } else {
    const paragraph = document.createElement('p');
    paragraph.textContent = message;
    contentDiv.appendChild(paragraph);
  }
  
  messageDiv.appendChild(contentDiv);
  
  els.chatMessages.appendChild(messageDiv);
}

function scrollToBottom() {
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function toggleInstallmentField() {
  const isInstallment = els.entryInstallment.checked;
  els.installmentCountRow.style.display = isInstallment ? 'grid' : 'none';
}

function addMonths(dateStr, months) {
  const date = new Date(dateStr + 'T00:00:00');
  date.setMonth(date.getMonth() + months);
  return date.toISOString().split('T')[0];
}

function handlePayCardBill() {
  const state = getState();
  const month = calcMonth(state.settings.selectedMonth);
  
  if (month.cardBill <= 0) {
    alert("Nao ha fatura para pagar este mes.");
    return;
  }
  
  if (!confirm(`Deseja pagar a fatura de ${money.format(month.cardBill)}?`)) {
    return;
  }
  
  // Create expense record for the card bill payment
  const expense = createExpense({
    date: new Date().toISOString().split('T')[0],
    category: "Cartao de Credito",
    description: "Pagamento de fatura",
    payment: "Dinheiro",
    amount: month.cardBill,
    paid: true,
  });
  
  state.expenses.push(expense);
  
  // Mark all card expenses as paid
  state.expenses.forEach(exp => {
    if (exp.payment === "Cartao de credito" && !exp.paid) {
      const expDate = new Date(exp.date);
      const expMonth = expDate.getMonth();
      const expYear = expDate.getFullYear();
      const selectedDate = new Date(state.settings.selectedMonth);
      
      if (expMonth === selectedDate.getMonth() && expYear === selectedDate.getFullYear()) {
        exp.paid = true;
      }
    }
  });
  
  setState(state);
  saveState();
  render();
  scheduleRemoteSave();
  
  alert("Fatura paga com sucesso!");
}

function switchView(view) {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((section) => section.classList.remove("is-visible"));
  document.querySelector(`#view-${view}`).classList.add("is-visible");
  els.title.textContent = ({ home: "Início", entries: "Lançar", dashboard: "Dashboard", card: "Cartão", benefit: "Vale", ai: "Assistente IA", settings: "Configurações" })[view];
  if (view === "dashboard") renderCharts();
  if (view === "settings") {
    populateSettingsForm();
    renderFamilyInfo();
  }
}

function setEntryType(type) {
  els.entryType.value = type;
  document.querySelectorAll("[data-entry-type]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.entryType === type);
  });

  const isIncome = type === "income";
  els.categoryLabel.firstChild.textContent = isIncome ? "Tipo" : "Categoria";
  els.paymentLabel.style.display = isIncome ? "none" : "grid";
  els.paidLabel.style.display = "flex";
  els.entryCategory.innerHTML = (isIncome ? incomeTypes : expenseCategories)
    .map((item) => `<option value="${item}">${item}</option>`)
    .join("");
  els.entryPayment.innerHTML = paymentMethods.map((item) => `<option value="${item}">${item}</option>`).join("");
  
  // Update checkbox label based on type
  const paidLabelSpan = els.paidLabel.querySelector('span');
  if (paidLabelSpan) {
    paidLabelSpan.textContent = isIncome ? "Recebido" : "Pago";
  }
}

function populateSettingsForm() {
  const state = getState();
  els.settingCardLimit.value = state.settings.cardLimit || 0;
  els.settingVaInitialBalance.value = state.settings.vaInitialBalance || 0;
  els.settingCardClosingDay.value = state.settings.cardClosingDay || 1;
  els.settingCardDueDay.value = state.settings.cardDueDay || 10;
}

function handleSettingsSubmit(event) {
  event.preventDefault();

  const cardLimit = Number(els.settingCardLimit.value);
  const vaInitialBalance = Number(els.settingVaInitialBalance.value);
  const cardClosingDay = Number(els.settingCardClosingDay.value);
  const cardDueDay = Number(els.settingCardDueDay.value);

  // Validation
  if (cardLimit < 0) {
    alert("Limite do cartao nao pode ser negativo.");
    return;
  }
  if (vaInitialBalance < 0) {
    alert("Saldo inicial VA nao pode ser negativo.");
    return;
  }
  if (cardClosingDay < 1 || cardClosingDay > 31) {
    alert("Dia de fechamento deve estar entre 1 e 31.");
    return;
  }
  if (cardDueDay < 1 || cardDueDay > 31) {
    alert("Dia de vencimento deve estar entre 1 e 31.");
    return;
  }

  const state = getState();
  state.settings.cardLimit = cardLimit;
  state.settings.vaInitialBalance = vaInitialBalance;
  state.settings.cardClosingDay = cardClosingDay;
  state.settings.cardDueDay = cardDueDay;
  setState(state);

  saveState();
  alert("Configuracoes salvas com sucesso.");
  render();
}

function handleCardSettingsSubmit(event) {
  event.preventDefault();
  
  const cardLimit = Number(els.cardLimitInput.value);
  const cardClosingDay = Number(els.cardClosingDayInput.value);
  const cardDueDay = Number(els.cardDueDayInput.value);

  // Validation
  if (cardLimit < 0) {
    alert("O limite do cartao nao pode ser negativo");
    return;
  }
  if (cardClosingDay < 1 || cardClosingDay > 31) {
    alert("O dia de fechamento deve estar entre 1 e 31");
    return;
  }
  if (cardDueDay < 1 || cardDueDay > 31) {
    alert("O dia de vencimento deve estar entre 1 e 31");
    return;
  }

  const state = getState();
  state.settings.cardLimit = cardLimit;
  state.settings.cardClosingDay = cardClosingDay;
  state.settings.cardDueDay = cardDueDay;
  setState(state);
  saveState();
  render();
  alert("Configuracoes do cartao salvas com sucesso!");
}

function handleSubmit(event) {
  event.preventDefault();
  const type = els.entryType.value;
  const amount = Number(els.entryAmount.value);
  const date = els.entryDate.value;
  const description = els.entryDescription.value.trim();
  const isInstallment = els.entryInstallment.checked;
  const installmentCount = isInstallment ? Number(els.entryInstallmentCount.value) : 1;

  // Validation
  if (!amount || amount <= 0) {
    alert("Valor deve ser maior que zero.");
    return;
  }
  if (!date) {
    alert("Data e obrigatoria.");
    return;
  }
  if (!description) {
    description = "Sem descricao";
  }
  if (isInstallment && installmentCount < 2) {
    alert("Numero de parcelas deve ser pelo menos 2.");
    return;
  }

  const state = getState();

  if (type === "income") {
    const installmentAmount = amount / installmentCount;
    for (let i = 0; i < installmentCount; i++) {
      const installmentDate = addMonths(date, i);
      const installmentDescription = isInstallment 
        ? `${description} (Parcela ${i + 1}/${installmentCount})`
        : description;
      
      const income = createIncome({
        date: installmentDate,
        type: els.entryCategory.value,
        description: installmentDescription,
        amount: installmentAmount,
      });
      state.incomes.push(income);
    }
  } else {
    const payment = els.entryPayment.value;
    const category = els.entryCategory.value;
    const installmentAmount = amount / installmentCount;

    for (let i = 0; i < installmentCount; i++) {
      const installmentDate = addMonths(date, i);
      const installmentDescription = isInstallment 
        ? `${description} (Parcela ${i + 1}/${installmentCount})`
        : description;

      // Card limit validation (only for first installment)
      if (i === 0 && payment === "Cartao de credito") {
        const limitCheck = checkCardLimit(installmentDate, amount);
        if (!limitCheck.valid) {
          showAuthMessage(`Limite insuficiente. Fatura seria ${money.format(limitCheck.futureBill)}, limite e ${money.format(limitCheck.cardLimit)}.`);
          return;
        }
      }

      const expense = createExpense({
        date: installmentDate,
        category,
        description: installmentDescription,
        payment,
        amount: installmentAmount,
        paid: els.entryPaid.checked && i === 0,
      });

      state.expenses.push(expense);
    }
  }

  setState(state);
  saveState();
  els.entryForm.reset();
  setDefaultDate();
  setEntryType(type);
  render();
}

async function resetData() {
  if (!confirm("Apagar TODOS os dados? Isso ira limpar receitas e despesas, mas manter configuracoes.")) return;

  // Keep settings, clear incomes and expenses
  const state = getState();
  const newState = {
    settings: { ...state.settings },
    incomes: [],
    expenses: [],
  };
  setState(newState);

  // Clear local storage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));

  // Clear remote data if logged in
  if (remoteReady && currentUser) {
    const { error } = await supabase.from("finance_states").upsert({
      user_id: currentUser.id,
      data: newState,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      // Production: Removed console.error for security
      return;
    }
  }

  populateMonths();
  setDefaultDate();
  render();
}

async function initSupabase() {
  if (!supabase) {
    return;
  }

  const { data } = await supabase.auth.getSession();
  
  if (!data.session) {
    // Redirect to login page if not authenticated
    window.location.href = "./login.html";
    return;
  }

  await handleSession(data.session);

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session) {
      // Redirect to login page on logout
      window.location.href = "./login.html";
      return;
    }
    await handleSession(session);
  });
}

async function handleSession(session) {
  currentUser = session?.user || null;
  remoteReady = Boolean(currentUser);

  if (!currentUser) {
    return;
  }

  await loadRemoteState();
}

async function logout() {
  if (!supabase) return;
  
  // Cleanup real-time subscription
  cleanupRealtimeSubscription();
  
  // Clear localStorage for security and privacy
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CACHE_KEY);
  localStorage.clear();
  
  await supabase.auth.signOut();
  currentUser = null;
  currentFamily = null;
  currentUserRole = null;
  remoteReady = false;
  
  // Redirect to login page
  window.location.href = "./login.html";
}

async function loadRemoteState() {
  if (!remoteReady) return;
  
  // Try to load from cache first (stale-while-revalidate)
  const cachedData = localStorage.getItem(CACHE_KEY);
  if (cachedData) {
    try {
      const cache = JSON.parse(cachedData);
      if (cache.state && cache.timestamp) {
        const cacheAge = Date.now() - cache.timestamp;
        // Use cache if it's less than 24 hours old
        if (cacheAge < 24 * 60 * 60 * 1000) {
          const normalizedState = normalizeState(cache.state);
          setState(normalizedState);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedState));
          populateMonths();
          setDefaultDate();
          render();
        }
      }
    } catch (e) {
      // Production: Removed console.error for security
    }
  }
  
  // Load user's family
  await loadUserFamily();
  
  if (!currentFamily) {
    // User has no family, show family creation UI
    showFamilyCreationUI();
    return;
  }
  
  try {
    const { data, error } = await supabase
      .from("finance_states")
      .select("data, updated_at")
      .eq("family_id", currentFamily.id)
      .maybeSingle();

    if (error) {
      // Production: Removed console.error for security
      // If sync fails but we have cache, continue with cache
      if (cachedData) return;
      return;
    }

    if (data?.data) {
      const normalizedState = normalizeState(data.data);
      setState(normalizedState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedState));
      
      // Update cache with fresh data
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        state: data.data,
        timestamp: Date.now()
      }));
      
      populateMonths();
      setDefaultDate();
      render();
      
      // Setup real-time subscription
      setupRealtimeSubscription();
      return;
    }

    await saveRemoteNow();
  } catch (e) {
    // Production: Removed console.error for security
    // If remote load fails but we have cache, continue with cache
    if (cachedData) return;
  }
}

async function loadUserFamily() {
  if (!currentUser) return;
  
  const { data, error } = await supabase
    .from("family_members")
    .select("family_id, role, families!inner(name)")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error('[Family] Error loading user family:', error);
    return;
  }

  if (data) {
    currentFamily = { id: data.family_id, name: data.families?.name };
    currentUserRole = data.role;
  }
}

function showFamilyCreationUI() {
  // Show family creation UI in settings
  els.familyInfo.innerHTML = `
    <p class="helper-text">Você ainda não faz parte de nenhuma família.</p>
    <p class="helper-text">Crie uma nova família para começar a compartilhar dados financeiros.</p>
  `;
  els.familyActions.style.display = 'block';
  els.createFamilyButton.style.display = 'block';
  els.inviteMemberButton.style.display = 'none';
  els.membersList.innerHTML = '';
}

async function createFamily(familyName) {
  if (!familyName || !familyName.trim()) {
    alert("Por favor, insira um nome para a família.");
    return;
  }

  try {
    // Create family
    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert({ name: familyName.trim(), created_by: currentUser.id })
      .select()
      .single();

    if (familyError) {
      // Production: Removed console.error for security
      throw familyError;
    }

    // Add user as admin to the family
    const { error: memberError } = await supabase
      .from('family_members')
      .insert({ family_id: family.id, user_id: currentUser.id, role: 'admin' });

    if (memberError) {
      // Production: Removed console.error for security
      throw memberError;
    }

    // Reload family info
    await loadUserFamily();
    renderFamilyInfo();
    alert("Família criada com sucesso!");
  } catch (error) {
    // Production: Removed console.error for security
    alert("Erro ao criar família: " + error.message);
  }
}

async function loadFamilyMembers() {
  if (!currentFamily) return;

  const { data, error } = await supabase
    .from('family_members')
    .select('role, user_id, profiles!inner(email, full_name)')
    .eq('family_id', currentFamily.id);

  if (error) {
    console.error('[Family] Error loading family members:', error);
    return;
  }

  renderFamilyMembers(data || []);
}

function renderFamilyMembers(members) {
  if (!members || members.length === 0) {
    els.membersList.innerHTML = '<p class="helper-text">Nenhum membro encontrado.</p>';
    return;
  }

  els.membersList.innerHTML = members.map(member => `
    <div class="family-member-item">
      <div class="member-info">
        <strong>${member.profiles?.full_name || member.profiles?.email || 'Usuário'}</strong>
        <small>${member.profiles?.email || ''}</small>
      </div>
      <div class="member-role">
        <span class="role-badge ${member.role}">${member.role === 'admin' ? 'Administrador' : 'Membro'}</span>
        ${currentUserRole === 'admin' && member.role !== 'admin' ? 
          `<button class="danger-button small" onclick="removeFamilyMember('${member.user_id}')">Remover</button>` : ''}
      </div>
    </div>
  `).join('');
}

async function removeFamilyMember(userId) {
  if (!confirm('Tem certeza que deseja remover este membro da família?')) return;

  try {
    const { error } = await supabase
      .from('family_members')
      .delete()
      .eq('family_id', currentFamily.id)
      .eq('user_id', userId);

    if (error) throw error;

    await loadFamilyMembers();
    alert("Membro removido com sucesso!");
  } catch (error) {
    // Production: Removed console.error for security
    alert("Erro ao remover membro: " + error.message);
  }
}

function renderFamilyInfo() {
  if (!currentFamily) {
    showFamilyCreationUI();
    return;
  }

  els.familyInfo.innerHTML = `
    <div class="family-details">
      <strong>Família: ${currentFamily.name}</strong>
      <small>Seu papel: ${currentUserRole === 'admin' ? 'Administrador' : 'Membro'}</small>
    </div>
  `;

  els.familyActions.style.display = 'block';
  els.createFamilyButton.style.display = 'none';
  
  if (currentUserRole === 'admin') {
    els.inviteMemberButton.style.display = 'block';
  } else {
    els.inviteMemberButton.style.display = 'none';
  }

  loadFamilyMembers();
  
  // Ensure members list is visible
  els.membersList.innerHTML = '<p class="helper-text">Carregando membros...</p>';
}

async function inviteMember(email) {
  if (!email || !email.trim()) {
    alert("Por favor, insira o e-mail do membro.");
    return;
  }

  try {
    // Check if user exists
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) throw userError;

    const targetUser = users.find(u => u.email === email.trim());

    if (!targetUser) {
      alert("Usuário não encontrado. Verifique se o e-mail está correto.");
      return;
    }

    // Check if already in family
    const { data: existingMember } = await supabase
      .from('family_members')
      .select()
      .eq('family_id', currentFamily.id)
      .eq('user_id', targetUser.id)
      .maybeSingle();

    if (existingMember) {
      alert("Este usuário já faz parte da família.");
      return;
    }

    // Add to family
    const { error } = await supabase
      .from('family_members')
      .insert({ family_id: currentFamily.id, user_id: targetUser.id, role: 'member' });

    if (error) throw error;

    await loadFamilyMembers();
    alert("Membro adicionado com sucesso!");
  } catch (error) {
    // Production: Removed console.error for security
    alert("Erro ao convidar membro: " + error.message);
  }
}

function checkDeletePermission() {
  return currentUserRole === 'admin';
}

function setupRealtimeSubscription() {
  if (!remoteReady || realtimeSubscription || !currentFamily) return;
  
  realtimeSubscription = supabase
    .channel('finance_states_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'finance_states',
        filter: `family_id=eq.${currentFamily.id}`
      },
      (payload) => {
        if (payload.new?.data) {
          const normalizedState = normalizeState(payload.new.data);
          setState(normalizedState);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedState));
          // Update cache with fresh data
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            state: payload.new.data,
            timestamp: Date.now()
          }));
          render();
        }
      }
    )
    .subscribe((status) => {
      // Production: Removed console.error for security
    });
    
  setupFamilyMembersRealtime();
}

function setupFamilyMembersRealtime() {
  if (!remoteReady || familyMembersSubscription || !currentFamily) return;
  
  familyMembersSubscription = supabase
    .channel('family_members_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'family_members',
        filter: `family_id=eq.${currentFamily.id}`
      },
      (payload) => {
        loadFamilyMembers();
      }
    )
    .subscribe((status) => {
      // Production: Removed console.error for security
    });
}

function cleanupRealtimeSubscription() {
  if (realtimeSubscription) {
    supabase.removeChannel(realtimeSubscription);
    realtimeSubscription = null;
  }
  if (familyMembersSubscription) {
    supabase.removeChannel(familyMembersSubscription);
    familyMembersSubscription = null;
  }
}

function scheduleRemoteSave() {
  if (!remoteReady) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => saveRemoteNow(), 700);
}

async function saveRemoteNow() {
  if (!remoteReady || !currentFamily) return;
  const state = getState();
  const { error } = await supabase.from("finance_states").upsert({
    family_id: currentFamily.id,
    data: state,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    // Production: Removed console.error for security
    return;
  }
  
  // Re-setup real-time subscription after save
  if (!realtimeSubscription) {
    setupRealtimeSubscription();
  }
}

function render() {
  renderSummary();
  renderRecent();
  renderEntriesTable();
  renderMonthlyList();
  renderCardLedger();
  renderBenefit();
  renderCharts();
}

function renderSummary() {
  const state = getState();
  const month = calcMonth(state.settings.selectedMonth);
  const vaBalance = vaBalanceUntil(state.settings.selectedMonth);
  const cardLimit = state.settings.cardLimit || 0;
  const availableLimit = cardLimit > 0 ? cardLimit - month.cardBill : null;
  const hideBalance = state.settings.hideBalance;
  
  const formatValue = (value) => hideBalance ? "••••" : money.format(value);
  
  // Calculate consolidated net worth (Patrimônio Líquido)
  const netWorth = month.cashBalance + vaBalance + (availableLimit !== null ? availableLimit : 0);
  
  // Main card - Net Worth (consolidated balance)
  const mainCard = `
    <article class="metric metric-main ${netWorth < 0 ? "bad" : "good"}">
      <div class="metric-header">
        <span>Patrimônio Líquido</span>
        <button class="icon-button small" id="balanceToggleInline" title="Ocultar/Exibir saldo">
          <i data-lucide="${hideBalance ? "eye-off" : "eye"}"></i>
        </button>
      </div>
      <strong class="metric-value-large">${formatValue(netWorth)}</strong>
      <small class="metric-detail">Dinheiro ${formatValue(month.cashBalance)} + Vale ${formatValue(vaBalance)} ${availableLimit !== null ? `+ Disponível ${formatValue(availableLimit)}` : ""}</small>
    </article>
  `;
  
  // Secondary cards - origins breakdown
  const secondaryCards = [
    ["Receita mês", month.incomeCash, "good"],
    ["Despesas caixa", month.cashExpenses, "bad"],
    ["Fatura atual", month.cardBill, "bad"],
    ["Limite disponível", availableLimit !== null ? availableLimit : 0, "good"],
    ["Saldo vale", vaBalance, vaBalance < 0 ? "bad" : "warn"],
  ];
  
  const secondaryCardsHTML = secondaryCards
    .map(([label, value, tone]) => `<article class="metric metric-secondary ${tone}"><span>${label}</span><strong>${formatValue(value)}</strong></article>`)
    .join("");
  
  els.summaryGrid.innerHTML = mainCard + secondaryCardsHTML;
  
  // Re-attach event listener for inline balance toggle
  const inlineToggle = document.getElementById("balanceToggleInline");
  if (inlineToggle) {
    inlineToggle.addEventListener("click", toggleBalance);
  }
  
  lucide.createIcons();
  updateBalanceButtonIcon();
}

function allEntries() {
  const state = getState();
  const incomes = state.incomes.map((item) => ({ ...item, kind: "Receita", category: item.type, payment: "-", impact: monthKeyFromDate(item.date) }));
  const expenses = state.expenses.map((item) => ({ ...item, kind: "Despesa", impact: expenseImpactKey(item) }));
  return [...incomes, ...expenses].sort((a, b) => b.date.localeCompare(a.date));
}

function renderRecent() {
  const items = allEntries().slice(0, 6);
  els.recentList.innerHTML = items.length
    ? items.map((item) => `
      <div class="activity-item">
        <div><strong>${escapeHtml(item.description)}</strong><small>${formatDate(item.date)} - ${item.category}</small></div>
        <span class="amount ${item.kind === "Receita" ? "income" : "expense"}">${money.format(item.amount)}</span>
      </div>`).join("")
    : `<div class="empty">Sem lancamentos</div>`;
}

function renderEntriesTable() {
  els.entriesTable.innerHTML = allEntries().map((item) => `
    <tr>
      <td>${formatDate(item.date)}</td>
      <td><span class="badge ${item.kind === "Receita" ? "green" : "red"}">${item.kind}</span></td>
      <td>${item.category}</td>
      <td>${item.payment || "-"}</td>
      <td>${money.format(item.amount)}</td>
      <td>${formatImpact(item.impact)}</td>
    </tr>
  `).join("");
}

function renderMonthlyList() {
  // Filter months that have actual data (income, expenses, or VA activity)
  const monthsWithData = monthNames.map((name, index) => {
    const data = calcMonth(index + 1);
    const balance = vaBalanceUntil(index + 1);
    const hasData = data.incomeCash > 0 || data.cashExpenses > 0 || balance !== 0;
    
    return { name, index, data, balance, hasData };
  }).filter(month => month.hasData);

  // If no months with data, show empty state
  if (monthsWithData.length === 0) {
    els.monthlyList.innerHTML = `
      <div class="empty-state">
        <i data-lucide="wallet" class="empty-icon"></i>
        <p>Nenhuma despesa registrada</p>
        <small>Comece lançando suas despesas para ver o histórico</small>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  // Render only months with data
  els.monthlyList.innerHTML = monthsWithData.map(({ name, index, data, balance }) => {
    return `
      <div class="month-row">
        <div><strong>${name}</strong><small>Receita ${money.format(data.incomeCash)} - despesas ${money.format(data.cashExpenses)}</small></div>
        <span class="amount ${data.cashBalance < 0 ? "negative" : "neutral"}">${money.format(data.cashBalance)}</span>
        <span class="badge ${balance < 0 ? "red" : "green"}">VA ${money.format(balance)}</span>
      </div>`;
  }).join("");
}

function renderCardLedger() {
  const state = getState();
  
  // Filter months that have card transactions
  const monthsWithData = monthNames.map((name, index) => {
    const data = calcMonth(index + 1);
    const purchases = cardCount(data.key);
    const available = state.settings.cardLimit ? state.settings.cardLimit - data.cardBill : null;
    const hasData = purchases > 0 || data.cardBill > 0;
    
    return { name, index, data, purchases, available, hasData };
  }).filter(month => month.hasData);

  // If no months with card data, show empty state
  if (monthsWithData.length === 0) {
    els.cardLedger.innerHTML = `
      <div class="empty-state">
        <i data-lucide="credit-card" class="empty-icon"></i>
        <p>Nenhuma compra no cartão</p>
        <small>Seus gastos no cartão aparecerão aqui</small>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  // Render only months with card data
  els.cardLedger.innerHTML = monthsWithData.map(({ name, index, data, purchases, available }) => {
    return `
      <div class="ledger-row">
        <div><strong>${name}</strong><small>${purchases} compra${purchases !== 1 ? 's' : ''} lançada${purchases !== 1 ? 's' : ''}</small></div>
        <span class="amount neutral">${money.format(data.cardBill)}</span>
        <span class="badge ${available !== null && available < 0 ? "red" : "green"}">${available === null ? "Sem limite" : money.format(available)}</span>
      </div>`;
  }).join("");
}

function renderBenefit() {
  // Filter months that have VA activity (received or used)
  const monthsWithData = monthNames.map((name, index) => {
    const data = calcMonth(index + 1);
    const balance = vaBalanceUntil(index + 1);
    const hasData = data.vaIncome > 0 || data.vaUse > 0 || balance !== 0;
    
    return { name, index, data, balance, hasData };
  }).filter(month => month.hasData);

  // If no months with VA data, show empty state
  if (monthsWithData.length === 0) {
    els.benefitGrid.innerHTML = `
      <div class="empty-state">
        <i data-lucide="ticket" class="empty-icon"></i>
        <p>Nenhum vale alimentação</p>
        <small>Seus vales alimentação aparecerão aqui</small>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  // Render only months with VA data
  els.benefitGrid.innerHTML = monthsWithData.map(({ name, index, data, balance }) => {
    return `
      <div class="benefit-row">
        <div><strong>${name}</strong><small>Recebido ${money.format(data.vaIncome)} - usado ${money.format(data.vaUse)}</small></div>
        <span class="amount ${balance < 0 ? "negative" : "neutral"}">${money.format(balance)}</span>
      </div>`;
  }).join("");
}

function renderCharts() {
  const hasData = getState().incomes.length > 0 || getState().expenses.length > 0;
  
  if (!hasData) {
    renderEmptyChart(els.barChart);
    renderEmptyChart(els.donutChart);
    return;
  }
  
  try {
    drawBarChart(els.barChart, monthNames.map((_, index) => calcMonth(index + 1)));
    drawDonutChart(els.donutChart, categoryTotals());
  } catch (error) {
    // Production: Removed console.error for security
    renderEmptyChart(els.barChart);
    renderEmptyChart(els.donutChart);
  }
}

function renderEmptyChart(canvas) {
  const ctx = setupCanvas(canvas);
  const width = ctx.logicalWidth;
  const height = ctx.logicalHeight;
  ctx.clearRect(0, 0, width, height);
  
  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.font = "14px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Nenhum dado encontrado", width / 2, height / 2 - 10);
  
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.font = "12px Inter, sans-serif";
  ctx.fillText("Adicione lançamentos para visualizar o gráfico", width / 2, height / 2 + 15);
}

function drawBarChart(canvas, rows) {
  const ctx = setupCanvas(canvas);
  const width = ctx.logicalWidth;
  const height = ctx.logicalHeight;
  const pad = 36;
  ctx.clearRect(0, 0, width, height);
  const max = Math.max(100, ...rows.flatMap((row) => [row.incomeCash, row.paidExpenses]));
  const barWidth = (width - pad * 2) / rows.length / 3;
  ctx.strokeStyle = "#d9e1ea";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, height - pad);
  ctx.lineTo(width - pad, height - pad);
  ctx.stroke();
  rows.forEach((row, index) => {
    const x = pad + index * ((width - pad * 2) / rows.length) + barWidth;
    const incomeHeight = (row.incomeCash / max) * (height - pad * 2);
    const expenseHeight = (row.paidExpenses / max) * (height - pad * 2);
    ctx.fillStyle = "#0f766e";
    ctx.fillRect(x, height - pad - incomeHeight, barWidth, incomeHeight);
    ctx.fillStyle = "#c2413a";
    ctx.fillRect(x + barWidth + 3, height - pad - expenseHeight, barWidth, expenseHeight);
  });
  drawLegend(ctx, [["Receita", "#0f766e"], ["Despesas", "#c2413a"]], pad, 18);
}

function drawDonutChart(canvas, totals) {
  const ctx = setupCanvas(canvas);
  const width = ctx.logicalWidth;
  const height = ctx.logicalHeight;
  ctx.clearRect(0, 0, width, height);
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
  const colors = ["#0f766e", "#c77b12", "#2563eb", "#c2413a", "#617184"];
  let angle = -Math.PI / 2;
  const radius = Math.min(width, height) * 0.3;
  const cx = width * 0.38;
  const cy = height * 0.5;
  entries.forEach(([_, value], index) => {
    const slice = (value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = colors[index];
    ctx.fill();
    angle += slice;
  });
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  drawLegend(ctx, entries.map(([label], index) => [label, colors[index]]), width * 0.68, 44);
}

function setupCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, rect.width);
  const height = Number(canvas.getAttribute("height"));
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.font = "12px Inter, sans-serif";
  ctx.logicalWidth = width;
  ctx.logicalHeight = height;
  return ctx;
}

function drawLegend(ctx, items, x, y) {
  items.forEach(([label, color], index) => {
    const top = y + index * 22;
    ctx.fillStyle = color;
    ctx.fillRect(x, top - 10, 10, 10);
    ctx.fillStyle = "#132238";
    ctx.fillText(label, x + 16, top);
  });
}


function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function exportData() {
  const state = getState();
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "controle-financeiro-dados.json";
  link.click();
  URL.revokeObjectURL(url);
}

window.addEventListener("resize", () => renderCharts());
