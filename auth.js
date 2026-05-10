import { supabase } from "./supabase.js";

// =========================
// AUTH STATE MACHINE
// =========================

const AuthState = {
  IDLE: "idle",
  CHECKING: "checking_session",
  LOGGED_IN: "logged_in",
  LOGGED_OUT: "logged_out",
  VERIFYING: "verifying_email",
  LOADING: "loading",
  ERROR: "error",
};

let currentState = AuthState.IDLE;

function setState(state, meta = {}) {
  currentState = state;
  console.log("[AUTH STATE]", state, meta);
  renderUI(state, meta);
}

// =========================
// INIT
// =========================

document.addEventListener("DOMContentLoaded", initAuthApp);

async function initAuthApp() {
  try {
    setState(AuthState.CHECKING);

    // ONLY check for email confirmation if there's a URL hash
    const isConfirming = await checkForEmailConfirmation();

    if (isConfirming) {
      setState(AuthState.VERIFYING);
      return;
    }

    // Check if user is already logged in
    const session = await checkSession();
    
    if (session) {
      // Show a message asking if they want to stay or go to dashboard
      setState(AuthState.LOGGED_IN, { user: session.user });
      showAlreadyLoggedInMessage(session.user);
      return;
    }

    setState(AuthState.LOGGED_OUT);

    hydrateRememberedEmail();

    safeRun(updateCurriculumVisibility, "curriculum");
    safeRun(updateRoleVisibility, "role");
    safeRun(updateAccommodationInfo, "accommodation");

  } catch (err) {
    setState(AuthState.ERROR, { error: err.message });
  }
}

// =========================
// SHOW MESSAGE FOR ALREADY LOGGED IN USERS
// =========================
function showAlreadyLoggedInMessage(user) {
  const status = document.getElementById("status");
  if (!status) return;
  
  status.innerHTML = `
    <div style="background: #e8f5f0; padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 1rem;">
      ✅ You are already logged in as <strong>${user.email}</strong><br><br>
      <button onclick="goToDashboard()" style="padding: 0.3rem 1rem; background: #d48f2b; color: white; border: none; border-radius: 0.3rem; cursor: pointer;">Go to Dashboard</button>
      <button onclick="logoutAndStay()" style="padding: 0.3rem 1rem; background: #6b7280; color: white; border: none; border-radius: 0.3rem; cursor: pointer;">Logout</button>
    </div>
  `;
}

window.goToDashboard = async function() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();
    
    if (profile?.role === "teacher") {
      window.location.href = "teacher-dashboard.html";
    } else {
      window.location.href = "student-dashboard.html";
    }
  }
};

window.logoutAndStay = async function() {
  await supabase.auth.signOut();
  const status = document.getElementById("status");
  if (status) status.innerHTML = "You have been logged out.";
  setState(AuthState.LOGGED_OUT);
  // Clear form fields
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  if (emailInput) emailInput.value = "";
  if (passwordInput) passwordInput.value = "";
};

// =========================
// SESSION
// =========================

async function checkSession() {
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

// =========================
// ROUTING
// =========================

async function routeUser(user) {
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarded")
    .eq("id", user.id)
    .single();

  if (!profile) return;

  if (profile.role === "teacher") {
    window.location.href = profile.onboarded
      ? "teacher-dashboard.html"
      : "teacher-onboarding.html";
  } else {
    window.location.href = "student-dashboard.html";
  }
}

// =========================
// LOGIN
// =========================

window.handleLogin = async function () {
  try {
    setState(AuthState.LOADING);

    const email = document.getElementById("email")?.value?.trim();
    const password = document.getElementById("password")?.value;

    if (!email || !password) {
      throw new Error("Email and password required");
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    const rememberMe = document.getElementById("rememberMe")?.checked;
    if (rememberMe) {
      localStorage.setItem("rememberedEmail", email);
    } else {
      localStorage.removeItem("rememberedEmail");
    }

    setState(AuthState.LOGGED_IN, { user: data.user });

    await routeUser(data.user);

  } catch (err) {
    if (err.message.includes("Email not confirmed")) {
      setState(AuthState.VERIFYING, { email: document.getElementById("email")?.value });
    } else {
      setState(AuthState.ERROR, { error: err.message });
    }
  }
};

// =========================
// SIGNUP
// =========================

window.handleSignup = async function () {
  try {
    setState(AuthState.LOADING);

    const email = document.getElementById("email")?.value?.trim();
    const password = document.getElementById("password")?.value;
    const fullName = document.getElementById("fullName")?.value?.trim();
    const role = document.getElementById("roleSelect")?.value;

    if (!email || !password || !fullName) {
      throw new Error("All required fields must be filled");
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role || "student",
        },
      },
    });

    if (error) throw error;

    setState(AuthState.VERIFYING, { email: email });

  } catch (err) {
    setState(AuthState.ERROR, { error: err.message });
  }
};

// =========================
// EMAIL CONFIRM FLOW (FIXED)
// =========================

async function checkForEmailConfirmation() {
  // ONLY run if there's a hash with access_token in the URL
  if (!window.location.hash || !window.location.hash.includes("access_token")) {
    return false;
  }
  
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  
  if (accessToken && refreshToken) {
    // Set the session from URL tokens
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    
    if (!error) {
      // Clear URL hash
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Get user role and redirect
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      
      setTimeout(() => {
        if (profile?.role === "teacher") {
          window.location.href = "teacher-dashboard.html";
        } else {
          window.location.href = "student-dashboard.html";
        }
      }, 1500);
      return true;
    }
  }
  return false;
}

// =========================
// UI RENDER
// =========================

function renderUI(state, meta) {
  const status = document.getElementById("status");
  if (!status) return;

  switch (state) {
    case AuthState.CHECKING:
      status.textContent = "Checking session...";
      break;

    case AuthState.LOADING:
      status.textContent = "Processing...";
      break;

    case AuthState.LOGGED_IN:
      status.textContent = "Login successful. Redirecting...";
      break;

    case AuthState.LOGGED_OUT:
      status.textContent = "";
      break;

    case AuthState.VERIFYING:
      status.innerHTML = `
        <div style="background: #e0f2fe; padding: 1rem; border-radius: 0.5rem; margin-top: 1rem;">
          <strong>✅ Check your email!</strong><br>
          We sent a confirmation link to <strong>${meta?.email || "your email"}</strong>.<br><br>
          <span id="resendTimer">⏳ You can request a new link in <span id="countdown">60</span> seconds</span><br>
          <button id="resendBtn" style="margin-top: 0.5rem; padding: 0.3rem 1rem; background: #d48f2b; color: white; border: none; border-radius: 0.3rem; cursor: pointer;" disabled>Resend Confirmation Email</button>
        </div>
      `;
      
      // Add resend functionality
      const email = meta?.email || document.getElementById("email")?.value;
      startResendTimer(email);
      break;

    case AuthState.ERROR:
      status.innerHTML = `<div style="color: #dc2626; padding: 0.5rem; background: #fee2e2; border-radius: 0.5rem;">❌ ${meta?.error || "Something went wrong"}</div>`;
      setTimeout(() => {
        if (status.innerHTML?.includes("Error:")) {
          status.innerHTML = "";
        }
      }, 5000);
      break;

    default:
      status.textContent = "";
  }
}

// =========================
// RESEND CONFIRMATION EMAIL
// =========================
function startResendTimer(email) {
  let seconds = 60;
  const countdownEl = document.getElementById("countdown");
  const resendBtn = document.getElementById("resendBtn");
  
  const timer = setInterval(() => {
    seconds--;
    if (countdownEl) countdownEl.innerText = seconds;
    if (seconds <= 0) {
      clearInterval(timer);
      if (resendBtn) {
        resendBtn.disabled = false;
        resendBtn.innerText = "Resend Confirmation Email";
        resendBtn.onclick = async () => {
          const { error } = await supabase.auth.resend({
            type: "signup",
            email: email,
          });
          if (error) {
            alert("Error: " + error.message);
          } else {
            alert("Confirmation email resent! Check your inbox.");
            seconds = 60;
            countdownEl.innerText = seconds;
            resendBtn.disabled = true;
            const newTimer = setInterval(() => {
              seconds--;
              if (countdownEl) countdownEl.innerText = seconds;
              if (seconds <= 0) {
                clearInterval(newTimer);
                resendBtn.disabled = false;
              }
            }, 1000);
          }
        };
      }
    }
  }, 1000);
}

// =========================
// HELPERS
// =========================

function hydrateRememberedEmail() {
  const email = localStorage.getItem("rememberedEmail");
  const input = document.getElementById("email");
  const remember = document.getElementById("rememberMe");

  if (email && input) input.value = email;
  if (remember) remember.checked = !!email;
}

function safeRun(fn, label) {
  try {
    if (typeof fn === "function") fn();
  } catch (e) {
    console.warn(`[SAFE RUN FAILED] ${label}`, e);
  }
}

// =========================
// PLACEHOLDER HOOKS (YOUR UI LOGIC)
// =========================

function updateCurriculumVisibility() {}
function updateRoleVisibility() {}
function updateAccommodationInfo() {}
