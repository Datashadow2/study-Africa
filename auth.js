import { supabase } from "./supabase.js";

// =========================
// STATE
// =========================
let currentMode = "login";

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
function showMessage(msg, isError = true) {
  messageDiv.textContent = msg;
  messageDiv.className = isError ? "error" : "success";
  setTimeout(() => {
    messageDiv.textContent = "";
    messageDiv.className = "note";
  }, 5000);
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
    // Show login fields, hide signup fields
    loginFields.classList.remove("hidden");
    signupFields.classList.add("hidden");
    
    // Update UI
    loginModeBtn.classList.add("active");
    signupModeBtn.classList.remove("active");
    pageTitle.innerText = "🎓 Welcome Back";
    pageSubtitle.innerText = "Login to continue your learning journey";
    submitBtn.innerText = "🔐 Login";
    trialNote.classList.add("hidden");
    
  } else {
    // Show signup fields, hide login fields
    loginFields.classList.add("hidden");
    signupFields.classList.remove("hidden");
    
    // Update UI
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
    showMessage(error.message);
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
    // Create profile
    await supabase.from("profiles").insert({
      id: data.user.id,
      full_name: fullName,
      email: email,
      role: role,
      religion: religion,
      curriculum: curriculum,
      grade: grade,
      clubs: clubs,
      subjects: subjects,
      disability: disability !== "none" ? disability : null,
      onboarded: false,
      is_premium: false,
      trial_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    
    // Store teacher data if applicable
    if (role === "teacher") {
      const teacherSubjects = getSelectedCheckboxValues("teacherSubjects");
      const teacherGrades = getSelectedCheckboxValues("teacherGrades");
      
      await supabase.from("teacher_profiles").insert({
        user_id: data.user.id,
        tsc_number: tscNumberInput?.value.trim(),
        school_name: schoolNameInput?.value.trim(),
        subjects: teacherSubjects,
        grades: teacherGrades,
      });
    }
    
    // Store student subjects
    if (role === "student" && subjects.length > 0) {
      for (const subject of subjects) {
        await supabase.from("student_subjects").insert({
          user_id: data.user.id,
          subject_name: subject,
          curriculum: curriculum,
        });
      }
    }
    
    showMessage("Account created successfully! Check your email to verify, then login.", false);
    
    // Switch to login mode after 3 seconds
    setTimeout(() => {
      toggleMode("login");
      loginEmail.value = email;
    }, 3000);
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
    showMessage("Password reset link sent to your email!", false);
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
// Check for remembered email
const savedEmail = localStorage.getItem("rememberedEmail");
if (savedEmail && loginEmail) {
  loginEmail.value = savedEmail;
  rememberMe.checked = true;
}

// Initialize signup field visibility
updateCurriculumVisibility();
updateRoleVisibility();
updateAccommodationInfo();

// Start with login mode
toggleMode("login");
