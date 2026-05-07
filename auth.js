import { supabase } from "./supabase.js";

// =========================
// STATE
// =========================
let failedAttempts = 0;
let lockoutUntil = null;
let currentMode = "login";

// =========================
// INIT
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  const { data } = await supabase.auth.getSession();

  if (data?.session?.user) {
    await handleExistingSession();
  }

  setupEventListeners();

  const savedEmail = localStorage.getItem("rememberedEmail");
  if (savedEmail) {
    const emailInput = document.getElementById("email");
    if (emailInput) emailInput.value = savedEmail;

    const rememberCheck = document.getElementById("rememberMe");
    if (rememberCheck) rememberCheck.checked = true;
  }

  checkLockoutStatus();
});

// =========================
// EVENT LISTENERS
// =========================
function setupEventListeners() {
  const form = document.getElementById("authForm");

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      if (currentMode === "login") handleLogin();
      else handleSignup();
    });
  }

  const toggleBtn = document.getElementById("togglePassword");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", togglePasswordVisibility);
  }

  const switchLink = document.getElementById("switchMode");
  if (switchLink) {
    switchLink.addEventListener("click", (e) => {
      e.preventDefault();
      toggleAuthMode();
    });
  }

  const forgotLink = document.getElementById("forgotPassword");
  if (forgotLink) {
    forgotLink.addEventListener("click", (e) => {
      e.preventDefault();
      showForgotPasswordModal();
    });
  }

  const submitBtn = document.getElementById("submitBtn");
  if (submitBtn) {
    submitBtn.addEventListener("click", () => {
      if (currentMode === "login") handleLogin();
      else handleSignup();
    });
  }
}

// =========================
// SESSION REDIRECT
// =========================
async function handleExistingSession() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarded")
    .eq("id", userData.user.id)
    .single();

  if (profile?.role === "teacher") {
    window.location.href = profile.onboarded
      ? "teacher-dashboard.html"
      : "teacher-onboarding.html";
  } else {
    window.location.href = "student-dashboard.html";
  }
}

// =========================
// TOGGLE LOGIN / SIGNUP
// =========================
function toggleAuthMode() {
  currentMode = currentMode === "login" ? "signup" : "login";

  const title = document.getElementById("authTitle");
  const submitBtn = document.getElementById("submitBtn");
  const switchText = document.getElementById("switchText");
  const switchLink = document.getElementById("switchMode");
  const forgotContainer = document.getElementById("forgotContainer");
  const signupFields = document.getElementById("signupFields");

  if (currentMode === "signup") {
    if (title) title.innerText = "Create Account";
    if (submitBtn) submitBtn.innerText = "Sign Up";
    if (switchText) switchText.innerText = "Already have an account?";
    if (switchLink) switchLink.innerText = "Login";
    if (forgotContainer) forgotContainer.style.display = "none";
    if (signupFields) signupFields.style.display = "block";
  } else {
    if (title) title.innerText = "Welcome Back";
    if (submitBtn) submitBtn.innerText = "Login";
    if (switchText) switchText.innerText = "Don't have an account?";
    if (switchLink) switchLink.innerText = "Sign Up";
    if (forgotContainer) forgotContainer.style.display = "block";
    if (signupFields) signupFields.style.display = "none";
  }
}

// =========================
// LOGIN
// =========================
window.handleLogin = async function () {
  if (lockoutUntil && Date.now() < lockoutUntil) {
    showError("Too many attempts. Try again later.");
    return;
  }

  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value;
  const rememberMe = document.getElementById("rememberMe")?.checked;

  if (!email || !password) {
    showError("Enter email and password");
    return;
  }

  setLoading(true);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    failedAttempts++;
    saveFailedAttempts();
    showError(error.message);
    setLoading(false);
    return;
  }

  failedAttempts = 0;
  saveFailedAttempts();

  if (rememberMe) {
    localStorage.setItem("rememberedEmail", email);
  } else {
    localStorage.removeItem("rememberedEmail");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, onboarded")
    .eq("id", data.user.id)
    .single();

  setLoading(false);

  if (profile?.role === "teacher") {
    window.location.href = profile.onboarded
      ? "teacher-dashboard.html"
      : "teacher-onboarding.html";
  } else {
    window.location.href = "student-dashboard.html";
  }
};

// =========================
// SIGNUP
// =========================
window.handleSignup = async function () {
  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value;
  const fullName = document.getElementById("fullName")?.value.trim();
  const role = document.getElementById("roleSelect")?.value;

  if (!email || !password || !fullName) {
    showError("Fill all required fields");
    return;
  }

  setLoading(true);

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

  if (error) {
    showError(error.message);
    setLoading(false);
    return;
  }

  await supabase.from("profiles").insert({
    id: data.user.id,
    full_name: fullName,
    email,
    role: role || "student",
    onboarded: false,
  });

  setLoading(false);

  showError("Check your email to verify account");
};

// =========================
// UI HELPERS
// =========================
function setLoading(state) {
  const btn = document.getElementById("submitBtn");
  if (!btn) return;

  btn.disabled = state;
  btn.innerText = state
    ? "Loading..."
    : currentMode === "login"
    ? "Login"
    : "Sign Up";
}

function showError(msg) {
  alert(msg);
}

// =========================
// LOCKOUT SYSTEM
// =========================
function saveFailedAttempts() {
  localStorage.setItem("failedAttempts", failedAttempts);
}
function checkLockoutStatus() {}
function togglePasswordVisibility() {}
function showForgotPasswordModal() {}
