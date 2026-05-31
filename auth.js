// Use global Supabase client initialized in HTML
const supabase = window.supabase;

const els = {
  loginForm: document.getElementById("loginForm"),
  signupForm: document.getElementById("signupForm"),
  resetForm: document.getElementById("resetForm"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  signupEmail: document.getElementById("signupEmail"),
  signupPassword: document.getElementById("signupPassword"),
  signupConfirmPassword: document.getElementById("signupConfirmPassword"),
  resetEmail: document.getElementById("resetEmail"),
  loginButton: document.getElementById("loginButton"),
  signupButton: document.getElementById("signupButton"),
  resetButton: document.getElementById("resetButton"),
  forgotPasswordButton: document.getElementById("forgotPasswordButton"),
  backToLoginButton: document.getElementById("backToLoginButton"),
  authMessage: document.getElementById("authMessage"),
  authTabs: document.querySelectorAll(".auth-tab"),
};

function showMessage(message, isError = false) {
  els.authMessage.textContent = message;
  els.authMessage.className = "auth-message " + (isError ? "error" : "success");
  setTimeout(() => {
    els.authMessage.textContent = "";
    els.authMessage.className = "auth-message";
  }, 5000);
}

function setLoading(button, isLoading) {
  if (isLoading) {
    button.disabled = true;
    button.innerHTML = '<span class="loading-spinner"></span> Processando...';
  } else {
    button.disabled = false;
    button.innerHTML = button.id === "loginButton" ? "Entrar" : "Criar conta";
  }
}

async function handleLogin(event) {
  event.preventDefault();
  
  const email = els.loginEmail.value.trim();
  const password = els.loginPassword.value;

  if (!email || !password) {
    showMessage("Preencha todos os campos", true);
    return;
  }

  setLoading(els.loginButton, true);

  try {
    console.log('[Auth] Starting login process for:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('[Auth] Login error:', error);
      throw error;
    }

    console.log('[Auth] Login successful, user ID:', data.user.id);

    // Check if user has a family (optional - don't block login if this fails)
    try {
      const { data: familyData, error: familyError } = await supabase
        .from("family_members")
        .select("family_id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (familyError) {
        console.error('[Auth] Family check error:', familyError);
        // Continue anyway - don't block login
      } else {
        console.log('[Auth] Family data:', familyData);

        // Store family_id in session metadata if it exists
        if (familyData && familyData.family_id) {
          await supabase.auth.updateUser({
            data: { family_id: familyData.family_id }
          });
          console.log('[Auth] Family ID stored in user metadata');
        }
      }
    } catch (familyCheckError) {
      console.error('[Auth] Family check failed:', familyCheckError);
      // Continue anyway - don't block login
    }

    showMessage("Login realizado com sucesso!");
    console.log('[Auth] Redirecting to app...');
    
    // Redirect to app after successful login
    setTimeout(() => {
      window.location.href = "./index.html";
    }, 1000);

  } catch (error) {
    console.error('[Auth] Login failed:', error);
    if (error.message.includes("Invalid login credentials")) {
      showMessage("E-mail ou senha incorretos", true);
    } else if (error.message.includes("Email not confirmed")) {
      showMessage("Por favor, confirme seu e-mail antes de fazer login", true);
    } else {
      showMessage("Erro ao fazer login: " + error.message, true);
    }
  } finally {
    setLoading(els.loginButton, false);
  }
}

async function handleSignup(event) {
  event.preventDefault();
  
  const email = els.signupEmail.value.trim();
  const password = els.signupPassword.value;
  const confirmPassword = els.signupConfirmPassword.value;

  if (!email || !password || !confirmPassword) {
    showMessage("Preencha todos os campos", true);
    return;
  }

  if (password !== confirmPassword) {
    showMessage("As senhas não coincidem", true);
    return;
  }

  if (password.length < 6) {
    showMessage("A senha deve ter no mínimo 6 caracteres", true);
    return;
  }

  setLoading(els.signupButton, true);

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    // If auto-confirm is enabled and user is created
    if (data.user && data.session) {
      // Store user email for family setup
      localStorage.setItem('pending_user_email', email);
      localStorage.setItem('pending_user_id', data.user.id);
      
      showMessage("Conta criada com sucesso! Configure sua família para continuar.", false);
      
      // Redirect to family setup page instead of main app
      setTimeout(() => {
        window.location.href = "./family-setup.html";
      }, 1500);
    } else if (data.user && !data.session) {
      showMessage("Conta criada! Verifique seu e-mail para confirmar e configurar sua família.", false);
    }

  } catch (error) {
    // Production: Removed console.error for security
    if (error.message.includes("User already registered")) {
      showMessage("Este e-mail já está cadastrado. Tente fazer login.", true);
    } else if (error.message.includes("rate limit")) {
      showMessage("Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.", true);
    } else {
      showMessage("Erro ao criar conta: " + error.message, true);
    }
  } finally {
    setLoading(els.signupButton, false);
  }
}

function switchTab(tab) {
  els.authTabs.forEach((tabBtn) => {
    tabBtn.classList.toggle("is-active", tabBtn.dataset.tab === tab);
  });

  els.loginForm.classList.add("is-hidden");
  els.signupForm.classList.add("is-hidden");
  els.resetForm.classList.add("is-hidden");

  if (tab === "login") {
    els.loginForm.classList.remove("is-hidden");
  } else if (tab === "signup") {
    els.signupForm.classList.remove("is-hidden");
  } else if (tab === "reset") {
    els.resetForm.classList.remove("is-hidden");
  }
}

async function handleReset(event) {
  event.preventDefault();
  
  const email = els.resetEmail.value.trim();

  if (!email) {
    showMessage("Preencha o campo de e-mail", true);
    return;
  }

  setLoading(els.resetButton, true);

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/login.html",
    });

    if (error) {
      throw error;
    }

    showMessage("Link de recuperação enviado para seu e-mail!", false);
    
    // Clear the form
    els.resetEmail.value = "";
    
    // Switch back to login after 3 seconds
    setTimeout(() => {
      switchTab("login");
    }, 3000);

  } catch (error) {
    // Production: Removed console.error for security
    if (error.message.includes("User not found")) {
      showMessage("E-mail não encontrado. Verifique ou crie uma conta.", true);
    } else {
      showMessage("Erro ao enviar link de recuperação: " + error.message, true);
    }
  } finally {
    setLoading(els.resetButton, false);
  }
}

function wireEvents() {
  els.authTabs.forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  els.loginForm.addEventListener("submit", handleLogin);
  els.signupForm.addEventListener("submit", handleSignup);
  els.resetForm.addEventListener("submit", handleReset);
  
  els.forgotPasswordButton.addEventListener("click", () => switchTab("reset"));
  els.backToLoginButton.addEventListener("click", () => switchTab("login"));
}

async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    // Already logged in, redirect to app
    window.location.href = "./index.html";
  }
}

// Initialize
checkAuth();
wireEvents();
