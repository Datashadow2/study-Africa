import { supabase } from "./supabase.js";

// =========================
// STATE
// =========================
let currentNote = null;
let currentSummary = null;
let currentQuestions = [];
let quizActive = false;
let currentQuestionIndex = 0;
let quizScore = 0;
let aiHistory = [];

let flashcards = [];
let currentFlashcardIndex = 0;

// =========================
// INIT
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  await loadUserNotes();
  setupEventListeners();
  loadAiHistory();
});

// =========================
// LOAD NOTES
// =========================
async function loadUserNotes() {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return;

  const { data } = await supabase
    .from("notes")
    .select("id, title, subject, grade")
    .eq("teacher_id", user.user.id)
    .order("created_at", { ascending: false });

  const selector = document.getElementById("noteSelector");
  if (!selector) return;

  selector.innerHTML = `
    <option value="">-- Select note --</option>
    ${data.map(n => `<option value="${n.id}">${n.title}</option>`).join("")}
  `;
}

// =========================
// LOAD NOTE CONTENT
// =========================
async function loadNoteContent(noteId) {
  const { data } = await supabase
    .from("notes")
    .select("*")
    .eq("id", noteId)
    .single();

  currentNote = data;

  document.getElementById("notePreview").innerText =
    data.content.slice(0, 500) + "...";

  enableButtons(true);
}

// =========================
// LOCAL SUMMARY
// =========================
function generateSummaryLocal(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.length > 20);
  return sentences.slice(0, 4).join(". ") + ".";
}

window.generateSummary = function () {
  if (!currentNote) return alert("Select a note first");

  const summary = generateSummaryLocal(currentNote.content);
  currentSummary = summary;

  renderResult("Summary", summary);
};

// =========================
// LOCAL QUESTIONS
// =========================
function generateQuestionsLocal(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.length > 25);

  return sentences.slice(0, 5).map((s, i) => ({
    question: `What is the meaning of: "${s.slice(0, 40)}..."?`,
    answer: s
  }));
}

window.generateQuestions = function () {
  if (!currentNote) return;

  currentQuestions = generateQuestionsLocal(currentNote.content);
  renderQuestions(currentQuestions);
};

// =========================
// FLASHCARDS (NO DB TABLE)
// =========================
function generateFlashcardsLocal(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.length > 20);

  return sentences.slice(0, 10).map(s => ({
    front: s.split(" ").slice(0, 6).join(" ") + "...",
    back: s
  }));
}

window.generateFlashcards = function () {
  if (!currentNote) return;

  flashcards = generateFlashcardsLocal(currentNote.content);
  currentFlashcardIndex = 0;

  renderFlashcard();
};

// =========================
// FLASHCARD NAV
// =========================
window.nextFlashcard = function () {
  if (currentFlashcardIndex < flashcards.length - 1) {
    currentFlashcardIndex++;
    renderFlashcard();
  }
};

window.prevFlashcard = function () {
  if (currentFlashcardIndex > 0) {
    currentFlashcardIndex--;
    renderFlashcard();
  }
};

// =========================
// RENDER FLASHCARD
// =========================
function renderFlashcard() {
  const card = flashcards[currentFlashcardIndex];
  if (!card) return;

  document.getElementById("flashcardFront").innerText = card.front;
  document.getElementById("flashcardBack").innerText = card.back;
  document.getElementById("flashcardIndex").innerText =
    `${currentFlashcardIndex + 1} / ${flashcards.length}`;
}

// =========================
// QUIZ
// =========================
window.startQuiz = function () {
  quizActive = true;
  currentQuestionIndex = 0;
  quizScore = 0;

  renderQuiz();
};

function renderQuiz() {
  const q = currentQuestions[currentQuestionIndex];
  if (!q) return finishQuiz();

  document.getElementById("quizBox").innerHTML = `
    <h3>${q.question}</h3>
    <input id="quizAnswer" placeholder="Type answer..." />
    <button onclick="submitAnswer()">Submit</button>
  `;
}

window.submitAnswer = function () {
  const input = document.getElementById("quizAnswer").value;
  const correct = currentQuestions[currentQuestionIndex].answer;

  if (input.toLowerCase().includes(correct.toLowerCase().slice(0, 10))) {
    quizScore++;
  }

  currentQuestionIndex++;
  renderQuiz();
};

function finishQuiz() {
  quizActive = false;

  document.getElementById("quizBox").innerHTML = `
    <h3>Score: ${quizScore} / ${currentQuestions.length}</h3>
  `;
}

// =========================
// SIMPLE AI UTILITIES
// =========================
function renderResult(title, content) {
  document.getElementById("aiResult").innerHTML = `
    <h3>${title}</h3>
    <p>${content}</p>
  `;
}

function renderQuestions(questions) {
  document.getElementById("aiResult").innerHTML = `
    <h3>Questions</h3>
    ${questions.map(q => `
      <p><b>Q:</b> ${q.question}</p>
      <p><b>A:</b> ${q.answer}</p>
      <hr/>
    `).join("")}
  `;
}

function enableButtons(state) {
  document.querySelectorAll(".ai-btn").forEach(btn => {
    btn.disabled = !state;
  });
}

// =========================
// UTILS
// =========================
function loadAiHistory() {
  aiHistory = JSON.parse(localStorage.getItem("ai_history") || "[]");
}

function saveHistory(item) {
  aiHistory.unshift(item);
  localStorage.setItem("ai_history", JSON.stringify(aiHistory));
}
