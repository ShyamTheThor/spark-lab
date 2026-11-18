import {mountLabPartner} from "./partner/panel.js";
import {mountPartnerSettings} from "./partner/settings.js";
import {savePartnerPrefs,prefersReducedMotion} from "./partner/preferences.js";
import {mountAccessibleScene} from "./partner/visuals.js";
import "./partner/partner.css";
import "./style.css";
import {
  mountLanguage,
  applyLanguage,
  setLanguage,
  getLanguage,
  languages,
  t,
  tSubject,
  tBoard,
  tClass,
  formatNumber,
} from "./i18n/config.js";
import { mountTranslation } from "./i18n/translation.js";
import { attachCurriculum } from "./curriculum/view.js";
import { getCurriculum } from "./curriculum/data.js";
import {
  grades,
  SCHOOL_STAGES,
  subjectsForGrade,
  filterMappings,
} from "./curriculum/model.js";
import { getStudentPrefs, updateStudentPrefs } from "./curriculum/preferences.js";
import { Viewer } from "./engine/viewer.js";
import { createHeroOrbit } from "./engine/heroOrbit.js";
import {
  MODULES,
  MODULE_IDS,
  SUBJECTS,
  BANDS,
  inBand,
  getModule,
  loadModule,
} from "./modules/index.js";
import { INSTRUMENTS, findInstrument } from "./instruments/catalog.js";
import { SUBJECT_ACCENT } from "./lib/subjectAccent.js";
import { progress } from "./state.js";
import { mountQuiz } from "./learn/quiz.js";
import { mountPresets } from "./learn/presets.js";
import { onAuth, signOutUser, signInGoogle } from "./auth.js";
import { isAdmin, refreshAdmin, firebaseConfigured } from "./firebase.js";
import { setOwner, saveItem, readState, subscribe as subscribeState } from "./features/store.js";
import { escapeHtml } from "./lib/html.js";
import { flushOfflineQueue, loadAssignments } from "./features/classroomStore.js";
import { openAuthModal } from "./authModal.js";
import { registerSW } from "virtual:pwa-register";
import {
  playShutterSound,
  triggerShutterFlash,
  openLabReportModal,
  closeLabReportModal,
  showSnapshotToast,
} from "./features/labReport.js";

// Theme & Accessibility preferences
const THEME_KEY = "sparklab.theme";
const LEGACY_THEME_KEY = "3ducation.theme";
const TEXT_SIZE_KEY = "sparklab.textSize";
const CONTRAST_KEY = "sparklab.contrast";
const THEME_ORDER = ["system", "light", "dark"];
const TEXT_SIZES = ["normal", "large", "xlarge"];

let theme = "system";
let textSize = "normal";
let highContrast = false;
try {
  theme = localStorage.getItem(THEME_KEY) || localStorage.getItem(LEGACY_THEME_KEY) || "system";
  textSize = localStorage.getItem(TEXT_SIZE_KEY) || "normal";
  highContrast = localStorage.getItem(CONTRAST_KEY) === "high";
} catch {
  /* ignore */
}

function applyTheme(tVal) {
  const root = document.documentElement;
  if (tVal === "system") {
    root.removeAttribute("data-theme");
    root.style.colorScheme = "light dark";
  } else {
    root.setAttribute("data-theme", tVal);
    root.style.colorScheme = tVal;
  }
}
function applyA11y() {
  const root = document.documentElement;
  root.setAttribute("data-text-size", textSize);
  if (highContrast) root.setAttribute("data-contrast", "high");
  else root.removeAttribute("data-contrast");
}
applyTheme(theme);
applyA11y();

let offlineReady = false;
let offlineMessageKey = import.meta.env.DEV ? "status.offlineReady" : "status.offlinePreparing";
let cloudMessageKey = firebaseConfigured ? "status.localOnly" : "status.cloudUnavailable";
let cloudRawMessage = "";

const updateSW = registerSW({
  onNeedRefresh() {
    document.getElementById("update-app")?.removeAttribute("hidden");
  },
  immediate: true,
  onOfflineReady() {
    offlineReady = true;
    updateConnection();
  },
  onRegisterError() {
    offlineReady = false;
    updateConnection();
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    setInterval(() => registration.update(), 60_000);
  },
});

const app = document.getElementById("app");

app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="#/" aria-label="SparkLab home">
      <svg class="brand-mark" viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <circle cx="13" cy="13" r="3.6" fill="currentColor"/>
        <ellipse cx="13" cy="13" rx="12" ry="5.2" stroke="currentColor" stroke-width="1.4"/>
        <ellipse cx="13" cy="13" rx="12" ry="5.2" stroke="currentColor" stroke-width="1.4" transform="rotate(60 13 13)"/>
      </svg>
      <span class="brand-word"><span class="d3">Spark</span>Lab</span>
    </a>
    <form class="global-search-form" id="global-search-form" role="search">
      <input type="search" id="global-search-input" data-i18n-placeholder="search.placeholder" data-i18n-aria="search.searchTitle" placeholder="Search chapters, experiments, instruments, formulas…" aria-label="Search">
    </form>
    <div class="topbar-right">
      <nav class="crumbs" id="crumbs" aria-live="polite"></nav>
      <label class="language-control">
        <span data-i18n="settings.language">Language</span>
        <select id="spark-language" aria-label="Language"></select>
      </label>
      <div class="a11y-controls">
        <button class="theme-toggle" id="themeToggle" type="button"></button>
        <button class="a11y-btn" id="textSizeToggle" type="button" title="Text size">A+</button>
        <button class="a11y-btn" id="contrastToggle" type="button" aria-pressed="false" data-i18n="settings.highContrast">High contrast</button>
      </div>
      <div class="auth-area" id="authArea"></div>
    </div>
  </header>

  <nav class="feature-nav" id="primary-nav" aria-label="Student navigation">
    <a href="#/" data-nav="" data-i18n="navigation.home">Home</a>
    <a href="#/curriculum" data-nav="curriculum" data-i18n="navigation.curriculum">My Curriculum</a>
    <a href="#/lab" data-nav="lab" data-i18n="navigation.experiments">Virtual Science Lab</a>
    <a href="#/instruments" data-nav="instruments" data-i18n="navigation.instruments">Scientific Instruments</a>
    <a href="#/formula" data-nav="formula" data-i18n="navigation.formula">Formula Library</a>
    <a href="#/quizzes" data-nav="quizzes" data-i18n="navigation.quizzes">Practice & Quizzes</a>
    <a href="#/dashboard" data-nav="dashboard" data-i18n="navigation.dashboard">My Learning</a>
    <a href="#/teacher" data-nav="teacher" id="teacher-nav-link" class="teacher-nav-link">Teacher Portal</a>
    <a href="#/curriculum-admin" data-nav="curriculum-admin" data-i18n="navigation.admin" id="curriculum-admin-link" hidden>Curriculum Admin</a>
  </nav>
  <div class="connection-bar" role="status" id="connection-status"></div>
  <div class="feature-nav"><button class="btn" id="install-app" hidden data-i18n="status.installSpark">Install Spark</button><button class="btn" id="update-app" hidden data-i18n="status.updateAvailable">Update available</button></div>
  <div id="storage-alert" role="alert" hidden class="storage-alert" data-i18n="status.storageFull">Browser storage is full or disabled.</div>
  <main id="main" class="view" tabindex="-1"></main>

  <footer class="site-foot">
    <p data-i18n="footer.tagline">
      SparkLab — Interactive 3D STEM lab empowering Indian school students across Classes 1–12.
    </p>
    <div class="btn-row">
      <a class="linklike" href="#/community" data-i18n="auth.community">Community</a>
      <a class="linklike" href="#/submit" data-i18n="navigation.contribute">Contribute</a>
      <button class="linklike" id="resetProgress" type="button" data-i18n="footer.resetProgress">Reset progress</button>
    </div>
  </footer>
`;

function updateConnection() {
  const el = document.getElementById("connection-status");
  if (!el) return;
  const online = navigator.onLine;
  el.classList.toggle("is-offline", !online);
  el.classList.toggle("is-online", online);
  const net = online ? `● ${t("status.online")}` : `⚡ ${t("status.offline")} (All 3D Labs & Reports Active)`;
  const off = offlineReady ? t("status.offlineReady") : t(offlineMessageKey);
  const cld = cloudRawMessage || t(cloudMessageKey);
  el.textContent = `${net} · ${off} · ${cld}`;
  if (online) flushOfflineQueue();
}
addEventListener("online", updateConnection);
addEventListener("offline", updateConnection);
addEventListener("spark-sync", (e) => {
  cloudRawMessage = e.detail;
  updateConnection();
});
addEventListener("spark-storage-error", () => {
  document.getElementById("storage-alert").hidden = false;
});
if (navigator.serviceWorker)
  navigator.serviceWorker.ready.then(() => {
    offlineReady = true;
    updateConnection();
  });

let installPrompt;
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  document.getElementById("install-app").hidden = false;
});
document.getElementById("install-app").onclick = async () => {
  if (installPrompt) {
    await installPrompt.prompt();
    installPrompt = null;
    document.getElementById("install-app").hidden = true;
  }
};
document.getElementById("update-app").onclick = () => updateSW(true);

const main = document.getElementById("main");
const crumbs = document.getElementById("crumbs");
const authArea = document.getElementById("authArea");

document.getElementById("global-search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = document.getElementById("global-search-input").value.trim();
  location.hash = q ? `#/search/${encodeURIComponent(q)}` : "#/search";
});

function focusMainAndScrollTop() {
  main.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
  main.querySelector(".notebook")?.scrollTo({ top: 0 });
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0 });
      main.querySelector(".notebook")?.scrollTo({ top: 0 });
    })
  );
}

document.getElementById("resetProgress").addEventListener("click", () => {
  if (confirm(t("dashboard.resetConfirm"))) progress.reset();
});

const themeToggle = document.getElementById("themeToggle");
function syncThemeButton() {
  const icons = { system: "🌗", light: "☀️", dark: "🌙" };
  const keys = { system: "settings.themeAuto", light: "settings.themeLight", dark: "settings.themeDark" };
  themeToggle.textContent = icons[theme];
  const label = t(keys[theme]);
  themeToggle.title = label;
  themeToggle.setAttribute("aria-label", label);
}
const textSizeBtn = document.getElementById("textSizeToggle");
const contrastBtn = document.getElementById("contrastToggle");
function syncA11yButtons() {
  textSizeBtn.textContent = textSize === "normal" ? "A" : textSize === "large" ? "A+" : "A++";
  textSizeBtn.title = `${t("settings.textSize")}: ${textSize}`;
  contrastBtn.setAttribute("aria-pressed", String(highContrast));
}
syncThemeButton();
syncA11yButtons();

subscribeState((s) => {
  const tVal = s.preferences.theme?.value;
  if (THEME_ORDER.includes(tVal) && theme !== tVal) {
    theme = tVal;
    applyTheme(tVal);
    syncThemeButton();
  }
  const langVal = s.preferences.language?.value;
  if (langVal && Object.hasOwn(languages, langVal) && getLanguage() !== langVal) {
    setLanguage(langVal, { persist: false });
  }
});

themeToggle.addEventListener("click", () => {
  theme = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
  applyTheme(theme);
  syncThemeButton();
  try {
    localStorage.setItem(THEME_KEY, theme);
    saveItem("preferences", "theme", { value: theme });
  } catch {
    /* ignore */
  }
});

textSizeBtn.addEventListener("click", () => {
  textSize = TEXT_SIZES[(TEXT_SIZES.indexOf(textSize) + 1) % TEXT_SIZES.length];
  applyA11y();
  syncA11yButtons();
  try {
    localStorage.setItem(TEXT_SIZE_KEY, textSize);
    savePartnerPrefs({textSize});
  } catch {
    /* ignore */
  }
});

contrastBtn.addEventListener("click", () => {
  highContrast = !highContrast;
  applyA11y();
  syncA11yButtons();
  try {
    localStorage.setItem(CONTRAST_KEY, highContrast ? "high" : "normal");
    savePartnerPrefs({highContrast});
  } catch {
    /* ignore */
  }
});

/* ---------------- auth ---------------- */
let currentUser = null;
function initials(user) {
  const src = user.displayName || user.email || "?";
  return src.trim().slice(0, 1).toUpperCase();
}
function renderAuthArea() {
  const communityLink = `<a class="auth-link" href="#/community">${escapeHtml(t("auth.community"))}</a>`;
  if (!currentUser) {
    authArea.innerHTML = `
      ${communityLink}
      <button class="btn btn-google-nav" id="googleSignInBtn" type="button" title="Sign in with Google">
        <svg class="google-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        <span>Google</span>
      </button>
      <button class="btn" id="signInBtn" type="button">${escapeHtml(t("auth.signIn"))}</button>
    `;
    authArea.querySelector("#googleSignInBtn")?.addEventListener("click", async () => {
      const result = await signInGoogle();
      if (result.user) {
        currentUser = result.user;
        renderAuthArea();
      } else if (result.error) {
        requestSignIn();
      }
    });
    authArea.querySelector("#signInBtn").addEventListener("click", () => requestSignIn());
    return;
  }
  const admin = isAdmin(currentUser);
  const avatarHTML = currentUser.photoURL
    ? `<img class="auth-avatar-img" src="${escapeHtml(currentUser.photoURL)}" alt="${escapeHtml(currentUser.displayName || currentUser.email || "")}" referrerpolicy="no-referrer" />`
    : `<span class="auth-avatar" title="${escapeHtml(currentUser.email || "")}">${escapeHtml(initials(currentUser))}</span>`;
  authArea.innerHTML = `
    ${communityLink}
    <a class="auth-link" href="#/submit">${escapeHtml(t("auth.submit"))}</a>
    ${admin ? `<a class="auth-link" href="#/review">${escapeHtml(t("auth.review"))}</a>` : ""}
    ${avatarHTML}
    <button class="btn" id="signOutBtn" type="button">${escapeHtml(t("auth.signOut"))}</button>
  `;
  authArea.querySelector("#signOutBtn").addEventListener("click", () => signOutUser());
}
function requestSignIn(onSignedIn) {
  openAuthModal((user) => {
    currentUser = user;
    renderAuthArea();
    onSignedIn?.(user);
  });
}
let syncModule = null;
async function getSync() {
  if (!syncModule) syncModule = await import("./sync.js");
  return syncModule;
}
renderAuthArea();

let authGeneration = 0;
onAuth(async (user) => {
  const authToken = ++authGeneration;
  syncModule?.detachSync();
  setOwner(user?.uid);
  currentUser = user;
  await refreshAdmin(user);
  if (authToken !== authGeneration) return;
  const preference = readState().preferences.theme?.value;
  if (THEME_ORDER.includes(preference)) {
    theme = preference;
    applyTheme(theme);
    syncThemeButton();
  }
  renderAuthArea();
  if (user) {
    const { attachSync } = await getSync();
    if (authToken !== authGeneration) return;
    attachSync(user.uid);
    const { flushSubmissions } = await import("./submissions.js");
    if (authToken !== authGeneration) return;
    flushSubmissions(user);
  } else if (syncModule) {
    syncModule.detachSync();
  }
  const raw = location.hash.replace(/^#\/?/, "");
  document.getElementById("curriculum-admin-link").hidden = !isAdmin(user);
  if (
    raw === "teacher" ||
    raw === "curriculum-admin" ||
    raw === "submit" ||
    raw === "review" ||
    raw === "dashboard" ||
    raw === "submit/formula"
  )
    route();
});

let navToken = 0;
let featureCleanup = null;
addEventListener("online", async () => {
  if (currentUser) {
    const { flushSubmissions } = await import("./submissions.js");
    flushSubmissions(currentUser);
  }
});
setInterval(async () => {
  if (currentUser && navigator.onLine) {
    const { flushSubmissions } = await import("./submissions.js");
    flushSubmissions(currentUser);
  }
}, 30000);

/* ---------------- shared 3D viewer ---------------- */
let viewer = null;
let canvas = null;
let stageWrap = null;
let active = null;
let lastT = performance.now();
let heroOrbit = null;
function stopHeroOrbit() {
  heroOrbit?.dispose();
  heroOrbit = null;
}

function ensureViewer() {
  if (viewer) return;
  canvas = document.createElement("canvas");
  canvas.id = "stage";
  canvas.tabIndex = 0;
  canvas.setAttribute(
    "aria-label",
    "3D model viewport. Drag or use arrow keys to orbit, +/- to zoom."
  );
  viewer = new Viewer(canvas);
}

function loop(t) {
  const dt = Math.max(0, Math.min(0.05, (t - lastT) / 1000));
  lastT = t;
  if (active && viewer) {
    active.update(prefersReducedMotion() ? 0 : dt, viewer);
    viewer.updateCamera();
    viewer.resize(stageWrap);
    viewer.render(active.scene);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------------- Student-Friendly 11-Step Homepage ---------------- */
let cachedCurriculum = null;

function badgeHTML(moduleId) {
  const p = progress.for(moduleId);
  const mastered = p.quizCount && p.quizBest === p.quizCount;
  return mastered
    ? `<span class="badge is-mastered">${escapeHtml(t("experiments.mastered"))}</span>`
    : p.quizCount
      ? `<span class="badge is-score">${escapeHtml(t("experiments.quizScore"))} ${formatNumber(p.quizBest)}/${formatNumber(p.quizCount)}</span>`
      : p.visited
        ? `<span class="badge is-visited">${escapeHtml(t("experiments.visited"))}</span>`
        : "";
}

function moduleCard(m) {
  return `
    <a class="card" href="#/${m.id}">
      <span class="rivet tl"></span><span class="rivet tr"></span>
      <span class="rivet bl"></span><span class="rivet br"></span>
      <span class="card-icon">${m.icon}</span>
      <span class="tag">${escapeHtml(tSubject(m.subject))} · ${escapeHtml(tClass(m.grades?.[0] || 1))}–${formatNumber(m.grades?.[1] || 12)}</span>
      <h3>${escapeHtml(m.name)} ${badgeHTML(m.id)}</h3>
      <p>${escapeHtml(m.blurb)}</p>
    </a>`;
}

function cleanStepTitle(key, num) {
  const text = t(key);
  const stripped = text.replace(/^[\d০-৯٠-٩०-९१-९౦-౯೦-೯൦-൯௧-௯]+\s*[.:-]\s*/u, "");
  return num ? `${num}. ${stripped}` : stripped;
}

function matchModuleToSubjectAndGrade(m, subj, grade) {
  const [lo, hi] = m.grades || [1, 12];
  if (grade < lo || grade > hi) return false;
  if (!subj) return true;
  if (subj === "Science") return ["Physics", "Chemistry", "Biology"].includes(m.subject);
  if (subj === "Mathematics") return ["Math", "Mathematics"].includes(m.subject);
  if (subj === "Environmental Studies") return ["Biology", "Chemistry", "Physics", "Math"].includes(m.subject);
  if (subj === "Physics") return m.subject === "Physics";
  if (subj === "Chemistry") return m.subject === "Chemistry";
  if (subj === "Biology") return m.subject === "Biology";
  return true;
}

function matchInstrumentToSubject(inst, subj) {
  if (!subj) return true;
  if (subj === "Science") return ["Physics", "Chemistry", "Biology"].includes(inst.subject);
  if (subj === "Mathematics") return inst.subject === "Mathematics";
  if (subj === "Environmental Studies") return true;
  return inst.subject === subj;
}

async function renderHome() {
  active?.onExit?.(viewer);
  active = null;
  if (viewer) viewer.onPick = null;
  crumbs.textContent = t("navigation.home");

  if (!cachedCurriculum) {
    cachedCurriculum = await getCurriculum();
  }
  const data = cachedCurriculum;

  let selectedTopicFilter = "";
  let topicSearchQuery = "";
  let isInitialMount = true;

  function paintHome() {
    const scrollY = window.scrollY;
    const prefs = getStudentPrefs();
    const activeLang = getLanguage();
    const activeBoards = data.boards.filter((b) => b.enabled);
    const upcomingBoards = data.upcomingBoards || [];

    const selectedBoard = activeBoards.some((b) => b.id === prefs.board)
      ? prefs.board
      : activeBoards[0]?.id || "ncert";
    const selectedGrade = grades.includes(Number(prefs.grade)) ? Number(prefs.grade) : 10;
    const allowedSubjects = subjectsForGrade(selectedGrade);
    const selectedSubject = allowedSubjects.includes(prefs.subject)
      ? prefs.subject
      : allowedSubjects[0];

    // Chapters strictly belonging to the selected class, board, and subject
    const classChapters = filterMappings(data.mappings, {
      board: selectedBoard,
      grade: selectedGrade,
      subject: selectedSubject,
    });

    if (
      selectedTopicFilter &&
      !classChapters.some(
        (c) => c.id === selectedTopicFilter || c.topic === selectedTopicFilter
      )
    ) {
      selectedTopicFilter = "";
    }

    let displayedChapters = classChapters;
    if (selectedTopicFilter) {
      displayedChapters = displayedChapters.filter(
        (c) => c.id === selectedTopicFilter || c.topic === selectedTopicFilter
      );
    }
    if (topicSearchQuery.trim()) {
      const q = topicSearchQuery.trim().toLowerCase();
      displayedChapters = displayedChapters.filter(
        (c) =>
          c.chapter.toLowerCase().includes(q) ||
          c.topic.toLowerCase().includes(q) ||
          (c.objective && c.objective.toLowerCase().includes(q))
      );
    }

    const topicModuleIds = [...new Set(displayedChapters.flatMap((c) => c.modules || []))];
    const classModuleIds = [...new Set(classChapters.flatMap((c) => c.modules || []))];

    let recModules = [];
    if (selectedTopicFilter && topicModuleIds.length) {
      recModules = topicModuleIds.map((id) => getModule(id)).filter(Boolean);
    } else {
      const mapped = classModuleIds
        .map((id) => getModule(id))
        .filter((m) => m && matchModuleToSubjectAndGrade(m, selectedSubject, selectedGrade));
      const others = MODULES.filter(
        (m) =>
          !classModuleIds.includes(m.id) &&
          matchModuleToSubjectAndGrade(m, selectedSubject, selectedGrade)
      );
      recModules = [...mapped, ...others].slice(0, 6);
    }

    const chapterInstIds = [...new Set(displayedChapters.flatMap((c) => c.instruments || []))];
    const mappedInsts = chapterInstIds.map((id) => findInstrument(id)).filter(Boolean);
    const otherInsts = INSTRUMENTS.filter(
      (i) => !chapterInstIds.includes(i.id) && matchInstrumentToSubject(i, selectedSubject)
    );
    const recInstruments = (mappedInsts.length ? [...mappedInsts, ...otherInsts] : otherInsts).slice(0, 4);

    const s = progress.summary(MODULE_IDS);
    const recentIds = progress.recent(MODULE_IDS, 4);
    const pct = s.total ? Math.round((s.visited / s.total) * 100) : 0;

    main.innerHTML = `
      <!-- Welcome Hero -->
      <section class="hero-panel">
        <div class="hero hero-main">
          <span class="eyebrow">${escapeHtml(t("home.welcomeEyebrow"))}</span>
          <h1>${escapeHtml(t("home.welcomeTitle"))}</h1>
          <p>${escapeHtml(t("home.welcomeSubtitle"))}</p>
          <div class="btn-row" style="margin-top:16px">
            <a class="btn primary" href="#/curriculum">${escapeHtml(t("home.openCurriculum"))} →</a>
            <a class="btn" href="#/lab">${escapeHtml(t("home.openLab"))}</a>
            <button class="btn" type="button" id="surpriseBtn">🎲 ${escapeHtml(t("home.surpriseMe"))}</button>
          </div>
        </div>
        <aside class="hero-spot">
          <div class="hero-orbit-wrap"><canvas class="hero-orbit-canvas" aria-hidden="true"></canvas></div>
          <h2>${escapeHtml(t("home.guidedMode"))}</h2>
          <p class="fact">${escapeHtml(tClass(selectedGrade))} · ${escapeHtml(tSubject(selectedSubject))} · ${escapeHtml(tBoard(selectedBoard))}</p>
          <p class="eyebrow" style="margin-top:6px; opacity:0.85">${formatNumber(classChapters.length)} ${escapeHtml(t("curriculum.topic"))} · ${formatNumber(recModules.length)} 3D Experiments</p>
          <div class="btn-row" style="margin-top:12px">
            <a class="btn primary" href="#/dashboard">${escapeHtml(t("home.openDashboard"))}</a>
          </div>
        </aside>
      </section>

      <!-- Student Quick Engagement Strip: Daily STEM Spark & Active Class Assignment -->
      <section class="student-engage-strip" aria-label="Featured STEM Challenge and Class Assignment">
        ${(() => {
          const dayIdx = new Date().getDate() % MODULES.length;
          const featured = MODULES[dayIdx] || MODULES[0];
          const topAsg = loadAssignments()[0];
          return `
            <article class="engage-card engage-spark">
              <span class="engage-pill">⚡ Today’s 3D STEM Spark</span>
              <h3>${featured.icon || "🔬"} ${escapeHtml(featured.name)}</h3>
              <p>${escapeHtml(featured.blurb)}</p>
              <a class="btn btn-sm primary" href="#/${escapeHtml(featured.id)}">Try Today’s Lab →</a>
            </article>
            ${topAsg ? `
            <article class="engage-card engage-assign">
              <span class="engage-pill">📚 Class Assignment · Due ${escapeHtml(topAsg.dueDate)}</span>
              <h3>${escapeHtml(topAsg.title)}</h3>
              <p>${escapeHtml(topAsg.instructions)}</p>
              <a class="btn btn-sm" href="#/${escapeHtml(topAsg.moduleId)}">Open Assigned Lab →</a>
            </article>` : ""}
          `;
        })()}
      </section>

      <!-- 1. Select your class (AT THE FIRST) -->
      <section class="home-step" id="step-class">
        <div class="home-step-head">
          <div>
            <h2>${escapeHtml(cleanStepTitle("home.stepClass", 1))}</h2>
            <p>${escapeHtml(t("home.stepClassDesc"))}</p>
          </div>
          <span class="fact">✓ <strong>${escapeHtml(tClass(selectedGrade))}</strong> ${escapeHtml(t("curriculum.verified"))}</span>
        </div>
        ${SCHOOL_STAGES.map(
          (st) => `
          <div class="class-stage-group">
            <p class="class-stage-title">${escapeHtml(t(st.labelKey))}</p>
            <div class="class-pills">
              ${grades
                .filter((g) => g >= st.min && g <= st.max)
                .map(
                  (g) =>
                    `<button type="button" class="class-pill" data-pick-grade="${g}" aria-pressed="${selectedGrade === g}">${escapeHtml(tClass(g))}</button>`
                )
                .join("")}
            </div>
          </div>`
        ).join("")}
      </section>

      <!-- 2. Select your subject -->
      <section class="home-step" id="step-subject">
        <div class="home-step-head">
          <div>
            <h2>${escapeHtml(cleanStepTitle("home.stepSubject", 2))}</h2>
            <p>${escapeHtml(t("home.stepSubjectDesc"))} (${escapeHtml(tClass(selectedGrade))})</p>
          </div>
          <span class="fact"><strong>${escapeHtml(tSubject(selectedSubject))}</strong></span>
        </div>
        <div class="board-grid">
          ${allowedSubjects
            .map((subj) => {
              const accent = SUBJECT_ACCENT[subj === "Mathematics" ? "Math" : subj] || "var(--teal)";
              return `
              <button type="button" class="choice-card" data-pick-subject="${escapeHtml(subj)}" aria-pressed="${selectedSubject === subj}" style="border-left:4px solid ${accent}">
                <strong>${escapeHtml(tSubject(subj))}</strong>
                <span>${escapeHtml(tClass(selectedGrade))}</span>
              </button>`;
            })
            .join("")}
        </div>
      </section>

      <!-- 3. Relevant Topics & Chapters for Class [selectedGrade] -->
      <section class="home-step" id="step-chapters">
        <div class="home-step-head">
          <div>
            <h2>${escapeHtml(cleanStepTitle("home.stepChapters", 3))}</h2>
            <p>${escapeHtml(t("home.stepChaptersDesc"))} (${escapeHtml(tClass(selectedGrade))} · ${escapeHtml(tSubject(selectedSubject))} · ${escapeHtml(tBoard(selectedBoard))})</p>
          </div>
          <span class="fact"><strong>${formatNumber(displayedChapters.length)}</strong> / ${formatNumber(classChapters.length)} ${escapeHtml(t("curriculum.topic"))}</span>
        </div>

        <div class="topic-filter-toolbar">
          <input
            type="search"
            class="topic-search-input"
            id="topicSearchInput"
            placeholder="🔍 Filter topics in ${escapeHtml(tClass(selectedGrade))} ${escapeHtml(tSubject(selectedSubject))}..."
            value="${escapeHtml(topicSearchQuery)}"
            aria-label="Filter topics in ${escapeHtml(tClass(selectedGrade))}"
          />
          <span class="topic-count-badge">${formatNumber(displayedChapters.length)} topics for ${escapeHtml(tClass(selectedGrade))}</span>
        </div>

        <div class="topic-filter-bar" role="toolbar" aria-label="Topics filter">
          <button type="button" class="topic-pill" data-pick-topic="" aria-pressed="${!selectedTopicFilter}">
            <strong>${escapeHtml(t("curriculum.all"))} (${formatNumber(classChapters.length)})</strong>
          </button>
          ${classChapters
            .map((c) => {
              const isPressed = selectedTopicFilter === c.id || selectedTopicFilter === c.topic;
              return `
                <button type="button" class="topic-pill" data-pick-topic="${escapeHtml(c.id)}" aria-pressed="${isPressed}" title="${escapeHtml(c.topic)}">
                  <span>${escapeHtml(c.chapter)}</span>
                </button>`;
            })
            .join("")}
        </div>

        <div class="chapter-list-compact">
          ${
            displayedChapters.length
              ? displayedChapters
                  .map(
                    (c) => `
                <article class="card topic-card">
                  <div class="topic-card-head">
                    <span class="tag">${escapeHtml(tClass(selectedGrade))} · ${escapeHtml(t("curriculum.chapterNum"))} ${formatNumber(c.chapterNumber || c.chapterOrder)}${c.textbookPart ? ` · ${escapeHtml(c.textbookPart)}` : ""}</span>
                    ${c.modules?.length ? `<span class="badge is-visited">${formatNumber(c.modules.length)} 3D</span>` : ""}
                  </div>
                  <h3>${escapeHtml(c.chapter)}</h3>
                  <p class="topic-desc"><strong>${escapeHtml(t("curriculum.topic"))}:</strong> ${escapeHtml(c.topic)}</p>
                  ${c.objective ? `<p class="topic-objective">${escapeHtml(c.objective)}</p>` : ""}
                  <div class="btn-row" style="margin-top:auto; padding-top:10px">
                    <a class="btn primary" href="#/chapter/${escapeHtml(c.id)}">${escapeHtml(t("home.viewChapter"))} →</a>
                  </div>
                </article>`
                  )
                  .join("")
              : `<p class="fact">${escapeHtml(t("curriculum.noResults"))}</p>`
          }
        </div>
        <div class="btn-row" style="margin-top:14px">
          <a class="btn" href="#/curriculum">${escapeHtml(t("home.openCurriculum"))} →</a>
        </div>
      </section>

      <!-- 4. Recommended interactive experiments for Class [selectedGrade] -->
      <section class="home-step" id="step-experiments">
        <div class="home-step-head">
          <div>
            <h2>${escapeHtml(cleanStepTitle("home.stepExperiments", 4))}</h2>
            <p>${escapeHtml(t("home.stepExperimentsDesc"))} (${escapeHtml(tClass(selectedGrade))} · ${escapeHtml(tSubject(selectedSubject))})</p>
          </div>
          <span class="fact"><strong>${formatNumber(recModules.length)}</strong> 3D Labs</span>
        </div>
        <div class="bench">
          ${
            recModules.length
              ? recModules.map(moduleCard).join("")
              : `<p class="fact">${escapeHtml(t("curriculum.noResults"))}</p>`
          }
        </div>
        <div class="btn-row" style="margin-top:14px">
          <a class="btn" href="#/lab">${escapeHtml(t("home.openLab"))} →</a>
        </div>
      </section>

      <!-- 5. Scientific instruments for Class [selectedGrade] -->
      <section class="home-step" id="step-instruments">
        <div class="home-step-head">
          <div>
            <h2>${escapeHtml(cleanStepTitle("home.stepInstruments", 5))}</h2>
            <p>${escapeHtml(t("home.stepInstrumentsDesc"))} (${escapeHtml(tSubject(selectedSubject))})</p>
          </div>
          <span class="fact"><strong>${formatNumber(recInstruments.length)}</strong> ${escapeHtml(t("instruments.interactive3d"))}</span>
        </div>
        <div class="bench">
          ${recInstruments
            .map(
              (i) => `
            <a class="card" href="#/instruments/${escapeHtml(i.id)}">
              <span class="tag">${escapeHtml(tSubject(i.subject))} · ${escapeHtml(tClass(selectedGrade))}</span>
              <h3>${escapeHtml(i.name)}</h3>
              <p>${escapeHtml(i.applications)}</p>
            </a>`
            )
            .join("")}
        </div>
        <div class="btn-row" style="margin-top:14px">
          <a class="btn" href="#/instruments">${escapeHtml(t("home.openInstruments"))} →</a>
        </div>
      </section>

      <!-- 6. Practice quizzes -->
      <section class="home-step" id="step-quizzes">
        <div class="home-step-head">
          <h2>${escapeHtml(cleanStepTitle("home.stepQuizzes", 6))}</h2>
          <p>${escapeHtml(t("home.stepQuizzesDesc"))} (${escapeHtml(tClass(selectedGrade))} · ${escapeHtml(tSubject(selectedSubject))})</p>
        </div>
        <div class="btn-row">
          <a class="btn primary" href="#/quizzes">${escapeHtml(t("home.openQuizzes"))} →</a>
          <a class="btn" href="#/formula">${escapeHtml(t("navigation.formula"))}</a>
        </div>
      </section>

      <!-- 7. Select your education board -->
      <section class="home-step" id="step-board">
        <div class="home-step-head">
          <div>
            <h2>${escapeHtml(cleanStepTitle("home.stepBoard", 7))}</h2>
            <p>${escapeHtml(t("home.stepBoardDesc"))}</p>
          </div>
          <span class="fact"><strong>${escapeHtml(tBoard(selectedBoard))}</strong></span>
        </div>
        <div class="board-grid">
          ${activeBoards
            .map(
              (b) => `
            <button type="button" class="choice-card" data-pick-board="${escapeHtml(b.id)}" aria-pressed="${selectedBoard === b.id}">
              <strong>${escapeHtml(tBoard(b.id, b.name))}</strong>
              <span>✓ ${escapeHtml(t("curriculum.supported"))} · ${escapeHtml(b.academicYear || "2026-27")}</span>
            </button>`
            )
            .join("")}
          ${upcomingBoards
            .map(
              (b) => `
            <button type="button" class="choice-card is-upcoming" disabled title="${escapeHtml(t("curriculum.comingSoon"))}">
              <strong>${escapeHtml(tBoard(b.id, b.name))}</strong>
              <span>${escapeHtml(t("curriculum.comingSoon"))}</span>
            </button>`
            )
            .join("")}
        </div>
      </section>

      <!-- 8. Select your preferred language -->
      <section class="home-step" id="step-language">
        <div class="home-step-head">
          <div>
            <h2>${escapeHtml(cleanStepTitle("home.stepLanguage", 8))}</h2>
            <p>${escapeHtml(t("home.stepLanguageDesc"))}</p>
          </div>
          <span class="fact"><strong>${escapeHtml(languages[activeLang] || activeLang)}</strong></span>
        </div>
        <div class="lang-grid">
          ${Object.entries(languages)
            .map(
              ([code, label]) => `
            <button type="button" class="choice-card" data-pick-lang="${code}" aria-pressed="${activeLang === code}">
              <strong>${escapeHtml(label)}</strong>
              <span>${code.toUpperCase()}</span>
            </button>`
            )
            .join("")}
        </div>
      </section>

      <!-- 9. Continue learning -->
      <section class="home-step" id="step-continue">
        <div class="home-step-head">
          <h2>${escapeHtml(cleanStepTitle("home.stepContinue", 9))}</h2>
          <p>${escapeHtml(t("home.stepContinueDesc"))}</p>
        </div>
        ${
          recentIds.length
            ? `<div class="bench">${recentIds.map((id) => moduleCard(getModule(id))).join("")}</div>`
            : `<p class="fact">${escapeHtml(t("home.stepExperimentsDesc"))}</p>`
        }
      </section>

      <!-- 10. Learning progress -->
      <section class="home-step" id="step-progress">
        <div class="home-step-head">
          <h2>${escapeHtml(cleanStepTitle("home.stepProgress", 10))}</h2>
          <p>${escapeHtml(t("home.stepProgressDesc"))}</p>
        </div>
        <div class="learning-stats">
          <article><b>${formatNumber(s.visited)}</b><span>${escapeHtml(t("dashboard.explored"))}</span></article>
          <article><b>${formatNumber(s.mastered)}</b><span>${escapeHtml(t("dashboard.quizzesTaken"))}</span></article>
          <article><b>${formatNumber(pct)}%</b><span>${escapeHtml(t("home.stepProgress"))}</span></article>
        </div>
        <progress max="${Math.max(1, s.total)}" value="${s.visited}"></progress>
        <a class="btn" href="#/dashboard">${escapeHtml(t("home.openDashboard"))} →</a>
      </section>
    `;

    const orbitCanvas = main.querySelector(".hero-orbit-canvas");
    if (orbitCanvas) {
      try {
        stopHeroOrbit();
        heroOrbit = createHeroOrbit(orbitCanvas);
        heroOrbit.start();
      } catch {
        orbitCanvas.hidden = true;
      }
    }

    const surpriseBtn = main.querySelector("#surpriseBtn");
    if (surpriseBtn) {
      surpriseBtn.onclick = () => {
        const classMods = MODULES.filter((m) => {
          const [lo, hi] = m.grades || [1, 12];
          return selectedGrade >= lo && selectedGrade <= hi;
        });
        const pool = classMods.length ? classMods : MODULES;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        location.hash = `#/${pick.id}`;
      };
    }

    const searchInput = main.querySelector("#topicSearchInput");
    if (searchInput) {
      searchInput.oninput = (e) => {
        topicSearchQuery = e.target.value;
        paintHome();
        const nextInput = main.querySelector("#topicSearchInput");
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
        }
      };
    }

    main.querySelectorAll("[data-pick-topic]").forEach((btn) => {
      btn.onclick = () => {
        const tid = btn.dataset.pickTopic;
        selectedTopicFilter = selectedTopicFilter === tid ? "" : tid;
        paintHome();
      };
    });

    main.querySelectorAll("[data-pick-grade]").forEach((btn) => {
      btn.onclick = () => {
        const g = Number(btn.dataset.pickGrade);
        const validSubj = subjectsForGrade(g);
        const nextSubj = validSubj.includes(selectedSubject) ? selectedSubject : validSubj[0];
        selectedTopicFilter = "";
        topicSearchQuery = "";
        updateStudentPrefs({ grade: g, subject: nextSubj });
        paintHome();
      };
    });

    main.querySelectorAll("[data-pick-subject]").forEach((btn) => {
      btn.onclick = () => {
        selectedTopicFilter = "";
        topicSearchQuery = "";
        updateStudentPrefs({ subject: btn.dataset.pickSubject });
        paintHome();
      };
    });

    main.querySelectorAll("[data-pick-board]").forEach((btn) => {
      btn.onclick = () => {
        selectedTopicFilter = "";
        topicSearchQuery = "";
        updateStudentPrefs({ board: btn.dataset.pickBoard });
        paintHome();
      };
    });

    main.querySelectorAll("[data-pick-lang]").forEach((btn) => {
      btn.onclick = () => setLanguage(btn.dataset.pickLang);
    });

    if (!isInitialMount && scrollY > 0) {
      window.scrollTo({ top: scrollY });
    }
  }

  paintHome();
  isInitialMount = false;
  document.addEventListener("spark-language", paintHome);
  featureCleanup = () => document.removeEventListener("spark-language", paintHome);
  focusMainAndScrollTop();
}

/* ---------------- subject page (legacy link compatibility) ---------------- */
function subjectSlug(name) {
  return name.toLowerCase().replace(/\s+/g, "-");
}
function subjectFromSlug(slug) {
  return SUBJECTS.find((s) => subjectSlug(s) === slug) || null;
}
function renderSubjectPage(subj) {
  active?.onExit?.(viewer);
  active = null;
  if (viewer) viewer.onPick = null;
  crumbs.innerHTML = `<a href="#/">${escapeHtml(t("navigation.home"))}</a> <span aria-hidden="true">/</span> <b>${escapeHtml(tSubject(subj))}</b>`;
  const allItems = MODULES.filter((m) => m.subject === subj);
  const accent = SUBJECT_ACCENT[subj];
  main.innerHTML = `
    <a class="back-btn" href="#/">← ${escapeHtml(t("navigation.home"))}</a>
    <section class="hero subject-hero" style="${accent ? `--accent:${accent}` : ""}">
      <span class="eyebrow">${formatNumber(allItems.length)} · ${escapeHtml(tSubject(subj))}</span>
      <h1>${escapeHtml(tSubject(subj))}</h1>
    </section>
    <div class="bench">${allItems.map(moduleCard).join("")}</div>
  `;
  focusMainAndScrollTop();
}

/* ---------------- video lecture & illustration ---------------- */
function videoBlock(m) {
  if (!m.video) return "";
  const { id, title } = m.video;
  return `
    <details class="lesson video-lesson">
      <summary>Watch: ${escapeHtml(title)}</summary>
      <div class="video-embed">
        <iframe
          src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}"
          title="${escapeHtml(title)}"
          loading="lazy"
          referrerpolicy="strict-origin-when-cross-origin"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
    </details>`;
}

function illustrationHTML(m) {
  if (!m.illustration) return "";
  const { src, alt, caption } = m.illustration;
  if(!Object.values(import.meta.glob("./assets/illustrations/*",{eager:true,query:"?url",import:"default"})).includes(src)) return `<p class="fact">${escapeHtml(alt)} — ${escapeHtml(caption)}</p>`;
  return `
    <figure class="stage-illustration">
      <img src="${src}" alt="${escapeHtml(alt)}" loading="lazy" width="1280" height="720">
      <figcaption>${escapeHtml(caption)}</figcaption>
    </figure>`;
}

/* ---------------- module view (preserves simulation state on language switch!) ---------------- */
async function renderModule(id) {
  const meta = getModule(id);
  if (!meta) return renderHome();
  const myToken = navToken;
  leaveModule();
  crumbs.innerHTML = `<a href="#/">${escapeHtml(t("navigation.home"))}</a> <span aria-hidden="true">/</span> <b>${escapeHtml(meta.name)}</b>`;
  main.innerHTML = `
    <a class="back-btn" href="#/lab">← ${escapeHtml(t("navigation.experiments"))}</a>
    <div class="workbench" aria-busy="true" aria-label="Loading ${escapeHtml(meta.name)}">
      <div class="stage-column"><div class="stage-wrap skeleton-block"></div></div>
      <aside class="notebook">
        <div class="skeleton-line skeleton-line-title"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line"></div>
      </aside>
    </div>
  `;
  try {
    const m = await withTimeout(loadModule(id));
    if (myToken !== navToken) return;
    if (!m) return renderHome();
    renderModuleObject(m);
  } catch {
    if (myToken !== navToken) return;
    chunkLoadError(meta.name);
  }
}

function renderModuleObject(m) {
  active?.onExit?.(viewer);
  try {
    ensureViewer();
  } catch {
    leaveModule();
    progress.markVisited(m.id);
    main.innerHTML = `<a class="back-btn" href="#/lab">← ${escapeHtml(t("navigation.experiments"))}</a><article class="notebook"><h1>${escapeHtml(m.name)}</h1><p role="status">WebGL is unavailable in this browser. You can still read the lesson and take the quiz.</p><div>${m.lesson}</div><div id="fallback-quiz"></div><button class="btn" id="fallback-complete">${escapeHtml(t("experiments.complete"))}</button></article>`;
    const extra = document.createElement("section");
    const translation = document.createElement("div");
    main.querySelector("article").append(translation, extra);
    const lesson = document.createElement("div");
    lesson.innerHTML = m.lesson;
    mountTranslation(translation, lesson.textContent);
    attachCurriculum(extra, m.id);
    mountQuiz(main.querySelector("#fallback-quiz"), m.id, m.quiz);
    main.querySelector("#fallback-complete").onclick = (e) => {
      progress.complete(m.id);
      e.target.textContent = t("experiments.completed");
    };
    const fallbackPanel=document.createElement("div");
    main.querySelector("article").append(fallbackPanel);
    featureCleanup=mountLabPartner({...m,getExperimentState:()=>({status:"3D unavailable; no live simulation values"})},fallbackPanel,main);
    return;
  }

  progress.markVisited(m.id);
  crumbs.innerHTML = `<a href="#/">${escapeHtml(t("navigation.home"))}</a> <span aria-hidden="true">/</span> <a href="#/lab">${escapeHtml(t("navigation.experiments"))}</a> <span aria-hidden="true">/</span> <b>${escapeHtml(m.name)}</b>`;

  const accent = SUBJECT_ACCENT[m.subject];
  const accentStyle = accent ? `style="--accent:${accent}"` : "";
  const related = MODULES.filter((x) => x.subject === m.subject && x.id !== m.id).slice(0, 4);

  main.innerHTML = `
    <a class="back-btn" href="#/lab">← <span data-i18n="navigation.experiments"></span></a>
    <div class="workbench feature-workbench">
      <div class="stage-column">
        <div class="stage-wrap">
          <span class="module-eyebrow" ${accentStyle}>${escapeHtml(m.tag)}</span>
          <div class="stage-tools">
            <button class="stage-tool" id="snapshotBtn" type="button" data-i18n-title="experiments.snapshot" title="Capture 3D Snapshot">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="9" r="2.5" stroke="currentColor" stroke-width="1.6"/><path d="M2.5 5.5A1.5 1.5 0 0 1 4 4h1.5l1-1.5h3l1 1.5H12a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 12V5.5z" stroke="currentColor" stroke-width="1.6"/></svg>
            </button>
            <button class="stage-tool" id="resetView" type="button" data-i18n-title="experiments.resetView">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.46-3.54M13 3v3h-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="stage-tool" id="fsToggle" type="button" data-i18n-title="experiments.fullscreen">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
          <span class="viewport-hint" data-i18n="experiments.orbitHint"></span>
        </div>
        ${illustrationHTML(m)}
      </div>
      <aside class="notebook" ${accentStyle}>
        <span class="eyebrow">${escapeHtml(tSubject(m.subject))}</span>
        <h1>${escapeHtml(m.name)} ${badgeHTML(m.id)}</h1>
        <details class="lesson" open>
          <summary data-i18n="experiments.learn">Learn</summary>
          <div class="lesson-body">${m.lesson}</div>
          <div id="lesson-translation"></div>
        </details>
        <div class="presets notebook-block" id="presets" hidden></div>
        <div class="panel notebook-block" id="panel"></div>
        <div class="quiz-slot notebook-block" id="quiz"></div>
        ${videoBlock(m)}
        <section id="module-curriculum" class="curriculum-detail"></section>
        <div class="notebook-action-row">
          <button class="btn secondary" id="exportReportBtn" type="button" data-i18n="experiments.exportReport">📄 Export Lab Report</button>
          <button class="btn primary" id="mark-completed"></button>
        </div>
      </aside>
    </div>
    ${
      related.length
        ? `<section class="continue-section"><h2 class="continue-heading">${escapeHtml(tSubject(m.subject))}</h2><div class="bench">${related.map(moduleCard).join("")}</div></section>`
        : ""
    }
  `;

  const syncModuleLanguage = () => {
    applyLanguage(main);
    const compBtn = main.querySelector("#mark-completed");
    if (compBtn) {
      compBtn.textContent = progress.for(m.id).completed
        ? t("experiments.completed")
        : t("experiments.complete");
    }
    mountTranslation(
      main.querySelector("#lesson-translation"),
      main.querySelector(".lesson-body").textContent
    );
  };

  syncModuleLanguage();
  attachCurriculum(main.querySelector("#module-curriculum"), m.id);
  document.addEventListener("spark-language", syncModuleLanguage);

  stageWrap = main.querySelector(".stage-wrap");
  stageWrap.insertBefore(canvas, stageWrap.firstChild);

  main.querySelector("#resetView").addEventListener("click", () => {
    viewer.applyView(m.view);
    m.onEnter?.(viewer);
  });
  main.querySelector("#fsToggle").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else
      stageWrap.requestFullscreen?.().then(
        () => viewer.resize(stageWrap),
        () => {}
      );
  });
  main.querySelector("#mark-completed").onclick = (e) => {
    progress.complete(m.id);
    e.target.textContent = t("experiments.completed");
  };

  const handleSnapshot = () => {
    playShutterSound();
    triggerShutterFlash(stageWrap);
    const dataUrl = viewer.takeSnapshot(m.scene);
    showSnapshotToast({
      stageWrap,
      dataUrl,
      module: m,
      onOpenReport: () => handleExportReport(dataUrl),
    });
    return dataUrl;
  };

  const handleExportReport = (snapshotUrl) => {
    playShutterSound();
    triggerShutterFlash(stageWrap);
    const snap = snapshotUrl || viewer.takeSnapshot(m.scene);
    openLabReportModal({
      module: m,
      viewer,
      panel,
      currentUser,
      quizScore: progress.for(m.id).quizScore,
      completed: progress.for(m.id).completed,
      snapshotUrl: snap,
    });
  };

  main.querySelector("#snapshotBtn")?.addEventListener("click", handleSnapshot);
  main.querySelector("#exportReportBtn")?.addEventListener("click", () => handleExportReport());

  const panel = main.querySelector("#panel");
  panel.innerHTML = m.panelHTML();
  m.wire(panel);
  const partnerCleanup = mountLabPartner(m,panel,main);
  const sceneCleanup = mountAccessibleScene(m.scene,stageWrap);

  mountPresets(main.querySelector("#presets"), m.presets, panel);
  const quizCleanup = mountQuiz(main.querySelector("#quiz"), m.id, m.quiz);

  viewer.applyView(m.view);
  viewer.setFlat(!!m.flat);
  m.onEnter?.(viewer);
  active = m;
  viewer.resize(stageWrap);
  featureCleanup = () => {
    closeLabReportModal();
    document.removeEventListener("spark-language", syncModuleLanguage);
    quizCleanup?.();
    partnerCleanup();
    sceneCleanup();
  };
  focusMainAndScrollTop();
}

/* ---------------- static pages & feature routing ---------------- */
function leaveModule() {
  closeLabReportModal();
  active?.onExit?.(viewer);
  active = null;
  if (viewer) viewer.onPick = null;
}

function chunkLoadError(label) {
  leaveModule();
  main.innerHTML = `
    <section class="hero">
      <h1>${escapeHtml(label)} didn't load.</h1>
      <div class="btn-row"><button class="btn primary" id="reloadBtn" type="button">Reload page</button></div>
    </section>`;
  main.querySelector("#reloadBtn").addEventListener("click", () => window.location.reload());
}

function withTimeout(promise, ms = 12000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

async function renderSubmitPage() {
  const myToken = navToken;
  leaveModule();
  crumbs.innerHTML = `<a href="#/">${escapeHtml(t("navigation.home"))}</a> <span aria-hidden="true">/</span> <b>${escapeHtml(t("navigation.contribute"))}</b>`;
  main.innerHTML = `<p class="fact">${escapeHtml(t("experiments.loading"))}</p>`;
  try {
    const { renderSubmit } = await withTimeout(import("./pages/submit.js"));
    if (myToken !== navToken) return;
    await renderSubmit(main, currentUser, () => requestSignIn(() => renderSubmitPage()));
    focusMainAndScrollTop();
  } catch {
    if (myToken !== navToken) return;
    chunkLoadError("The submission form");
  }
}

async function renderReviewPage() {
  const myToken = navToken;
  leaveModule();
  crumbs.innerHTML = `<a href="#/">${escapeHtml(t("navigation.home"))}</a> <span aria-hidden="true">/</span> <b>${escapeHtml(t("auth.review"))}</b>`;
  main.innerHTML = `<p class="fact">${escapeHtml(t("experiments.loading"))}</p>`;
  try {
    const { renderReview } = await withTimeout(import("./pages/review.js"));
    if (myToken !== navToken) return;
    await renderReview(main, currentUser);
    focusMainAndScrollTop();
  } catch {
    if (myToken !== navToken) return;
    chunkLoadError("The review queue");
  }
}

async function renderCommunityListPage() {
  const myToken = navToken;
  leaveModule();
  crumbs.innerHTML = `<a href="#/">${escapeHtml(t("navigation.home"))}</a> <span aria-hidden="true">/</span> <b>${escapeHtml(t("auth.community"))}</b>`;
  main.innerHTML = `<p class="fact">${escapeHtml(t("experiments.loading"))}</p>`;
  try {
    const { renderCommunityList } = await withTimeout(import("./pages/communityList.js"));
    if (myToken !== navToken) return;
    await renderCommunityList(main);
    focusMainAndScrollTop();
  } catch {
    if (myToken !== navToken) return;
    chunkLoadError("The community gallery");
  }
}

async function renderCommunityInstrument(subId) {
  const myToken = navToken;
  leaveModule();
  crumbs.innerHTML = `<a href="#/">${escapeHtml(t("navigation.home"))}</a> <span aria-hidden="true">/</span> <b>${escapeHtml(t("auth.community"))}</b>`;
  main.innerHTML = `<p class="fact">${escapeHtml(t("experiments.loading"))}</p>`;
  try {
    const [{ getSubmission }, { buildCommunityModule }] = await withTimeout(
      Promise.all([import("./submissions.js"), import("./pages/communityModule.js")])
    );
    const sub = await getSubmission(subId);
    if (myToken !== navToken) return;
    if (!sub || (sub.status !== "approved" && !isAdmin(currentUser))) {
      leaveModule();
      main.innerHTML = `<p class="fact">This instrument isn't available.</p>`;
      return;
    }
    if (sub.type === "formula") renderModuleObject(buildCommunityModule(sub));
    else {
      leaveModule();
      const { mountContribution } = await import("./features/community-detail.js");
      if (myToken !== navToken) return;
      featureCleanup = mountContribution(main, sub);
    }
  } catch {
    if (myToken !== navToken) return;
    chunkLoadError("That instrument");
  }
}

const featureLoaders = {
  teacher: () => import("./features/teacher.js"),
  curriculum: () => import("./curriculum/view.js"),
  "curriculum-admin": () => import("./curriculum/admin.js"),
  chapter: async () => {
    const mod = await import("./curriculum/chapterView.js");
    return { mount: mod.mountChapter };
  },
  lab: () => import("./features/lab.js"),
  quizzes: () => import("./features/quizzes.js"),
  search: () => import("./features/search.js"),
  instruments: () => import("./features/instruments.js"),
  formula: () => import("./features/formula.js"),
  dashboard: () => import("./features/dashboard.js"),
  submit: () => import("./features/contribute.js"),
  contributors: () => import("./features/community-detail.js"),
};

async function renderFeature(name, id) {
  const token = navToken;
  leaveModule();
  crumbs.innerHTML = `<a href="#/">${escapeHtml(t("navigation.home"))}</a>`;
  main.innerHTML = `<p class="fact">${escapeHtml(t("experiments.loading"))}</p>`;
  try {
    const feature = await featureLoaders[name]();
    if (token !== navToken) return;
    const container = document.createElement("div");
    main.replaceChildren(container);
    const cleanup = await (name === "contributors" ? feature.mountProfile : feature.mount)(
      container,
      id,
      { user: currentUser, signIn: () => requestSignIn() }
    );
    if (token !== navToken) {
      cleanup?.();
      return;
    }
    featureCleanup = cleanup;
    focusMainAndScrollTop();
  } catch (err) {
    if (token === navToken)
      main.innerHTML = `<p class="fact">${escapeHtml(err.message)}</p><a href="#/">${escapeHtml(t("navigation.home"))}</a>`;
  }
}

function updateActiveNav(section) {
  document.querySelectorAll("#primary-nav a").forEach((a) => {
    const nav = a.dataset.nav;
    const isActive =
      (nav === "" && !section) ||
      (nav && (section === nav || (nav === "curriculum" && section === "chapter")));
    a.classList.toggle("is-active", !!isActive);
    if (isActive) {
      a.scrollIntoView?.({ inline: "nearest", block: "nearest", behavior: "smooth" });
    }
  });
}

function route() {
  const raw = location.hash;
  if (raw && !raw.startsWith("#/")) return;
  navToken++;
  featureCleanup?.();
  featureCleanup = null;
  stopHeroOrbit();
  const id = raw.replace(/^#\/?/, "");
  const [section, ...rest] = id.split("/");
  updateActiveNav(section);
  if (id === "submit/formula") renderSubmitPage();
  else if (featureLoaders[section]) renderFeature(section, rest.join("/"));
  else if (id === "submit") renderSubmitPage();
  else if (id === "review") renderReviewPage();
  else if (id === "community") renderCommunityListPage();
  else if (id.startsWith("community/")) renderCommunityInstrument(id.slice("community/".length));
  else if (id.startsWith("subject/")) {
    const subj = subjectFromSlug(id.slice("subject/".length));
    if (subj) renderSubjectPage(subj);
    else renderHome();
  } else if (id && getModule(id)) renderModule(id);
  else renderHome();
}

document.addEventListener("spark-language", () => {
  updateConnection();
  syncThemeButton();
  syncA11yButtons();
  renderAuthArea();
});

mountLanguage();
window.addEventListener("hashchange", route);
window.addEventListener("resize", () => viewer && stageWrap && viewer.resize(stageWrap));
window.addEventListener("orientationchange", () => {
  setTimeout(() => viewer && stageWrap && viewer.resize(stageWrap), 100);
});
route();

// Shared settings use the existing account-scoped storage/cloud synchronization.
document.addEventListener('spark-accessibility',e=>{textSize=e.detail.textSize;highContrast=e.detail.highContrast;syncA11yButtons();});
mountPartnerSettings();
