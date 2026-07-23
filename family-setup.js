// Use global Supabase client initialized in HTML
const supabase = window.supabase;

const els = {
  createFamilyForm: document.getElementById("createFamilyForm"),
  inviteForm: document.getElementById("inviteForm"),
  familyName: document.getElementById("familyName"),
  inviteCode: document.getElementById("inviteCode"),
  createFamilyButton: document.getElementById("createFamilyButton"),
  joinFamilyButton: document.getElementById("joinFamilyButton"),
  skipButton: document.getElementById("skipButton"),
  setupMessage: document.getElementById("setupMessage"),
  authTabs: document.querySelectorAll(".auth-tab"),
};

function showMessage(message, isError = false) {
  els.setupMessage.textContent = message;
  els.setupMessage.className = "auth-message " + (isError ? "error" : "success");
  setTimeout(() => {
    els.setupMessage.textContent = "";
    els.setupMessage.className = "auth-message";
  }, 5000);
}

function setLoading(button, isLoading) {
  if (isLoading) {
    button.disabled = true;
    const spinner = document.createElement("span");
    spinner.className = "loading-spinner";
    button.replaceChildren(spinner, document.createTextNode(" Processando..."));
  } else {
    button.disabled = false;
    button.textContent = button.id === "createFamilyButton" ? "Criar Família" : "Entrar na Família";
  }
}

function switchTab(tab) {
  els.authTabs.forEach((tabBtn) => {
    tabBtn.classList.toggle("is-active", tabBtn.dataset.tab === tab);
  });

  els.createFamilyForm.classList.add("is-hidden");
  els.inviteForm.classList.add("is-hidden");

  if (tab === "create") {
    els.createFamilyForm.classList.remove("is-hidden");
  } else if (tab === "invite") {
    els.inviteForm.classList.remove("is-hidden");
  }
}

async function handleCreateFamily(event) {
  event.preventDefault();
  
  const familyName = els.familyName.value.trim();

  if (!familyName) {
    showMessage("Preencha o nome da família", true);
    return;
  }

  setLoading(els.createFamilyButton, true);

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error("Não foi possível obter o usuário atual");
    }

    // Create family
    const { data: familyData, error: familyError } = await supabase
      .from("families")
      .insert({ name: familyName })
      .select()
      .single();

    if (familyError) {
      throw familyError;
    }

    // Add user as family admin
    const { error: memberError } = await supabase
      .from("family_members")
      .insert({ 
        family_id: familyData.id, 
        user_id: user.id, 
        role: 'admin' 
      });

    if (memberError) {
      throw memberError;
    }

    // Update user metadata with family_id
    await supabase.auth.updateUser({
      data: { family_id: familyData.id }
    });

    // Clear pending user data
    localStorage.removeItem('pending_user_email');
    localStorage.removeItem('pending_user_id');

    showMessage("Família criada com sucesso!");
    
    setTimeout(() => {
      window.location.href = "./index.html";
    }, 1500);

  } catch (error) {
    // Production: Removed console.error for security
    showMessage("Erro ao criar família: " + error.message, true);
  } finally {
    setLoading(els.createFamilyButton, false);
  }
}

async function handleJoinFamily(event) {
  event.preventDefault();
  
  const inviteCode = els.inviteCode.value.trim().toUpperCase();

  if (!inviteCode) {
    showMessage("Digite o código de convite", true);
    return;
  }

  setLoading(els.joinFamilyButton, true);

  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error("Não foi possível obter o usuário atual");
    }

    // Find family by invite code (assuming families table has invite_code column)
    const { data: familyData, error: familyError } = await supabase
      .from("families")
      .select("id, name")
      .eq("invite_code", inviteCode)
      .maybeSingle();

    if (familyError || !familyData) {
      throw new Error("Código de convite inválido");
    }

    // Add user as family member
    const { error: memberError } = await supabase
      .from("family_members")
      .insert({ 
        family_id: familyData.id, 
        user_id: user.id, 
        role: 'member' 
      });

    if (memberError) {
      // If user is already a member, just update metadata
      if (memberError.message.includes("duplicate")) {
        // Production: Removed console.log for security
      } else {
        throw memberError;
      }
    }

    // Update user metadata with family_id
    await supabase.auth.updateUser({
      data: { family_id: familyData.id }
    });

    // Clear pending user data
    localStorage.removeItem('pending_user_email');
    localStorage.removeItem('pending_user_id');

    showMessage(`Bem-vindo à família ${familyData.name}!`);
    
    setTimeout(() => {
      window.location.href = "./index.html";
    }, 1500);

  } catch (error) {
    // Production: Removed console.error for security
    showMessage("Erro ao entrar na família: " + error.message, true);
  } finally {
    setLoading(els.joinFamilyButton, false);
  }
}

function handleSkip() {
  // Clear pending user data
  localStorage.removeItem('pending_user_email');
  localStorage.removeItem('pending_user_id');
  
  // Redirect to main app
  window.location.href = "./index.html";
}

async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    // Redirect to login if not authenticated
    window.location.href = "./login.html";
    return;
  }

  // Check if user already has a family
  const { data: familyMember } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (familyMember && familyMember.family_id) {
    // User already has a family, redirect to app
    window.location.href = "./index.html";
  }
}

function wireEvents() {
  els.authTabs.forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  els.createFamilyForm.addEventListener("submit", handleCreateFamily);
  els.inviteForm.addEventListener("submit", handleJoinFamily);
  els.skipButton.addEventListener("click", handleSkip);
}

// Initialize
checkAuth();
lucide.createIcons();
wireEvents();
