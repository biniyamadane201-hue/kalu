let bibleData = [];
let currentBookIndex = 0;
let currentChapterIndex = 0;

// Persistent User Preferences
let favorites = safeReadJSON("amharic_bible_favs", []);
let highlights = safeReadJSON("amharic_bible_highlights", {});
let appSettings = safeReadJSON("amharic_bible_settings", null) || {
  theme: "theme-light",
  font: "'Noto Sans Ethiopic', 'Nyala', sans-serif",
  fontSize: "20px",
  lineHeight: "2.1",
  layout: "layout-verse",
  width: "width-medium",
  accent: "#C6A45C",
  showGeezPunct: true,
  showVerseNums: true,
};

// Migrate the original default blue accent to Qalu gold; preserve other user choices.
if (appSettings.accent === "#58a6ff") appSettings.accent = "#C6A45C";

// Active Selection State for Floating Tooltip
let activeVerseElement = null;
let activeVerseData = null;

// Core DOM
const appContainer = document.getElementById("appContainer");
const colBooks = document.getElementById("colBooks");
const colChapters = document.getElementById("colChapters");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");
const bookListEl = document.getElementById("bookList");
const chapterGridEl = document.getElementById("chapterGrid");
const scriptureContainer = document.getElementById("scriptureContainer");
const scriptureDisplay = document.getElementById("scriptureDisplay");
const activeBookTitle = document.getElementById("activeBookTitle");
const activeChapterBadge = document.getElementById("activeChapterBadge");
const bookSearchInput = document.getElementById("bookSearch");
const scrollProgressBar = document.getElementById("scrollProgressBar");

// Mobile Drawer Controls
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const mobileChapBtn = document.getElementById("mobileChapBtn");
const closeBooksBtn = document.getElementById("closeBooksBtn");
const closeChaptersBtn = document.getElementById("closeChaptersBtn");

// Desktop Tools
const zenToggleBtn = document.getElementById("zenToggleBtn");
const prevChapBtn = document.getElementById("prevChapBtn");
const nextChapBtn = document.getElementById("nextChapBtn");
const openSearchBtn = document.getElementById("openSearchBtn");
const mobileSearchBtn = document.getElementById("mobileSearchBtn");
const openSettingsBtn = document.getElementById("openSettingsBtn");
const viewFavoritesBtn = document.getElementById("viewFavoritesBtn");

// Modals
const searchModal = document.getElementById("searchModal");
const closeSearchBtn = document.getElementById("closeSearchBtn");
const globalSearchInput = document.getElementById("globalSearchInput");
const searchMetaInfo = document.getElementById("searchMetaInfo");
const searchResultsList = document.getElementById("searchResultsList");

const settingsModal = document.getElementById("settingsModal");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const favoritesModal = document.getElementById("favoritesModal");
const closeFavoritesBtn = document.getElementById("closeFavoritesBtn");
const favoritesListEl = document.getElementById("favoritesList");

// Floating Palette Controls
const versePopup = document.getElementById("versePopup");
const copyVerseBtn = document.getElementById("copyVerseBtn");
const clearHlBtn = document.getElementById("clearHlBtn");
const toast = document.getElementById("toastNotification");

// Daily Verse Banner
const dailyVerseCard = document.getElementById("dailyVerseCard");
const dailyRef = document.getElementById("dailyRef");
const dailyText = document.getElementById("dailyText");
const closeDailyBtn = document.getElementById("closeDailyBtn");

// Settings Elements
const fontSelect = document.getElementById("fontSelect");
const fontSizeRange = document.getElementById("fontSizeRange");
const fontSizeVal = document.getElementById("fontSizeVal");
const lineHeightRange = document.getElementById("lineHeightRange");
const lineHeightVal = document.getElementById("lineHeightVal");
const showGeezPunctToggle = document.getElementById("showGeezPunctToggle");
const showVerseNumToggle = document.getElementById("showVerseNumToggle");
const exportDataBtn = document.getElementById("exportDataBtn");
const importDataInput = document.getElementById("importDataInput");
const resetDataBtn = document.getElementById("resetDataBtn");

// Defensive localStorage helpers and reading-position persistence.
function safeReadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn(`Could not read saved setting: ${key}`, error);
    return fallback;
  }
}
function savedChapterIndexValid(book, index) {
  return Array.isArray(book?.chapters) && index < book.chapters.length;
}
function saveReadingPosition() {
  if (
    !bibleData.length ||
    !bibleData[currentBookIndex]?.chapters?.[currentChapterIndex]
  )
    return;
  try {
    localStorage.setItem(
      "amharic_bible_last_read",
      JSON.stringify({
        bookIndex: currentBookIndex,
        chapterIndex: currentChapterIndex,
        book: bibleData[currentBookIndex].title,
        chapter:
          bibleData[currentBookIndex].chapters[currentChapterIndex].chapter,
        savedAt: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.warn("Reading position could not be saved.", error);
  }
}

// 1. Fetch & Initialize
async function loadBible() {
  applyStoredSettings();
  try {
    const res = await fetch("amharic_bible.json");
    if (!res.ok) throw new Error(`HTTP status: ${res.status}`);
    const data = await res.json();

    bibleData = Array.isArray(data.books) ? data.books : [];
    if (!bibleData.length) throw new Error("Bible data contains no books.");
    renderBooks(bibleData);
    const savedPosition = safeReadJSON("amharic_bible_last_read", null);
    const savedBookIndex =
      Number.isInteger(savedPosition?.bookIndex) &&
      savedPosition.bookIndex >= 0 &&
      savedPosition.bookIndex < bibleData.length
        ? savedPosition.bookIndex
        : 0;
    selectBook(savedBookIndex, false);
    const savedChapterIndex =
      Number.isInteger(savedPosition?.chapterIndex) &&
      savedPosition.chapterIndex >= 0 &&
      savedChapterIndexValid(
        bibleData[savedBookIndex],
        savedPosition.chapterIndex,
      )
        ? savedPosition.chapterIndex
        : 0;
    if (savedChapterIndex > 0) {
      currentChapterIndex = savedChapterIndex;
      renderChapters(bibleData[currentBookIndex].chapters);
      renderVerses(bibleData[currentBookIndex].chapters[currentChapterIndex]);
    }
    initDailyVerse();
  } catch (err) {
    scriptureDisplay.innerHTML = `<p style="color:#ff6b6b">መረጃውን መጫን አልተቻለም (Failed to load amharic_bible.json). Live Server መብራቱን ያረጋግጡ።</p>`;
    console.error(err);
  }
}

// 2. Render Left Books
function renderBooks(books) {
  bookListEl.innerHTML = "";
  books.forEach((book, idx) => {
    const li = document.createElement("li");
    li.textContent = book.title;
    li.addEventListener("click", () => {
      selectBook(idx);
      closeDrawers();
    });
    bookListEl.appendChild(li);
  });
}

// 3. Select Book & Populate Chapters
function selectBook(index, shouldSave = true) {
  currentBookIndex = index;
  currentChapterIndex = 0;

  document.querySelectorAll("#bookList li").forEach((li, idx) => {
    li.classList.toggle("active", idx === index);
  });

  const book = bibleData[index];
  activeBookTitle.textContent = book.title;

  renderChapters(book.chapters);
  renderVerses(book.chapters[0]);
  if (shouldSave) saveReadingPosition();
}

// 4. Render Chapters
function renderChapters(chapters) {
  chapterGridEl.innerHTML = "";
  chapters.forEach((chap, idx) => {
    const chip = document.createElement("div");
    chip.className = `chapter-chip ${idx === currentChapterIndex ? "active" : ""}`;
    chip.textContent = chap.chapter;
    chip.addEventListener("click", () => {
      currentChapterIndex = idx;
      document.querySelectorAll(".chapter-chip").forEach((c, i) => {
        c.classList.toggle("active", i === idx);
      });
      renderVerses(chap);
      saveReadingPosition();
      closeDrawers();
    });
    chapterGridEl.appendChild(chip);
  });
}

// 5. Render Scripture Verses
function renderVerses(chapterObj) {
  activeChapterBadge.textContent = `ምዕራፍ ${chapterObj.chapter}`;
  scriptureDisplay.innerHTML = "";
  hideFloatingPalette();

  const bookName = bibleData[currentBookIndex].title;
  const chapNum = chapterObj.chapter;

  chapterObj.verses.forEach((rawText, idx) => {
    if (!rawText || !rawText.trim()) return;
    const verseNum = idx + 1;
    const verseKey = `${bookName}-${chapNum}-${verseNum}`;

    // Apply Punctuation Filter Preference (፡ to space)
    const verseText = appSettings.showGeezPunct
      ? rawText
      : rawText.replace(/፡/g, " ");

    const isFav = favorites.some((f) => f.key === verseKey);
    const hlColor = highlights[verseKey] || "";

    const verseDiv = document.createElement("div");
    verseDiv.className = `verse-item ${verseNum === 1 ? "drop-cap" : ""}`;
    if (hlColor) verseDiv.setAttribute("data-highlight", hlColor);

    verseDiv.innerHTML = `
      <span class="verse-num">${verseNum}</span>
      <span class="verse-text">${verseText}</span>
      <span class="fav-icon ${isFav ? "active" : ""}" title="ወዳጅ አድርግ">${isFav ? "❤️" : "♡"}</span>
    `;

    // Click to Open Floating Palette
    verseDiv.addEventListener("click", (e) => {
      if (e.target.classList.contains("fav-icon")) return;
      showFloatingPalette(verseDiv, {
        key: verseKey,
        book: bookName,
        chapter: chapNum,
        verse: verseNum,
        text: verseText,
      });
    });

    // Toggle Favorite Heart
    const favBtn = verseDiv.querySelector(".fav-icon");
    favBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(verseKey, bookName, chapNum, verseNum, verseText, favBtn);
    });

    scriptureDisplay.appendChild(verseDiv);
  });

  scriptureContainer.scrollTop = 0;
  updateScrollProgress();
  saveReadingPosition();
}

// 6. Floating Action Tooltip
function showFloatingPalette(element, data) {
  activeVerseElement = element;
  activeVerseData = data;

  const rect = element.getBoundingClientRect();
  versePopup.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - 60)}px`;
  versePopup.style.left = `${Math.max(12, Math.min(rect.left + 10, window.innerWidth - 300))}px`;
  versePopup.classList.add("show");
}

function hideFloatingPalette() {
  versePopup.classList.remove("show");
  activeVerseElement = null;
  activeVerseData = null;
}

// 1-Click Copy with Citation
copyVerseBtn.addEventListener("click", () => {
  if (!activeVerseData) return;
  const citation = `“${activeVerseData.text}”\n— ${activeVerseData.book} ${activeVerseData.chapter}:${activeVerseData.verse}`;
  navigator.clipboard.writeText(citation).then(() => {
    showToast("ጥቅሱ ተቀድቷል!");
    hideFloatingPalette();
  });
});

// Color Highlights
document.querySelectorAll(".hl-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!activeVerseElement || !activeVerseData) return;
    const color = btn.dataset.hl;
    activeVerseElement.setAttribute("data-highlight", color);
    highlights[activeVerseData.key] = color;
    localStorage.setItem(
      "amharic_bible_highlights",
      JSON.stringify(highlights),
    );
    hideFloatingPalette();
  });
});

clearHlBtn.addEventListener("click", () => {
  if (!activeVerseElement || !activeVerseData) return;
  activeVerseElement.removeAttribute("data-highlight");
  delete highlights[activeVerseData.key];
  localStorage.setItem("amharic_bible_highlights", JSON.stringify(highlights));
  hideFloatingPalette();
});

// 7. Full-Text Search
globalSearchInput.addEventListener("input", (e) => {
  const query = e.target.value.trim();
  if (query.length < 2) {
    searchMetaInfo.textContent = "ለመፈለግ ቢያንስ 2 ፊደላት ያስገቡ";
    searchResultsList.innerHTML = "";
    return;
  }

  const results = [];
  bibleData.forEach((b) => {
    b.chapters.forEach((c) => {
      c.verses.forEach((vText, vIdx) => {
        if (vText && vText.includes(query)) {
          results.push({
            book: b.title,
            chapter: c.chapter,
            verse: vIdx + 1,
            text: vText,
          });
        }
      });
    });
  });

  searchMetaInfo.textContent = `${results.length} ጥቅሶች ተገኝተዋል`;
  searchResultsList.innerHTML = "";

  const regex = new RegExp(`(${query})`, "gi");

  results.slice(0, 100).forEach((item) => {
    const card = document.createElement("div");
    card.className = "search-hit-card";
    const highlightedText = item.text.replace(regex, "<mark>$1</mark>");
    card.innerHTML = `
      <div class="search-hit-meta">${item.book} ${item.chapter}:${item.verse}</div>
      <div class="search-hit-text">${highlightedText}</div>
    `;
    card.addEventListener("click", () => {
      jumpToScripture(item.book, item.chapter);
      searchModal.classList.remove("open");
    });
    searchResultsList.appendChild(card);
  });
});

function jumpToScripture(bookTitle, chapterNum) {
  const bIdx = bibleData.findIndex((b) => b.title === bookTitle);
  if (bIdx > -1) {
    selectBook(bIdx);
    const cIdx = bibleData[bIdx].chapters.findIndex(
      (c) => String(c.chapter) === String(chapterNum),
    );
    if (cIdx > -1) {
      currentChapterIndex = cIdx;
      renderChapters(bibleData[bIdx].chapters);
      renderVerses(bibleData[bIdx].chapters[cIdx]);
    }
  }
}

// 8. Navigation Stepping
function nextChapter() {
  const book = bibleData[currentBookIndex];
  if (currentChapterIndex < book.chapters.length - 1) {
    currentChapterIndex++;
    renderChapters(book.chapters);
    renderVerses(book.chapters[currentChapterIndex]);
  } else if (currentBookIndex < bibleData.length - 1) {
    selectBook(currentBookIndex + 1);
  }
}

function prevChapter() {
  if (currentChapterIndex > 0) {
    currentChapterIndex--;
    renderChapters(bibleData[currentBookIndex].chapters);
    renderVerses(bibleData[currentBookIndex].chapters[currentChapterIndex]);
  } else if (currentBookIndex > 0) {
    currentBookIndex--;
    const prevBook = bibleData[currentBookIndex];
    selectBook(currentBookIndex);
    currentChapterIndex = prevBook.chapters.length - 1;
    renderChapters(prevBook.chapters);
    renderVerses(prevBook.chapters[currentChapterIndex]);
  }
}

prevChapBtn.addEventListener("click", prevChapter);
nextChapBtn.addEventListener("click", nextChapter);

// Keyboard Shortcuts
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") {
    if (e.key === "Escape") e.target.blur();
    return;
  }
  if (e.key === "ArrowRight") nextChapter();
  if (e.key === "ArrowLeft") prevChapter();
  if (e.key === "/" || (e.ctrlKey && e.key === "f")) {
    e.preventDefault();
    searchModal.classList.add("open");
    globalSearchInput.focus();
  }
  if (e.key.toLowerCase() === "z") {
    appContainer.classList.toggle("zen-mode");
  }
  if (e.key === "Escape") {
    searchModal.classList.remove("open");
    settingsModal.classList.remove("open");
    favoritesModal.classList.remove("open");
    closeDrawers();
    hideFloatingPalette();
  }
});

// 9. Mobile Drawers Management
mobileMenuBtn.addEventListener("click", () => {
  colBooks.classList.add("open");
  colChapters.classList.remove("open");
  sidebarBackdrop.classList.add("active");
});

mobileChapBtn.addEventListener("click", () => {
  colChapters.classList.add("open");
  colBooks.classList.remove("open");
  sidebarBackdrop.classList.add("active");
});

function closeDrawers() {
  colBooks.classList.remove("open");
  colChapters.classList.remove("open");
  sidebarBackdrop.classList.remove("active");
}

closeBooksBtn.addEventListener("click", closeDrawers);
closeChaptersBtn.addEventListener("click", closeDrawers);
sidebarBackdrop.addEventListener("click", closeDrawers);
zenToggleBtn.addEventListener("click", () =>
  appContainer.classList.toggle("zen-mode"),
);

// 10. Scroll Progress Bar
scriptureContainer.addEventListener("scroll", updateScrollProgress);
function updateScrollProgress() {
  const total =
    scriptureContainer.scrollHeight - scriptureContainer.clientHeight;
  const pct = total > 0 ? (scriptureContainer.scrollTop / total) * 100 : 0;
  scrollProgressBar.style.width = `${pct}%`;
}

// 11. Favorites Drawer
function toggleFavorite(key, book, chapter, verse, text, iconEl) {
  const index = favorites.findIndex((f) => f.key === key);
  if (index > -1) {
    favorites.splice(index, 1);
    iconEl.textContent = "♡";
    iconEl.classList.remove("active");
  } else {
    favorites.push({ key, book, chapter, verse, text });
    iconEl.textContent = "❤️";
    iconEl.classList.add("active");
  }
  localStorage.setItem("amharic_bible_favs", JSON.stringify(favorites));
}

viewFavoritesBtn.addEventListener("click", () => {
  favoritesListEl.innerHTML = "";
  if (favorites.length === 0) {
    favoritesListEl.innerHTML = `<p style="color:var(--text-muted);text-align:center;">ምንም የተወደደ ጥቅስ የለም።</p>`;
  } else {
    favorites.forEach((fav) => {
      const card = document.createElement("div");
      card.className = "search-hit-card";
      card.innerHTML = `
        <div class="search-hit-meta">${fav.book} ${fav.chapter}:${fav.verse}</div>
        <div class="search-hit-text">${fav.text}</div>
      `;
      card.addEventListener("click", () => {
        jumpToScripture(fav.book, fav.chapter);
        favoritesModal.classList.remove("open");
      });
      favoritesListEl.appendChild(card);
    });
  }
  favoritesModal.classList.add("open");
});

// 12. Settings Application & Persistence
function saveSettings() {
  localStorage.setItem("amharic_bible_settings", JSON.stringify(appSettings));
}

function applyStoredSettings() {
  // Theme
  document.body.className = appSettings.theme;
  document.querySelectorAll(".theme-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.theme === appSettings.theme);
  });

  // Font
  document.documentElement.style.setProperty("--app-font", appSettings.font);
  fontSelect.value = appSettings.font;

  // Font Size
  document.documentElement.style.setProperty(
    "--font-size",
    appSettings.fontSize,
  );
  fontSizeRange.value = parseInt(appSettings.fontSize);
  fontSizeVal.textContent = appSettings.fontSize;

  // Line Height
  document.documentElement.style.setProperty(
    "--line-height",
    appSettings.lineHeight,
  );
  lineHeightRange.value = appSettings.lineHeight;
  lineHeightVal.textContent = appSettings.lineHeight;

  // Layout & Width
  scriptureDisplay.className = `scripture-pane ${appSettings.width} ${appSettings.layout}`;
  if (!appSettings.showVerseNums)
    scriptureDisplay.classList.add("hide-verse-nums");

  document.querySelectorAll(".layout-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.layout === appSettings.layout);
  });
  document.querySelectorAll(".width-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.width === appSettings.width);
  });

  // Accent Color
  document.documentElement.style.setProperty("--accent", appSettings.accent);
  document.documentElement.style.setProperty(
    "--accent-glow",
    `${appSettings.accent}25`,
  );
  document.querySelectorAll(".color-dot").forEach((d) => {
    d.classList.toggle("active", d.dataset.color === appSettings.accent);
  });

  // Toggles
  showGeezPunctToggle.checked = appSettings.showGeezPunct;
  showVerseNumToggle.checked = appSettings.showVerseNums;
}

// Theme Handlers
document.querySelectorAll(".theme-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    appSettings.theme = btn.dataset.theme;
    saveSettings();
    applyStoredSettings();
  });
});

// Font & Size Handlers
fontSelect.addEventListener("change", (e) => {
  appSettings.font = e.target.value;
  saveSettings();
  applyStoredSettings();
});

fontSizeRange.addEventListener("input", (e) => {
  appSettings.fontSize = `${e.target.value}px`;
  saveSettings();
  applyStoredSettings();
});

lineHeightRange.addEventListener("input", (e) => {
  appSettings.lineHeight = e.target.value;
  saveSettings();
  applyStoredSettings();
});

// Layout Handlers
document.querySelectorAll(".layout-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    appSettings.layout = btn.dataset.layout;
    saveSettings();
    applyStoredSettings();
  });
});

document.querySelectorAll(".width-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    appSettings.width = btn.dataset.width;
    saveSettings();
    applyStoredSettings();
  });
});

// Accent Dots
document.querySelectorAll(".color-dot").forEach((dot) => {
  dot.addEventListener("click", () => {
    appSettings.accent = dot.dataset.color;
    saveSettings();
    applyStoredSettings();
  });
});

// Checkbox Toggles
showGeezPunctToggle.addEventListener("change", (e) => {
  appSettings.showGeezPunct = e.target.checked;
  saveSettings();
  // Refresh current chapter verses with new punctuation rule
  renderVerses(bibleData[currentBookIndex].chapters[currentChapterIndex]);
});

showVerseNumToggle.addEventListener("change", (e) => {
  appSettings.showVerseNums = e.target.checked;
  saveSettings();
  applyStoredSettings();
});

// 13. Backup & Restore Handlers
exportDataBtn.addEventListener("click", () => {
  const bundle = {
    favorites,
    highlights,
    settings: appSettings,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `amharic_bible_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

importDataInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (data.favorites) favorites = data.favorites;
      if (data.highlights) highlights = data.highlights;
      if (data.settings) appSettings = data.settings;

      localStorage.setItem("amharic_bible_favs", JSON.stringify(favorites));
      localStorage.setItem(
        "amharic_bible_highlights",
        JSON.stringify(highlights),
      );
      saveSettings();
      applyStoredSettings();
      renderVerses(bibleData[currentBookIndex].chapters[currentChapterIndex]);
      showToast("መረጃው በትክክል ተመልሷል!");
    } catch (err) {
      alert("የተሳሳተ የፋይል ቅርጽ ነው።");
    }
  };
  reader.readAsText(file);
});

resetDataBtn.addEventListener("click", () => {
  if (confirm("የተወደዱ ጥቅሶችንና ቀለሞችን በሙሉ ማጥፋት ይፈልጋሉ?")) {
    [
      "amharic_bible_favs",
      "amharic_bible_highlights",
      "amharic_bible_settings",
      "amharic_bible_last_read",
    ].forEach((key) => localStorage.removeItem(key));
    favorites = [];
    highlights = {};
    location.reload();
  }
});

// 14. Daily Verse
function initDailyVerse() {
  // Store all Bible verses in one array
  const allVerses = [];

  bibleData.forEach((book) => {
    (book.chapters || []).forEach((chapter) => {
      (chapter.verses || []).forEach((text, index) => {
        if (typeof text === "string" && text.trim() !== "") {
          allVerses.push({
            book: book.title,
            chapter: chapter.chapter,
            verse: index + 1,
            text: text,
          });
        }
      });
    });
  });

  // Check whether verses are available
  if (allVerses.length === 0) {
    dailyVerseCard.hidden = true;
    return;
  }

  // Get the previous verse reference
  const previousVerse = localStorage.getItem("qalu_previous_daily_verse");

  // Select a random verse
  let randomIndex = Math.floor(Math.random() * allVerses.length);

  let selectedVerse = allVerses[randomIndex];

  // Create a unique reference for each verse
  function getVerseKey(verse) {
    return `${verse.book}|${verse.chapter}|${verse.verse}`;
  }

  // Avoid repeating the previous verse
  if (allVerses.length > 1 && getVerseKey(selectedVerse) === previousVerse) {
    randomIndex = (randomIndex + 1) % allVerses.length;

    selectedVerse = allVerses[randomIndex];
  }

  // Save the selected verse
  localStorage.setItem("qalu_previous_daily_verse", getVerseKey(selectedVerse));

  // Display the selected verse
  dailyRef.textContent = `${selectedVerse.book} ${selectedVerse.chapter}:${selectedVerse.verse}`;

  dailyText.textContent = `“${selectedVerse.text}”`;

  // Save reference for navigation
  dailyVerseCard.dataset.reference = `${selectedVerse.book}|${selectedVerse.chapter}|${selectedVerse.verse}`;
}

// Toast Utility
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

// Book search filter
bookSearchInput.addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  const items = bookListEl.querySelectorAll("li");
  items.forEach((item) => {
    item.style.display = item.textContent.toLowerCase().includes(q)
      ? "block"
      : "none";
  });
});

// Modal Triggers
function openSearch() {
  searchModal.classList.add("open");
  globalSearchInput.focus();
}
openSearchBtn.addEventListener("click", openSearch);
mobileSearchBtn.addEventListener("click", openSearch);
closeSearchBtn.addEventListener("click", () =>
  searchModal.classList.remove("open"),
);

openSettingsBtn.addEventListener("click", () =>
  settingsModal.classList.add("open"),
);
closeSettingsBtn.addEventListener("click", () =>
  settingsModal.classList.remove("open"),
);
closeFavoritesBtn.addEventListener("click", () =>
  favoritesModal.classList.remove("open"),
);

// Close palette when clicking away
document.addEventListener("click", (e) => {
  if (!e.target.closest(".verse-item") && !e.target.closest("#versePopup")) {
    hideFloatingPalette();
  }
});

// Boot App
loadBible();

/* About Developer modal */
const aboutDeveloperBtn = document.getElementById("aboutDeveloperBtn");
const aboutDeveloperModal = document.getElementById("aboutDeveloperModal");
const closeAboutDeveloperBtn = document.getElementById(
  "closeAboutDeveloperBtn",
);

if (aboutDeveloperBtn && aboutDeveloperModal && closeAboutDeveloperBtn) {
  const closeAboutDeveloper = () =>
    aboutDeveloperModal.classList.remove("open");
  aboutDeveloperBtn.addEventListener("click", () => {
    aboutDeveloperModal.classList.add("open");
    closeAboutDeveloperBtn.focus();
  });
  closeAboutDeveloperBtn.addEventListener("click", closeAboutDeveloper);
  aboutDeveloperModal.addEventListener("click", (event) => {
    if (event.target === aboutDeveloperModal) closeAboutDeveloper();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAboutDeveloper();
  });
}
