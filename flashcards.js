import { supabase } from "./supabase.js";

// =========================
// STATE
// =========================
let flashcards = [];
let currentIndex = 0;
let isFlipped = false;
let autoPlayInterval = null;
let currentStudyMode = "all";
let searchQuery = "";
let sessionId = null;

let sessionStats = {
  correct: 0,
  incorrect: 0,
  reviewed: 0,
  mastered: 0,
  startTime: Date.now()
};

// =========================
// INIT
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  await loadNotes();
  loadSavedSession();
  setupEventListeners();
  startSessionTimer();
});

// =========================
// SAFE HELPERS
// =========================
function el(id) {
  return document.getElementById(id);
}

function safeSetText(id, text) {
  const node = el(id);
  if (node) node.innerText = text;
}

// =========================
// EVENT LISTENERS
// =========================
function setupEventListeners() {
  document.addEventListener("keydown", (e) => {
    if (!flashcards.length) return;

    if (e.key === "ArrowLeft") prevCard();
    if (e.key === "ArrowRight") nextCard();
    if (e.key === " ") flipCard();
    if (e.key.toLowerCase() === "m") markMastered();
    if (e.key.toLowerCase() === "r") resetSession();
    if (e.key === "1") rateCard("easy");
    if (e.key === "2") rateCard("medium");
    if (e.key === "3") rateCard("hard");
  });

  el("studyMode")?.addEventListener("change", (e) => {
    currentStudyMode = e.target.value;
    applyStudyMode();
  });

  el("cardOrder")?.addEventListener("change", applyCardOrder);

  el("darkMode")?.addEventListener("change", (e) => {
    document.body.classList.toggle("dark-mode", e.target.checked);
    localStorage.setItem("darkMode", e.target.checked);
  });

  el("soundEnabled")?.addEventListener("change", (e) => {
    localStorage.setItem("soundEnabled", e.target.checked);
  });

  el("autoFlip")?.addEventListener("change", (e) => {
    if (e.target.checked) setTimeout(flipCard, 1200);
  });
}

// =========================
// LOAD NOTES
// =========================
async function loadNotes() {
  const selector = el("noteSelector");

  const { data, error } = await supabase
    .from("notes")
    .select("id, title")
    .order("created_at", { ascending: false });

  if (error || !data?.length) {
    if (selector) selector.innerHTML = `<option>No notes found</option>`;
    return;
  }

  if (selector) {
    selector.innerHTML = `
      <option value="">-- Select a note --</option>
      ${data.map(n => `<option value="${n.id}">${escapeHtml(n.title)}</option>`).join("")}
    `;
  }
}

// =========================
// GENERATE FLASHCARDS
// =========================
window.generateFlashcards = async function () {
  const noteId = el("noteSelector")?.value;
  if (!noteId) return showToast("Select a note first", "warning");

  showLoading(true);

  try {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("id", noteId)
      .single();

    if (error || !data) throw new Error("Note not found");

    flashcards = buildFlashcards(data.content, data.title);

    if (!flashcards.length) {
      showToast("No usable content found", "warning");
      return;
    }

    currentIndex = 0;
    resetStats();

    await createSession(data.id, data.title);

    toggleUI(true);
    renderCard();

    showToast(`Generated ${flashcards.length} cards`, "success");

  } catch (err) {
    console.error(err);
    showToast("Failed to generate flashcards", "error");
  } finally {
    showLoading(false);
  }
};

// =========================
// FLASHCARD BUILDER
// =========================
function buildFlashcards(content, title) {
  if (!content) return [];

  const sentences = [...new Set(
    content
      .replace(/\n/g, ". ")
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20)
  )].slice(0, 25);

  return sentences.map((s, i) => ({
    id: Date.now() + i,
    front: `❓ ${s.split(" ").slice(0, 6).join(" ")}...`,
    back: s,
    difficulty: "medium",
    mastered: false,
    timesReviewed: 0,
    correctCount: 0
  }));
}

// =========================
// RENDER
// =========================
function renderCard() {
  if (!flashcards.length) return;

  const card = flashcards[currentIndex];

  const front = el("cardFront");
  const back = el("cardBack");

  if (front) front.innerHTML = `<div>${escapeHtml(card.front)}</div>`;
  if (back) back.innerHTML = `<div>${escapeHtml(card.back)}</div>`;

  safeSetText("cardProgress", `${currentIndex + 1} / ${flashcards.length}`);

  const flash = el("flashcard");
  flash?.classList.remove("flipped");
  isFlipped = false;

  updateUI();
}

// =========================
// ACTIONS
// =========================
window.flipCard = function () {
  const flash = el("flashcard");
  flash?.classList.toggle("flipped");
  isFlipped = !isFlipped;
};

window.nextCard = function () {
  if (currentIndex < flashcards.length - 1) {
    currentIndex++;
    renderCard();
  }
};

window.prevCard = function () {
  if (currentIndex > 0) {
    currentIndex--;
    renderCard();
  }
};

// =========================
// RATING
// =========================
window.rateCard = async function (level) {
  const card = flashcards[currentIndex];
  if (!card) return;

  card.timesReviewed++;

  if (level === "easy") {
    sessionStats.correct++;
    card.correctCount++;
  } else if (level === "hard") {
    sessionStats.incorrect++;
  } else {
    sessionStats.correct++;
  }

  sessionStats.reviewed++;

  await saveRating(level);
  saveSession();
  nextCard();
};

// =========================
// MASTERED
// =========================
window.markMastered = function () {
  const card = flashcards[currentIndex];
  if (!card) return;

  card.mastered = true;
  sessionStats.mastered++;
  saveSession();
  nextCard();
};

// =========================
// STUDY MODE
// =========================
function applyStudyMode() {
  let filtered = [...flashcards];

  if (currentStudyMode === "unmastered") {
    filtered = filtered.filter(c => !c.mastered);
  }

  if (currentStudyMode === "hard") {
    filtered = filtered.filter(c => c.difficulty === "hard");
  }

  flashcards = filtered;
  currentIndex = 0;
  renderCard();
}

// =========================
// ORDER
// =========================
function applyCardOrder() {
  const order = el("cardOrder")?.value;

  if (order === "shuffled") {
    flashcards.sort(() => Math.random() - 0.5);
  }

  if (order === "hardest-first") {
    flashcards.sort((a, b) => (a.difficulty === "hard" ? -1 : 1));
  }

  renderCard();
}

// =========================
// SESSION
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

function saveSession() {
  localStorage.setItem("flashcards", JSON.stringify({
    flashcards,
    currentIndex,
    sessionStats
  }));
}

function loadSavedSession() {
  const saved = localStorage.getItem("flashcards");
  if (!saved) return;

  try {
    const data = JSON.parse(saved);

    flashcards = data.flashcards || [];
    currentIndex = data.currentIndex || 0;
    sessionStats = data.sessionStats || sessionStats;

    if (flashcards.length) toggleUI(true);
  } catch {}
}

// =========================
// SUPABASE
// =========================
async function createSession(noteId, title) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return;

  const { data } = await supabase
    .from("flashcard_sessions")
    .insert({
      user_id: user.user.id,
      note_id: noteId,
      note_title: title
    })
    .select()
    .single();

  sessionId = data?.id || null;
}

async function saveRating(level) {
  if (!sessionId) return;

  await supabase.from("flashcard_responses").insert({
    session_id: sessionId,
    rating: level,
    card_front: flashcards[currentIndex]?.front
  });
}

// =========================
// UI TOGGLE
// =========================
function toggleUI(show) {
  ["flashcardContainer", "progressSection", "ratingButtons", "searchSection"]
    .forEach(id => el(id)?.classList.toggle("hidden", !show));

  el("emptyState")?.classList.toggle("hidden", show);
}

// =========================
// TIMER
// =========================
function startSessionTimer() {
  setInterval(() => {
    const sec = Math.floor((Date.now() - sessionStats.startTime) / 1000);
    safeSetText("sessionTimer", `${Math.floor(sec/60)}:${sec%60}`);
  }, 1000);
}

// =========================
// UTILS
// =========================
function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;");
}

function showToast(msg) {
  alert(msg);
}

function showLoading(state) {
  el("loadingSpinner")?.classList.toggle("hidden", !state);
}
