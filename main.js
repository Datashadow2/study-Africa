import { supabase } from "./supabase.js";
import {
  generateSummaryLocal,
  generateQuestionsLocal,
  generateFlashcardsLocal,
  generateKeyPointsLocal,
  generateStudyPlanLocal,
  simplifyTextLocal,
  explainConceptLocal
} from "./aiEngine.js";

// =========================
// STATE
// =========================
let currentNote = null;
let currentUser = null;
let currentQuestions = [];
let currentFlashcards = [];

// =========================
// BOOT SEQUENCE (FIXED)
// =========================
document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  try {
    showLoading(true);

    await checkAuth();              // MUST come first
    await setupUI();                // bind UI after DOM + auth
    setupKeyboardShortcuts();       // safe to bind anytime
    await loadUserNotes();          // now safe (user exists)

  } catch (err) {
    console.error("Init error:", err);
    showToast("App failed to start properly", "error");
  } finally {
    showLoading(false);
  }
}

// =========================
// AUTH (STABILIZED)
// =========================
async function checkAuth() {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;

  if (!data.user) {
    window.location.href = "auth.html";
    return;
  }

  currentUser = data.user;

  const userInfoEl = document.getElementById("userInfo");
  if (userInfoEl) {
    userInfoEl.innerText = `Welcome, ${currentUser.email}`;
  }
}

// =========================
// LOAD USER NOTES (FIXED RELIABILITY)
// =========================
async function loadUserNotes() {
  if (!currentUser?.id) {
    console.warn("No user found, skipping notes load");
    return;
  }

  try {
    showLoading(true);

    const { data, error } = await supabase
      .from("notes")
      .select("id, title, subject, grade, curriculum")
      .eq("teacher_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const selector = document.getElementById("noteSelector");
    if (!selector) return;

    if (!data?.length) {
      selector.innerHTML = `<option value="">No notes found. Create a note first.</option>`;
      return;
    }

    selector.innerHTML = `
      <option value="">-- Select a note --</option>
      ${data.map(note => `
        <option value="${note.id}">
          ${escapeHtml(note.title)} (${note.subject} - ${note.grade})
        </option>
      `).join("")}
    `;

  } catch (err) {
    console.error("Error loading notes:", err);
    showToast("Failed to load notes", "error");
  } finally {
    showLoading(false);
  }
}

// =========================
// UI SETUP (SAFE BINDING)
// =========================
async function setupUI() {
  const bind = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
  };

  const changeBind = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", fn);
  };

  changeBind("noteSelector", loadNote);

  bind("summaryBtn", handleSummary);
  bind("questionsBtn", handleQuestions);
  bind("flashcardsBtn", handleFlashcards);
  bind("keypointsBtn", handleKeyPoints);
  bind("simplifyBtn", handleSimplify);
  bind("studyplanBtn", handleStudyPlan);
  bind("explainBtn", handleExplain);

  bind("clearBtn", clearOutput);
  bind("copyBtn", copyOutput);
  bind("downloadBtn", downloadOutput);
  bind("saveToNotesBtn", saveToNotes);
}

// =========================
// LOAD NOTE (SAFE)
// =========================
async function loadNote(e) {
  const id = e?.target?.value;
  if (!id) {
    currentNote = null;
    const preview = document.getElementById("preview");
    if (preview) preview.innerHTML = `<p class="muted">Select a note to preview</p>`;
    return;
  }

  try {
    showLoading(true);

    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    currentNote = data;

    const preview = document.getElementById("preview");
    if (preview) {
      preview.innerHTML = `
        <div class="note-info">
          <strong>${escapeHtml(data.title)}</strong><br>
          <small>${data.subject} | ${data.grade} | ${data.curriculum}</small>
        </div>
        <div class="note-content">
          ${escapeHtml((data.content || "").slice(0, 500))}
        </div>
      `;
    }

    enableFeatureButtons(true);
    showToast("Note loaded", "success");

  } catch (err) {
    console.error(err);
    showToast("Failed to load note", "error");
  } finally {
    showLoading(false);
  }
}

// =========================
// FEATURE GATE (UNCHANGED LOGIC, SAFER)
// =========================
function requireNote() {
  if (!currentNote) {
    showToast("Select a note first", "warning");
    return false;
  }
  return true;
}

// =========================
// HANDLERS (MINOR STABILITY IMPROVEMENT EXAMPLE)
// =========================
async function handleSummary() {
  if (!requireNote()) return;

  try {
    showLoading(true);
    showAiStatus("Generating summary...");

    await delay(300);

    const summary = generateSummaryLocal(currentNote.content);

    displayOutput(`
      <div class="result-card summary">
        <h3>📝 Summary</h3>
        <div>${escapeHtml(summary)}</div>
      </div>
    `);

    await saveToHistory("summary", summary);
    showToast("Summary ready", "success");

  } catch (err) {
    console.error(err);
    showToast("Summary failed", "error");
  } finally {
    showLoading(false);
    hideAiStatus();
  }
}

// (Other handlers remain the same structure — no need to rewrite all unless you want full refactor)

// =========================
// HELPERS (UNCHANGED)
// =========================
function displayOutput(html) {
  const el = document.getElementById("output");
  if (el) {
    el.innerHTML = html;
    el.classList.remove("hidden");
  }
}

function clearOutput() {
  const el = document.getElementById("output");
  if (el) el.innerHTML = `<p class="muted">AI output will appear here</p>`;
}

function enableFeatureButtons(enabled) {
  ["summaryBtn","questionsBtn","flashcardsBtn","keypointsBtn","simplifyBtn","studyplanBtn","explainBtn"]
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    });
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// (keep your existing toast, escapeHtml, etc unchanged)
