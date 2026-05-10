import { supabase } from "./supabase.js";

// =========================
// STATE
// =========================
let currentMode = "login";
let confirmationPollingInterval = null;

// =========================
// DOM ELEMENTS
// =========================
const loginModeBtn = document.getElementById("loginModeBtn");
const signupModeBtn = document.getElementById("signupModeBtn");
const loginFields = document.getElementById("loginFields");
const signupFields = document.getElementById("signupFields");
const submitBtn = document.getElementById("submitBtn");
const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");
const trialNote = document.getElementById("trialNote");
const messageDiv = document.getElementById("message");

// Login elements
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const rememberMe = document.getElementById("rememberMe");

// Signup elements
const signupEmail = document.getElementById("signupEmail");
const signupPassword = document.getElementById("signupPassword");
const fullNameInput = document.getElementById("fullName");
const religionSelect = document.getElementById("religion");
const roleSelect = document.getElementById("role");
const curriculumSelect = document.getElementById("curriculum");
const gradeSelect = document.getElementById("grade");
const disabilitySelect = document.getElementById("disability");
const termsCheckbox = document.getElementById("termsRequired");

// Teacher fields
const teacherFields = document.getElementById("teacherFields");
const tscNumberInput = document.getElementById("tscNumber");
const schoolNameInput = document.getElementById("schoolName");

// Curriculum boxes
const cbcBox = document.getElementById("cbcSubjects");
const eightFourFourBox = document.getElementById("eightFourFourSubjects");
const igcseBox = document.getElementById("igcseSubjects");
const ibBox = document.getElementById("ibSubjects");

// Accommodation info
const accommodationInfo = document.getElementById("accommodationInfo");

// =========================
// HELPER FUNCTIONS
// =========================
function showMessage(msg, isError = true, isHtml = false) {
  messageDiv.innerHTML = isHtml ? msg : msg;
  messageDiv.className = isError ? "error" : "success";
  setTimeout(() => {
    messageDiv.innerHTML = "";
    messageDiv.className = "note";
  }, 8000);
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading 
    ? (currentMode === "login" ? "Logging in..." : "Creating account...") 
    : (currentMode === "login" ? "🔐 Login" : "📝 Sign Up");
}

function getSelectedCheckboxValues(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

function getClubs() {
  return getSelectedCheckboxValues("clubs");
}

// =========================
// EMAIL CONFIRMATION HANDLER
// =========================
function checkEmailConfirmation(email) {
  // Show confirmation message with instructions
  const confirmHtml = `
    <div style="background: #e0f2fe; padding: 1rem; border-radius: 0.5rem; margin-top: 1rem;">
      <strong>✅ Account created! Please verify your email.</strong><br>
      We sent a confirmation link to <strong>${email}</strong>.<br><br>
      <span id="resendTimer">⏳ You can request a new link in <span id="countdown">60</span> seconds</span><br>
      <button id="resendBtn" style="margin-top: 0.5rem; padding: 0.3rem 1rem; background: #d48f2b; color: white; border: none; border-radius: 0.3rem; cursor: pointer;" disabled>Resend Confirmation Email</button>
    </div>
  `;
  
  showMessage(confirmHtml, false, true);
  
  // Start countdown for resend button
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
      }
    }
  }, 1000);
  
  // Resend button handler
  document.getElementById("resendBtn")?.addEventListener("click", async () => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email,
    });
    
    if (error) {
      showMessage("Error resending: " + error.message);
    } else {
      showMessage("✅ New confirmation email sent! Check your inbox.", false);
      // Reset countdown
      seconds = 60;
      if (resendBtn) resendBtn.disabled = true;
      if (countdownEl) countdownEl.innerText = seconds;
      const newTimer = setInterval(() => {
        seconds--;
        if (countdownEl) countdownEl.innerText = seconds;
        if (seconds <= 0) {
          clearInterval(newTimer);
          if (resendBtn) resendBtn.disabled = false;
        }
      }, 1000);
    }
  });
  
  // Start polling to check if email is confirmed
  if (confirmationPollingInterval) clearInterval(confirmationPollingInterval);
  
  confirmationPollingInterval = setInterval(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.confirmed_at) {
      clearInterval(confirmationPollingInterval);
      showMessage("🎉 Email confirmed! You can now login.", false);
      // Auto switch to login mode after 2 seconds
      setTimeout(() => {
        toggleMode("login");
        loginEmail.value = email;
      }, 2000);
    }
  }, 3000); // Check every 3 seconds
}

// =========================
// AUTO-LOGIN AFTER CONFIRMATION
// =========================
async function checkForAutoLogin() {
  // ONLY run if there's a hash in the URL (email confirmation redirect)
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
      showMessage("Email confirmed! Redirecting to dashboard...", false);
      
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
// CURRICULUM VISIBILITY
// =========================
function updateCurriculumVisibility() {
  const curriculum = curriculumSelect?.value;
  
  if (cbcBox) cbcBox.classList.add("hidden");
  if (eightFourFourBox) eightFourFourBox.classList.add("hidden");
  if (igcseBox) igcseBox.classList.add("hidden");
  if (ibBox) ibBox.classList.add("hidden");
  
  if (curriculum === "cbc" && cbcBox) {
    cbcBox.classList.remove("hidden");
  } else if (curriculum === "8-4-4" && eightFourFourBox) {
    eightFourFourBox.classList.remove("hidden");
  } else if (curriculum === "igcse" && igcseBox) {
    igcseBox.classList.remove("hidden");
  } else if (curriculum === "ib" && ibBox) {
    ibBox.classList.remove("hidden");
  }
}

function getSubjectsByCurriculum() {
  const curriculum = curriculumSelect?.value;
  let subjects = [];
  
  if (curriculum === "cbc") {
    subjects = getSelectedCheckboxValues("cbcSubjects");
  } else if (curriculum === "8-4-4") {
    subjects = getSelectedCheckboxValues("eightFourFourSubjects");
  } else if (curriculum === "igcse") {
    subjects = getSelectedCheckboxValues("igcseSubjects");
  } else if (curriculum === "ib") {
    subjects = getSelectedCheckboxValues("ibSubjects");
  }
  
  return subjects;
}

// =========================
// ROLE VISIBILITY
// =========================
function updateRoleVisibility() {
  const role = roleSelect?.value;
  
  if (role === "teacher" && teacherFields) {
    teacherFields.classList.remove("hidden");
  } else if (teacherFields) {
    teacherFields.classList.add("hidden");
  }
}

// =========================
// DISABILITY ACCOMMODATION
// =========================
function updateAccommodationInfo() {
  const disability = disabilitySelect?.value;
  if (accommodationInfo) {
    if (disability && disability !== "none") {
      accommodationInfo.classList.remove("hidden");
    } else {
      accommodationInfo.classList.add("hidden");
    }
  }
}

// =========================
// TOGGLE MODE
// =========================
function toggleMode(mode) {
  currentMode = mode;
  
  if (mode === "login") {
    loginFields.classList.remove("hidden");
    signupFields.classList.add("hidden");
    loginModeBtn.classList.add("active");
    signupModeBtn.classList.remove("active");
    pageTitle.innerText = "🎓 Welcome Back";
    pageSubtitle.innerText = "Login to continue your learning journey";
    submitBtn.innerText = "🔐 Login";
    trialNote.classList.add("hidden");
  } else {
    loginFields.classList.add("hidden");
    signupFields.classList.remove("hidden");
    signupModeBtn.classList.add("active");
    loginModeBtn.classList.remove("active");
    pageTitle.innerText = "📝 Create Account";
    pageSubtitle.innerText = "Start your 30-day free trial today";
    submitBtn.innerText = "📝 Sign Up";
    trialNote.classList.remove("hidden");
  }
}

// =========================
// LOGIN FUNCTION
// =========================
async function handleLogin(e) {
  e.preventDefault();
  
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  
  if (!email || !password) {
    showMessage("Please enter email and password");
    return;
  }
  
  setLoading(true);
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    if (error.message.includes("Email not confirmed")) {
      showMessage("⚠️ Please verify your email first. Check your inbox and click the confirmation link.", true);
      checkEmailConfirmation(email);
    } else {
      showMessage(error.message);
    }
    setLoading(false);
    return;
  }
  
  if (rememberMe.checked) {
    localStorage.setItem("rememberedEmail", email);
  } else {
    localStorage.removeItem("rememberedEmail");
  }
  
  setLoading(false);
  
  // Get user role and redirect
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();
  
  if (profile?.role === "teacher") {
    window.location.href = "teacher-dashboard.html";
  } else {
    window.location.href = "student-dashboard.html";
  }
}

// =========================
// SIGNUP FUNCTION
// =========================
async function handleSignup(e) {
  e.preventDefault();
  
  const email = signupEmail.value.trim();
  const password = signupPassword.value;
  const fullName = fullNameInput.value.trim();
  const religion = religionSelect?.value;
  const role = roleSelect?.value;
  const curriculum = curriculumSelect?.value;
  const grade = gradeSelect?.value;
  const disability = disabilitySelect?.value;
  const clubs = getClubs();
  const subjects = getSubjectsByCurriculum();
  
  // Basic validation
  if (!email || !password || !fullName) {
    showMessage("Please fill in all required fields");
    return;
  }
  
  if (!religion) {
    showMessage("Please select your religion");
    return;
  }
  
  if (!curriculum) {
    showMessage("Please select your curriculum");
    return;
  }
  
  if (!grade) {
    showMessage("Please select your grade");
    return;
  }
  
  if (password.length < 6) {
    showMessage("Password must be at least 6 characters");
    return;
  }
  
  if (!termsCheckbox?.checked) {
    showMessage("Please agree to the Terms of Service");
    return;
  }
  
  // Teacher validation
  if (role === "teacher") {
    const tscNumber = tscNumberInput?.value.trim();
    const schoolName = schoolNameInput?.value.trim();
    const teacherSubjects = getSelectedCheckboxValues("teacherSubjects");
    const teacherGrades = getSelectedCheckboxValues("teacherGrades");
    
    if (!tscNumber || !schoolName) {
      showMessage("Teachers must provide TSC number and school name");
      return;
    }
    
    if (teacherSubjects.length === 0) {
      showMessage("Please select at least one subject you teach");
      return;
    }
    
    if (teacherGrades.length === 0) {
      showMessage("Please select at least one grade you teach");
      return;
    }
  }
  
  // Student validation
  if (role === "student" && subjects.length === 0) {
    showMessage("Please select at least one subject to study");
    return;
  }
  
  setLoading(true);
  
  // Sign up with Supabase
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: role,
        religion: religion,
        curriculum: curriculum,
        grade: grade,
        disability: disability,
        clubs: clubs,
        subjects: subjects,
      },
    },
  });
  
  if (error) {
    showMessage(error.message);
    setLoading(false);
    return;
  }
  
  if (data.user) {
    // Update profile with additional data (created by trigger)
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        religion: religion,
        curriculum: curriculum,
        grade: grade,
        clubs: clubs,
        subjects: subjects,
        disability: disability !== "none" ? disability : null,
        full_name: fullName,
      })
      .eq("id", data.user.id);
    
    if (updateError) {
      console.error("Profile update error:", updateError);
    }
    
    // Store teacher data if applicable
    if (role === "teacher") {
      const teacherSubjects = getSelectedCheckboxValues("teacherSubjects");
      const teacherGrades = getSelectedCheckboxValues("teacherGrades");
      
      await supabase.from("teacher_profiles").upsert({
        user_id: data.user.id,
        tsc_number: tscNumberInput?.value.trim(),
        school_name: schoolNameInput?.value.trim(),
        subjects: teacherSubjects,
        grades: teacherGrades,
      });
    }
    
    // Store student subjects
    if (role === "student" && subjects.length > 0) {
      // Delete existing first to avoid duplicates
      await supabase.from("student_subjects").delete().eq("user_id", data.user.id);
      
      for (const subject of subjects) {
        await supabase.from("student_subjects").insert({
          user_id: data.user.id,
          subject_name: subject,
          curriculum: curriculum,
        });
      }
    }
    
    // Show email confirmation message
    checkEmailConfirmation(email);
  }
  
  setLoading(false);
}

// =========================
// FORGOT PASSWORD
// =========================
async function handleForgotPassword(e) {
  e.preventDefault();
  const email = loginEmail.value.trim();
  
  if (!email) {
    showMessage("Please enter your email address first");
    return;
  }
  
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/reset-password.html",
  });
  
  if (error) {
    showMessage(error.message);
  } else {
    showMessage("📧 Password reset link sent to your email! Check your inbox.", false);
  }
}

// =========================
// EVENT LISTENERS
// =========================
document.getElementById("authForm").addEventListener("submit", (e) => {
  if (currentMode === "login") {
    handleLogin(e);
  } else {
    handleSignup(e);
  }
});

loginModeBtn.addEventListener("click", () => toggleMode("login"));
signupModeBtn.addEventListener("click", () => toggleMode("signup"));
document.getElementById("forgotPasswordLink")?.addEventListener("click", handleForgotPassword);

// Signup field listeners
curriculumSelect?.addEventListener("change", updateCurriculumVisibility);
roleSelect?.addEventListener("change", updateRoleVisibility);
disabilitySelect?.addEventListener("change", updateAccommodationInfo);

// =========================
// INITIALIZE
// =========================
// Check for email confirmation redirect first
checkForAutoLogin();

// Check for remembered email
const savedEmail = localStorage.getItem("rememberedEmail");
if (savedEmail && loginEmail) {
  loginEmail.value = savedEmail;
  rememberMe.checked = true;
}

// Check if user is already logged in
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session?.user) {
    // Redirect to dashboard
    supabase.from("profiles").select("role").eq("id", session.user.id).single()
      .then(({ data: profile }) => {
        if (profile?.role === "teacher") {
          window.location.href = "teacher-dashboard.html";
        } else {
          window.location.href = "student-dashboard.html";
        }
      });
  }
});

// Initialize signup field visibility
updateCurriculumVisibility();
updateRoleVisibility();
updateAccommodationInfo();

// Start with login mode
toggleMode("login");
