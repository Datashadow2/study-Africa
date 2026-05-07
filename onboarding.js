import { supabase } from "./supabase.js";

// =========================
// GET CURRENT USER
// =========================
async function getUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    window.location.href = "auth.html";
    return null;
  }

  return data.user;
}

// =========================
// CHECK IF ALREADY ONBOARDED
// =========================
async function checkExistingOnboarding(userId) {
  const { data, error } = await supabase
    .from("teachers")
    .select("onboarded")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Onboarding check error:", error);
    return false;
  }

  if (data?.onboarded) {
    document.getElementById("status").innerText =
      "Already onboarded! Redirecting...";

    setTimeout(() => {
      window.location.href = "teacher-dashboard.html";
    }, 1200);

    return true;
  }

  return false;
}

// =========================
// VALIDATORS
// =========================
function validateKenyanPhone(phone) {
  const clean = phone.replace(/\s/g, "");
  return /^(07|01)\d{8}$|^2547\d{8}$/.test(clean);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// =========================
// MAIN ONBOARDING FUNCTION
// =========================
window.submitOnboarding = async function () {
  const status = document.getElementById("status");
  const button = document.querySelector(".btn.primary");

  const originalText = button.innerText;
  button.disabled = true;
  button.innerText = "⏳ Processing...";
  status.innerText = "Validating data...";

  const user = await getUser();
  if (!user) {
    button.disabled = false;
    button.innerText = originalText;
    return;
  }

  // prevent double onboarding
  const alreadyDone = await checkExistingOnboarding(user.id);
  if (alreadyDone) {
    button.disabled = false;
    button.innerText = originalText;
    return;
  }

  // =========================
  // PROFILE DATA
  // =========================
  const name = document.getElementById("name")?.value.trim();
  const school = document.getElementById("school")?.value.trim();
  const phone = document.getElementById("phone")?.value.trim();
  const email = document.getElementById("email")?.value.trim();
  const curriculum = document.getElementById("curriculumSelect")?.value;

  const subjects = Array.from(
    document.getElementById("subjects")?.selectedOptions || []
  ).map(o => o.value);

  const grades = Array.from(
    document.getElementById("grades")?.selectedOptions || []
  ).map(o => o.value);

  // =========================
  // VALIDATION (STRICT)
  // =========================
  if (!name || !school || !phone || !email || !curriculum) {
    status.innerText = "❌ Complete all profile fields.";
    button.disabled = false;
    button.innerText = originalText;
    return;
  }

  if (!validateEmail(email)) {
    status.innerText = "❌ Invalid email format.";
    button.disabled = false;
    button.innerText = originalText;
    return;
  }

  if (!validateKenyanPhone(phone)) {
    status.innerText = "❌ Invalid Kenyan phone number.";
    button.disabled = false;
    button.innerText = originalText;
    return;
  }

  if (subjects.length === 0 || grades.length === 0) {
    status.innerText = "❌ Select at least one subject and grade.";
    button.disabled = false;
    button.innerText = originalText;
    return;
  }

  // =========================
  // NOTE DATA
  // =========================
  const noteTitle = document.getElementById("noteTitle")?.value.trim();
  const noteSubject = document.getElementById("noteSubject")?.value;
  const noteCurriculum = document.getElementById("noteCurriculum")?.value;
  const noteGrade = document.getElementById("noteGrade")?.value;
  const content = document.getElementById("content")?.value.trim();
  const objectives = document.getElementById("objectives")?.value.trim();
  const materials = document.getElementById("materials")?.value.trim();

  if (!noteTitle || !content) {
    status.innerText = "❌ First lesson note is required.";
    button.disabled = false;
    button.innerText = originalText;
    return;
  }

  try {
    // =========================
    // 1. SAVE PROFILE (NOT ONBOARDED YET)
    // =========================
    status.innerText = "💾 Saving profile...";

    const { error: profileError } = await supabase
      .from("teachers")
      .upsert({
        id: user.id,
        name,
        school,
        phone,
        email,
        curriculum,
        subjects,
        grades,
        onboarded: false,
        onboarded_at: null
      });

    if (profileError) {
      throw profileError;
    }

    // =========================
    // 2. SAVE FIRST NOTE
    // =========================
    status.innerText = "📝 Saving first lesson note...";

    const { error: noteError } = await supabase
      .from("notes")
      .insert({
        teacher_id: user.id,
        title: noteTitle,
        subject: noteSubject,
        curriculum: noteCurriculum,
        grade: noteGrade,
        content,
        objectives: objectives || null,
        materials: materials || null,
        is_onboarding_note: true,
        created_at: new Date().toISOString()
      });

    if (noteError) {
      throw noteError;
    }

    // =========================
    // 3. FINALIZE ONBOARDING ONLY AFTER SUCCESS
    // =========================
    status.innerText = "🔒 Finalizing onboarding...";

    const { error: updateError } = await supabase
      .from("teachers")
      .update({
        onboarded: true,
        onboarded_at: new Date().toISOString()
      })
      .eq("id", user.id);

    if (updateError) {
      throw updateError;
    }

    // =========================
    // SUCCESS
    // =========================
    status.innerText = "✅ Onboarding complete! Redirecting...";

    setTimeout(() => {
      window.location.href = "teacher-dashboard.html";
    }, 1500);

  } catch (err) {
    console.error(err);
    status.innerText = "❌ " + err.message;
    button.disabled = false;
    button.innerText = originalText;
  }
};
