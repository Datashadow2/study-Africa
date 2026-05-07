import { supabase } from "./supabase.js";

// =========================
// STATE
// =========================
let currentPage = 1;
let totalPages = 1;
let currentView = "grid";
let bookmarksOnly = false;
let cachedNotes = [];

// =========================
// ERROR + RELIABILITY LAYER
// =========================
async function safeAsync(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error(err);
    return fallback;
  }
}

let loadTimeout;

function showLoadingTimeout() {
  loadTimeout = setTimeout(() => {
    const container = document.getElementById("notesContainer");

    if (container && container.innerHTML === "") {
      container.innerHTML = `
        <div class="error-state">
          <p>⚠️ Loading is taking longer than expected.</p>
          <p>Please check your connection.</p>
        </div>
      `;
    }
  }, 10000);
}

async function fetchWithRetry(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(res =>
        setTimeout(res, 1000 * (i + 1))
      );
    }
  }
}

// =========================
// INIT
// =========================
document.addEventListener("DOMContentLoaded", () => {
  loadNotes(1);
});

// =========================
// LOAD NOTES (CORE ENGINE)
// =========================
window.loadNotes = async function (page = 1) {
  currentPage = page;

  clearTimeout(loadTimeout);
  showLoadingTimeout();

  const container = document.getElementById("notesContainer");
  const loading = document.getElementById("loadingSpinner");
  const emptyState = document.getElementById("emptyState");

  loading.classList.remove("hidden");
  emptyState.classList.add("hidden");
  container.innerHTML = "";

  try {
    const result = await fetchWithRetry(async () => {

      let query = supabase
        .from("notes")
        .select("*", { count: "exact" })
        .range((page - 1) * 12, page * 12 - 1)
        .order("created_at", { ascending: false });

      // =========================
      // FILTERS
      // =========================
      const search = document.getElementById("searchInput")?.value;
      const subject = document.getElementById("filterSubject")?.value;
      const grade = document.getElementById("filterGrade")?.value;
      const curriculum = document.getElementById("filterCurriculum")?.value;
      const sort = document.getElementById("sortBy")?.value;

      if (search) query = query.ilike("title", `%${search}%`);
      if (subject) query = query.eq("subject", subject);
      if (grade) query = query.eq("grade", grade);
      if (curriculum) query = query.eq("curriculum", curriculum);

      if (sort === "oldest") {
        query = query.order("created_at", { ascending: true });
      } else if (sort === "title_asc") {
        query = query.order("title", { ascending: true });
      } else if (sort === "title_desc") {
        query = query.order("title", { ascending: false });
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return { data, count };
    });

    loading.classList.add("hidden");
    clearTimeout(loadTimeout);

    cachedNotes = result.data || [];

    updateBadge(result.count);
    updatePagination(result.count);

    if (!cachedNotes.length) {
      emptyState.classList.remove("hidden");
      return;
    }

    renderNotes(cachedNotes);

  } catch (err) {
    console.error("Load failed:", err);

    loading.classList.add("hidden");
    clearTimeout(loadTimeout);

    container.innerHTML = `
      <div class="error-state">
        <p>❌ Failed to load notes</p>
        <button onclick="loadNotes(1)" class="btn primary">
          Retry
        </button>
      </div>
    `;
  }
};

// =========================
// RENDER NOTES
// =========================
function renderNotes(notes) {
  const container = document.getElementById("notesContainer");

  container.className =
    currentView === "grid" ? "grid-view" : "list-view";

  container.innerHTML = notes.map(note => `
    <div class="note-card" onclick="openNote('${note.id}')">

      <h3>${note.title}</h3>

      <p class="meta">
        📘 ${note.subject} • 🎓 ${note.grade} • 📜 ${note.curriculum}
      </p>

      <p class="preview">
        ${(note.content || "").slice(0, 120)}...
      </p>

      <div class="note-actions">
        <button onclick="event.stopPropagation(); bookmarkNote('${note.id}')">
          ⭐ Save
        </button>

        <button onclick="event.stopPropagation(); openNote('${note.id}')">
          Read →
        </button>
      </div>

    </div>
  `).join("");
}

// =========================
// OPEN NOTE
// =========================
window.openNote = function (id) {
  const note = cachedNotes.find(n => n.id === id);
  if (!note) return;

  saveRecent(note);

  alert(`${note.title}\n\n${note.content}`);
};

// =========================
// BOOKMARK SYSTEM
// =========================
window.bookmarkNote = function (id) {
  let bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "[]");

  if (!bookmarks.includes(id)) {
    bookmarks.push(id);
    localStorage.setItem("bookmarks", JSON.stringify(bookmarks));
    alert("Saved ⭐");
  }
};

window.toggleBookmarksOnly = function () {
  bookmarksOnly = !bookmarksOnly;

  if (bookmarksOnly) {
    const bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "[]");
    cachedNotes = cachedNotes.filter(n =>
      bookmarks.includes(n.id)
    );
    renderNotes(cachedNotes);
  } else {
    loadNotes(currentPage);
  }
};

// =========================
// RECENT VIEWS
// =========================
function saveRecent(note) {
  let recent = JSON.parse(localStorage.getItem("recentNotes") || "[]");

  recent = recent.filter(n => n.id !== note.id);
  recent.unshift(note);

  if (recent.length > 5) recent = recent.slice(0, 5);

  localStorage.setItem("recentNotes", JSON.stringify(recent));
}

// =========================
// VIEW TOGGLE
// =========================
window.setView = function (view) {
  currentView = view;

  document.getElementById("gridViewBtn").classList.remove("active");
  document.getElementById("listViewBtn").classList.remove("active");

  document.getElementById(view === "grid"
    ? "gridViewBtn"
    : "listViewBtn"
  ).classList.add("active");

  renderNotes(cachedNotes);
};

// =========================
// RESET FILTERS
// =========================
window.resetFilters = function () {
  document.getElementById("searchInput").value = "";
  document.getElementById("filterSubject").value = "";
  document.getElementById("filterGrade").value = "";
  document.getElementById("filterCurriculum").value = "";
  document.getElementById("sortBy").value = "newest";

  loadNotes(1);
};

// =========================
// PAGINATION
// =========================
function updatePagination(count) {
  const perPage = 12;
  totalPages = Math.ceil((count || 0) / perPage);

  document.getElementById("pageInfo").innerText =
    `Page ${currentPage} of ${totalPages}`;

  document.getElementById("pagination")
    .classList.toggle("hidden", totalPages <= 1);
}

window.changePage = function (dir) {
  const newPage = currentPage + dir;

  if (newPage < 1 || newPage > totalPages) return;

  loadNotes(newPage);
};

// =========================
// BADGES
// =========================
function updateBadge(count) {
  document.getElementById("totalNotesBadge").innerText =
    `${count || 0} total notes`;

  document.getElementById("resultsCount").innerText =
    `${count || 0} notes found`;
}
