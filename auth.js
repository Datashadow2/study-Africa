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
  
  // Force UI to match currentMode on page load
  toggleAuthMode();

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
// SIGNUP (UPGRADED with Religion, Grade, Curriculum, Clubs)
// =========================
window.handleSignup = async function () {
  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value;
  const fullName = document.getElementById("fullName")?.value.trim();
  const role = document.getElementById("roleSelect")?.value;
  
  // New fields
  const religion = document.getElementById("religionSelect")?.value;
  const grade = document.getElementById("gradeSelect")?.value;
  const curriculum = document.getElementById("curriculumSelect")?.value;
  
  // Clubs (multiple selection)
  const clubCheckboxes = document.querySelectorAll('input[name="clubs"]:checked');
  const clubs = Array.from(clubCheckboxes).map(cb => cb.value);

  // Validation
  if (!email || !password || !fullName) {
    showError("Please fill in email, password, and full name");
    return;
  }

  if (currentMode === "signup" && !religion) {
    showError("Please select your religion");
    return;
  }

  if (currentMode === "signup" && role === "student" && !grade) {
    showError("Please select your grade");
    return;
  }

  if (currentMode === "signup" && role === "student" && !curriculum) {
    showError("Please select your curriculum");
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
        religion: religion || null,
        grade: grade || null,
        curriculum: curriculum || null,
        clubs: clubs || [],
      },
    },
  });

  if (error) {
    showError(error.message);
    setLoading(false);
    return;
  }

  setLoading(false);
  showError("Check your email to verify your account before logging in!");
};  // <-- THIS CLOSING BRACKET WAS MISSING!

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

function togglePasswordVisibility() {
  const passwordInput = document.getElementById("password");
  const toggleBtn = document.getElementById("togglePassword");
  if (passwordInput && toggleBtn) {
    const type = passwordInput.type === "password" ? "text" : "password";
    passwordInput.type = type;
    toggleBtn.textContent = type === "password" ? "👁️" : "🙈";
  }
}

function showForgotPasswordModal() {
  const email = document.getElementById("email")?.value.trim();
  if (!email) {
    showError("Enter your email address first");
    return;
  }
  
  // Simple password reset
  supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/reset-password.html",
  });
  
  showError("Password reset link sent to your email!");
}
