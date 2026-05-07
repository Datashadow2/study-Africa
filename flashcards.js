import { supabase } from "./supabase.js";

// =========================
// STATE
// =========================
let flashcards = [];
let originalFlashcards = [];
let currentIndex = 0;
let isFlipped = false;
let autoPlayInterval = null;
let sessionId = null;

let sessionStats = {
  correct: 0,
  incorrect: 0,
  reviewed: 0,
  mastered: 0,
  startTime: Date.now()
};

let currentStudyMode = "all";
let cardOrder = "sequential";
let wrapAround = false;

// =========================
// INIT
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  await loadNotes();
  loadSavedSession();
  setupEventListeners();
  startSessionTimer();
  loadUserPreferences();

  window.addEventListener("beforeunload", () => {
    if (sessionId) endSession();
  });
});

// =========================
// SAFE FLASHCARD BUILDER
// =========================
function buildFlashcards(content) {
  if (!content) return [];

  let clean = content
    .replace(/\n/g, ". ")
    .replace(/\s+/g, " ")
    .trim();

  let sentences = clean
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 15);

  sentences = [...new Set(sentences)].slice(0, 20);

  return sentences.map((s, i) => ({
    id: Date.now() + i,
    front: s.split(" ").slice(0, 8).join(" ") + (s.split(" ").length > 8 ? "..." : ""),
    back: s,
    difficulty: "medium",
    mastered: false,
    timesReviewed: 0,
    correctCount: 0
  }));
}

// =========================
// GENERATE FLASHCARDS
// =========================
window.generateFlashcards = async function () {
  const noteId = document.getElementById("noteSelector")?.value;
  if (!noteId) return showToast("Select a note first", "warning");

  showLoading(true);

  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return;

  // 1. CHECK EXISTING FLASHCARDS
  const { data: existing } = await supabase
    .from("flashcards")
    .select("*")
    .eq("note_id", noteId)
    .eq("user_id", user.user.id);

  if (existing && existing.length > 0) {
    flashcards = existing;
    originalFlashcards = existing;
    currentIndex = 0;

    showUI();
    renderCard();
    showToast("Loaded existing flashcards", "success");
    showLoading(false);
    return;
  }

  // 2. LOAD NOTE
  const { data: note } = await supabase
    .from("notes")
    .select("*")
    .eq("id", noteId)
    .single();

  if (!note) {
    showToast("Note not found", "error");
    showLoading(false);
    return;
  }

  // 3. GENERATE CARDS
  const generated = buildFlashcards(note.content);

  // 4. SAVE TO DATABASE
  const toInsert = generated.map(c => ({
    user_id: user.user.id,
    note_id: noteId,
    front: c.front,
    back: c.back
  }));

  const { data: saved, error } = await supabase
    .from("flashcards")
    .insert(toInsert)
    .select();

  if (error) {
    console.error(error);
    showToast("Failed to save flashcards", "error");
    showLoading(false);
    return;
  }

  flashcards = saved;
  originalFlashcards = saved;
  currentIndex = 0;

  showUI();
  renderCard();
  showToast(`Created ${saved.length} flashcards`, "success");

  showLoading(false);
};
// =========================
// SESSION CREATION (SAFE)
// =========================
async function createSession(noteId, noteTitle) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return;

  const { data } = await supabase
    .from("flashcard_sessions")
    .insert({
      user_id: user.user.id,
      note_id: noteId,
      note_title: noteTitle,
      total_cards: flashcards.length,
      started_at: new Date().toISOString()
    })
    .select()
    .single();

  sessionId = data?.id ?? null;
}

// =========================
// APPLY STUDY MODE (FIXED)
// =========================
function applyStudyMode() {
  if (!originalFlashcards.length) return;

  let filtered = [...originalFlashcards];

  if (currentStudyMode === "unmastered") {
    filtered = filtered.filter(c => !c.mastered);
  } else if (currentStudyMode === "hard") {
    filtered = filtered.filter(c => c.difficulty === "hard");
  } else if (currentStudyMode === "review") {
    filtered = filtered.filter(c => c.timesReviewed > 0);
  }

  flashcards = filtered.length ? filtered : [...originalFlashcards];
  currentIndex = 0;

  renderCard();
}

// =========================
// NAV SAFE GUARDS
// =========================
window.nextCard = function () {
  if (!flashcards.length) return;

  if (currentIndex < flashcards.length - 1) {
    currentIndex++;
  } else if (wrapAround) {
    currentIndex = 0;
  }

  renderCard();
};

window.prevCard = function () {
  if (!flashcards.length) return;

  if (currentIndex > 0) {
    currentIndex--;
  } else if (wrapAround) {
    currentIndex = flashcards.length - 1;
  }

  renderCard();
};

// =========================
// RATING (FIXED SYNC ORDER)
// =========================
window.rateCard = async function (level) {
  if (!flashcards.length) return;

  const card = flashcards[currentIndex];

  card.timesReviewed++;
  sessionStats.reviewed++;

  if (level === "easy" || level === "medium") {
    sessionStats.correct++;
    card.correctCount++;
  } else {
    sessionStats.incorrect++;
  }

  await syncSessionStats();
  saveSession();

  setTimeout(() => nextCard(), 200);
};

// =========================
// RESET SAFELY
// =========================
function resetStats() {
  sessionStats = {
    correct: 0,
    incorrect: 0,
    reviewed: 0,
    mastered: 0,
    startTime: Date.now()
  };
}
