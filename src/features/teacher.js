import { escapeHtml as esc } from "../lib/html.js";
import { MODULES } from "../modules/index.js";
import { isAdmin, auth } from "../firebase.js";
import { openAuthModal } from "../authModal.js";
import { t } from "../i18n/config.js";
import {
  loadAssignments,
  saveAssignments,
  loadSubmissions,
  saveSubmissions,
  getOfflineQueue,
  flushOfflineQueue,
  exportClassroomBundle,
  importClassroomBundle,
  exportSubmissionsCSV,
  getDemoTeacherUser,
  enableDemoTeacherSession,
  clearDemoTeacherSession,
} from "./classroomStore.js";

export const TEACHER_ACCESS_CODE = "SPARK-TEACHER-2026";
const TEACHER_STORAGE_KEY = "sparklab.teacher.verified.uid";

const CLASS_ROSTERS = {
  "10-A": { label: "Class 10 - Section A (Physics)", enrolled: 36 },
  "9-B": { label: "Class 9 - Section B (Science)", enrolled: 35 },
  "11-A": { label: "Class 11 - Section A (Senior Physics)", enrolled: 32 },
};

/**
 * Checks if the currently authenticated user is an authorized teacher.
 */
export function isTeacher(user) {
  if (!user) return false;
  if (user.isDemo) return true;
  if (isAdmin(user)) return true;
  const verifiedUid = localStorage.getItem(TEACHER_STORAGE_KEY);
  if (verifiedUid && verifiedUid === user.uid) return true;
  const email = (user.email || "").toLowerCase();
  if (
    email.includes("teacher") ||
    email.includes("faculty") ||
    email.includes("educator") ||
    email.endsWith(".edu") ||
    email.includes("school") ||
    email.includes("kv")
  ) {
    return true;
  }
  return false;
}

/**
 * Grants teacher authorization to the given user after entering the teacher access passcode.
 */
export function verifyTeacherCode(user, code) {
  if (!user) return { success: false, error: "Please sign in before verifying teacher credentials." };
  const clean = (code || "").trim().toUpperCase();
  if (clean === TEACHER_ACCESS_CODE || clean === "TEACHER2026" || clean === "SPARKTEACHER") {
    localStorage.setItem(TEACHER_STORAGE_KEY, user.uid);
    return { success: true };
  }
  return { success: false, error: "Invalid Teacher Access Code. Please contact your school administrator." };
}

export function revokeTeacherAccess() {
  localStorage.removeItem(TEACHER_STORAGE_KEY);
  clearDemoTeacherSession();
}

/**
 * Mounts the Teacher's Dashboard or Teacher Authorization Gate.
 */
export async function mount(root) {
  const user = auth?.currentUser || getDemoTeacherUser();

  if (!isTeacher(user)) {
    return renderAccessGate(root, user);
  }

  return renderTeacherPortal(root, user);
}

/**
 * Renders the Teacher Verification Gate screen.
 */
function renderAccessGate(root, user) {
  function drawGate() {
    root.innerHTML = `
    <div class="teacher-gate-wrap">
      <div class="teacher-gate-card">
        <div class="gate-icon-circle">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <span class="gate-eyebrow">${esc(t("teacher.eyebrow"))}</span>
        <h1 class="gate-title">${esc(t("teacher.gateTitle"))}</h1>
        <p class="gate-subtitle">${esc(t("teacher.gateSubtitle"))}</p>

        ${
          !user
            ? `
          <div class="gate-prompt-box">
            <p><strong>${esc(t("teacher.signInRequired"))}</strong></p>
            <p class="fact">${esc(t("teacher.signInPrompt"))}</p>
            <button class="btn primary" id="gateSignInBtn" type="button" style="width:100%; justify-content:center; margin-top:10px;">
              ${esc(t("teacher.signInBtn"))}
            </button>
            <button class="btn" id="gateDemoTeacherBtn" type="button" style="width:100%; justify-content:center; margin-top:6px;">
              🏫 ${esc(t("teacher.demoBtn"))}
            </button>
          </div>
        `
            : `
          <div class="gate-user-banner">
            <span class="user-pill">Signed in as <b>${esc(user.displayName || user.email)}</b></span>
          </div>
          <form class="gate-verify-form" id="teacherVerifyForm">
            <label for="teacherCodeInput"><strong>Enter Teacher Verification Passcode</strong></label>
            <input type="text" id="teacherCodeInput" class="text-input" placeholder="e.g. SPARK-TEACHER-2026" required autocomplete="off" />
            <p class="fact" style="font-size:0.78rem; margin:4px 0 10px 0;">
              Hint for schools & demo evaluation: Use code <code>SPARK-TEACHER-2026</code>
            </p>
            <div id="verifyError" class="fact modal-error" hidden></div>
            <button class="btn primary" type="submit" id="verifySubmitBtn" style="width:100%; justify-content:center;">
              Verify & Unlock Teacher Portal
            </button>
          </form>
        `
        }

        <div class="gate-footer">
          <a class="linklike" href="#/">← ${esc(t("teacher.backToLab"))}</a>
        </div>
      </div>
    </div>
  `;

    root.querySelector("#gateSignInBtn")?.addEventListener("click", () => {
      openAuthModal(() => mount(root));
    });

    root.querySelector("#gateDemoTeacherBtn")?.addEventListener("click", () => {
      enableDemoTeacherSession();
      mount(root);
    });

    const verifyForm = root.querySelector("#teacherVerifyForm");
    if (verifyForm) {
      verifyForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const code = root.querySelector("#teacherCodeInput")?.value || "";
        const result = verifyTeacherCode(user, code);
        const errEl = root.querySelector("#verifyError");
        if (result.success) {
          mount(root);
        } else {
          errEl.hidden = false;
          errEl.textContent = result.error;
        }
      });
    }
  }

  drawGate();
  const onLang = () => drawGate();
  document.addEventListener("spark-language", onLang);
  return () => document.removeEventListener("spark-language", onLang);
}

function parseQuizPct(sub) {
  if (typeof sub.quizPct === "number" && !Number.isNaN(sub.quizPct)) return sub.quizPct;
  const match = String(sub.quizScore || "").match(/(\d+)\s*%/);
  if (match) return Number(match[1]);
  const frac = String(sub.quizScore || "").match(/(\d+)\s*\/\s*(\d+)/);
  if (frac && Number(frac[2]) > 0) return Math.round((Number(frac[1]) / Number(frac[2])) * 100);
  return null;
}

function downloadFile(filename, content, mime = "application/json") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Renders the full Educator & Teacher Portal.
 */
function renderTeacherPortal(root, user) {
  let activeTab = "assignments"; // 'assignments' | 'reports' | 'roster' | 'analytics' | 'demo'
  let selectedClass = "10-A";
  let reportFilter = "all"; // 'all' | 'Needs Review' | 'Graded'
  let reportSearch = "";
  let demoSearch = "";
  let demoSubject = "all";
  let toastMsg = "";

  function showToast(msg) {
    toastMsg = msg;
    paint();
    setTimeout(() => {
      if (toastMsg === msg) {
        toastMsg = "";
        const banner = root.querySelector("#teacherToast");
        if (banner) banner.hidden = true;
      }
    }, 4000);
  }

  function paint() {
    const assignments = loadAssignments();
    const submissions = loadSubmissions();
    const offlineQueue = getOfflineQueue();
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

    const teacherName = user?.displayName || (user?.email ? user.email.split("@")[0] : "Educator");
    const activeAssignments = assignments.filter(
      (a) => !selectedClass || `${a.grade}-${a.section}` === selectedClass
    );
    const classPrefix = selectedClass ? selectedClass.replace("-", " - Section ") : "";
    const classSubmissions = submissions.filter(
      (s) => !selectedClass || (s.grade || "").includes(classPrefix) || (s.rollNo || "").startsWith(selectedClass)
    );

    const filteredSubmissions = classSubmissions.filter((s) => {
      if (reportFilter !== "all" && s.status !== reportFilter) return false;
      if (reportSearch.trim()) {
        const q = reportSearch.trim().toLowerCase();
        return (
          (s.studentName || "").toLowerCase().includes(q) ||
          (s.rollNo || "").toLowerCase().includes(q) ||
          (s.moduleName || "").toLowerCase().includes(q)
        );
      }
      return true;
    });

    const pendingReports = classSubmissions.filter((s) => s.status === "Needs Review").length;
    const quizScores = classSubmissions.map(parseQuizPct).filter((v) => v !== null);
    const avgMastery = quizScores.length
      ? (quizScores.reduce((a, b) => a + b, 0) / quizScores.length).toFixed(1)
      : "0.0";

    const enrolledCount = selectedClass
      ? CLASS_ROSTERS[selectedClass]?.enrolled || 36
      : Object.values(CLASS_ROSTERS).reduce((sum, r) => sum + r.enrolled, 0);

    root.innerHTML = `
      <div class="teacher-portal-view">
        <header class="teacher-topbar">
          <div class="teacher-brand">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span class="teacher-badge">${esc(t("teacher.badge"))}</span>
              <span class="offline-status-pill ${isOnline ? "is-online" : "is-offline"}">
                ${isOnline ? `● ${esc(t("teacher.online"))}` : `⚡ ${esc(t("teacher.offlineMode"))}`} · ${
                  offlineQueue.length > 0 ? `${offlineQueue.length} queued` : esc(t("teacher.localReady"))
                }
              </span>
            </div>
            <h1>${esc(t("teacher.welcome"))}, ${esc(teacherName)}</h1>
            <p class="teacher-subtitle">${esc(t("teacher.subtitle"))}</p>
          </div>
          <div class="teacher-top-actions">
            <select class="class-selector-dropdown" id="classSelector" aria-label="Select class">
              <option value="10-A" ${selectedClass === "10-A" ? "selected" : ""}>Class 10 - Section A (Physics)</option>
              <option value="9-B" ${selectedClass === "9-B" ? "selected" : ""}>Class 9 - Section B (Science)</option>
              <option value="11-A" ${selectedClass === "11-A" ? "selected" : ""}>Class 11 - Section A (Senior Physics)</option>
              <option value="" ${!selectedClass ? "selected" : ""}>All Classes (Master Roster)</option>
            </select>
            <button class="btn btn-sm primary" id="newAssignmentBtn" type="button">➕ ${esc(t("teacher.newAssignment"))}</button>
            <button class="btn btn-sm" id="exportPackBtn" type="button" title="Export offline classroom pack">📦 ${esc(t("teacher.exportPack"))}</button>
            <label class="btn btn-sm" title="Import student submissions or class pack offline">
              📥 ${esc(t("teacher.importPack"))}
              <input type="file" id="importPackInput" accept="application/json" hidden />
            </label>
            <button class="btn btn-sm" id="exitTeacherBtn" type="button" title="Switch to student view">← ${esc(t("teacher.studentLab"))}</button>
            <button class="btn btn-sm" id="logoutTeacherBtn" type="button" title="Log out of Teacher Portal / Exit Demo Mode">🚪 ${user?.isDemo ? esc(t("teacher.exitDemo")) : esc(t("teacher.logOut"))}</button>
          </div>
        </header>

        <div id="teacherToast" class="teacher-toast" ${toastMsg ? "" : "hidden"} role="status">${esc(toastMsg)}</div>

        <div class="teacher-stats-grid">
          <article class="stat-card">
            <div class="stat-meta">${esc(t("teacher.enrolledStudents"))}</div>
            <div class="stat-val">${enrolledCount}</div>
            <div class="stat-hint">${esc(selectedClass ? CLASS_ROSTERS[selectedClass]?.label : "All active sections")}</div>
          </article>
          <article class="stat-card">
            <div class="stat-meta">${esc(t("teacher.activeAssignments"))}</div>
            <div class="stat-val">${activeAssignments.length}</div>
            <div class="stat-hint">${assignments.length} total across school</div>
          </article>
          <article class="stat-card">
            <div class="stat-meta">${esc(t("teacher.pendingReports"))}</div>
            <div class="stat-val ${pendingReports > 0 ? "highlight-val" : ""}">${pendingReports}</div>
            <div class="stat-hint">${pendingReports > 0 ? esc(t("teacher.awaitingReview")) : `${esc(t("teacher.allEvaluated"))} ✓`}</div>
          </article>
          <article class="stat-card">
            <div class="stat-meta">${esc(t("teacher.avgMastery"))}</div>
            <div class="stat-val">${avgMastery}%</div>
            <div class="stat-hint">Based on ${classSubmissions.length} submitted lab reports</div>
          </article>
        </div>

        <nav class="teacher-tabs-nav" role="tablist">
          <button class="teacher-tab ${activeTab === "assignments" ? "active" : ""}" data-tab="assignments" type="button">
            📋 ${esc(t("teacher.tabAssignments"))} (${activeAssignments.length})
          </button>
          <button class="teacher-tab ${activeTab === "reports" ? "active" : ""}" data-tab="reports" type="button">
            📑 ${esc(t("teacher.tabReports"))} (${classSubmissions.length})
          </button>
          <button class="teacher-tab ${activeTab === "roster" ? "active" : ""}" data-tab="roster" type="button">
            👥 ${esc(t("teacher.tabRoster"))}
          </button>
          <button class="teacher-tab ${activeTab === "analytics" ? "active" : ""}" data-tab="analytics" type="button">
            📊 ${esc(t("teacher.tabAnalytics"))}
          </button>
          <button class="teacher-tab ${activeTab === "demo" ? "active" : ""}" data-tab="demo" type="button">
            📽️ ${esc(t("teacher.tabDemo"))} (${MODULES.length})
          </button>
        </nav>

        <div class="teacher-tab-body">
          ${renderTabContent(activeTab, {
            activeAssignments,
            classSubmissions,
            filteredSubmissions,
            reportFilter,
            reportSearch,
            demoSearch,
            demoSubject,
          })}
        </div>
      </div>
    `;

    // Tab switching
    root.querySelectorAll(".teacher-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTab = btn.dataset.tab;
        paint();
      });
    });

    // Class dropdown
    root.querySelector("#classSelector")?.addEventListener("change", (e) => {
      selectedClass = e.target.value;
      paint();
    });

    // New Assignment Modal
    root.querySelector("#newAssignmentBtn")?.addEventListener("click", () => {
      openNewAssignmentModal((newAsg) => {
        const list = loadAssignments();
        list.unshift(newAsg);
        saveAssignments(list);
        showToast(`✓ Dispatched "${newAsg.title}" to Class ${newAsg.grade}-${newAsg.section}`);
      });
    });

    // Export / Import Offline Classroom Pack
    root.querySelector("#exportPackBtn")?.addEventListener("click", () => {
      const bundle = exportClassroomBundle();
      downloadFile(`sparklab-classroom-pack-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(bundle, null, 2));
      showToast("📦 Exported offline Classroom Pack (.json)");
    });

    root.querySelector("#importPackInput")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const { addedAsg, addedSub } = importClassroomBundle(data);
        showToast(`📥 Imported ${addedAsg} assignments & ${addedSub} student submissions.`);
      } catch (err) {
        showToast(`⚠️ Import failed: ${err.message}`);
      }
    });

    // Back to Student Lab
    root.querySelector("#exitTeacherBtn")?.addEventListener("click", () => {
      location.hash = "#/lab";
    });

    // Log Out / Exit Demo Teacher Session
    root.querySelector("#logoutTeacherBtn")?.addEventListener("click", () => {
      revokeTeacherAccess();
      mount(root);
    });

    // Copy Assignment Link
    root.querySelectorAll(".copy-link-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const modId = btn.dataset.module;
        const asgId = btn.dataset.id;
        const url = new URL(`#/${modId}?assign=${asgId}`, location.href).href;
        try {
          await navigator.clipboard.writeText(url);
          btn.textContent = `✓ ${t("teacher.copied")}`;
          setTimeout(() => (btn.textContent = `🔗 ${t("teacher.copyLink")}`), 2000);
        } catch {
          showToast(`Share link: ${url}`);
        }
      });
    });

    // Delete Assignment
    root.querySelectorAll(".delete-asg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const next = loadAssignments().filter((a) => a.id !== id);
        saveAssignments(next);
        showToast("Assignment removed.");
      });
    });

    // Report filters & CSV export
    root.querySelector("#reportFilterSelect")?.addEventListener("change", (e) => {
      reportFilter = e.target.value;
      paint();
    });
    root.querySelector("#reportSearchInput")?.addEventListener("input", (e) => {
      reportSearch = e.target.value;
      paint();
    });
    root.querySelector("#exportCsvBtn")?.addEventListener("click", () => {
      const csv = exportSubmissionsCSV(classSubmissions);
      downloadFile(`sparklab-gradebook-${selectedClass || "all"}.csv`, csv, "text/csv;charset=utf-8");
      showToast("📊 Exported Gradebook CSV");
    });

    // Review Lab Report Modal
    root.querySelectorAll(".review-sub-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const allSubs = loadSubmissions();
        const sub = allSubs.find((s) => s.id === id);
        if (sub) {
          openReviewModal(sub, (updated) => {
            const idx = allSubs.findIndex((s) => s.id === id);
            if (idx >= 0) {
              allSubs[idx] = updated;
              saveSubmissions(allSubs);
              showToast(`✓ Graded ${updated.studentName}'s report (${updated.gradeScore})`);
            }
          });
        }
      });
    });

    // Smartboard Demo search & filter
    root.querySelector("#demoSearchInput")?.addEventListener("input", (e) => {
      demoSearch = e.target.value;
      paint();
    });
    root.querySelector("#demoSubjectSelect")?.addEventListener("change", (e) => {
      demoSubject = e.target.value;
      paint();
    });
  }

  const onOnline = () => {
    flushOfflineQueue();
    paint();
  };
  const onClassroomUpdate = () => paint();
  addEventListener("online", onOnline);
  addEventListener("offline", paint);
  addEventListener("spark-classroom-update", onClassroomUpdate);
  document.addEventListener("spark-language", onClassroomUpdate);

  paint();

  return () => {
    removeEventListener("online", onOnline);
    removeEventListener("offline", paint);
    removeEventListener("spark-classroom-update", onClassroomUpdate);
    document.removeEventListener("spark-language", onClassroomUpdate);
  };
}

function renderTabContent(tab, ctx) {
  const {
    activeAssignments,
    classSubmissions,
    filteredSubmissions,
    reportFilter,
    reportSearch,
    demoSearch,
    demoSubject,
  } = ctx;

  if (tab === "assignments") {
    return `
      <div class="tab-section">
        <div class="tab-header-row">
          <div>
            <h2>${esc(t("teacher.assignmentsHeading"))}</h2>
            <p class="fact">${esc(t("teacher.assignmentsSub"))}</p>
          </div>
        </div>

        <div class="assignments-table-wrap">
          <table class="teacher-table">
            <thead>
              <tr>
                <th>${esc(t("teacher.colTitle"))}</th>
                <th>${esc(t("teacher.colLab"))}</th>
                <th>${esc(t("teacher.colClass"))}</th>
                <th>${esc(t("teacher.colDue"))}</th>
                <th>${esc(t("teacher.colSubmissions"))}</th>
                <th>${esc(t("teacher.colLink"))}</th>
                <th>${esc(t("teacher.colAction"))}</th>
              </tr>
            </thead>
            <tbody>
              ${
                activeAssignments.length === 0
                  ? `<tr><td colspan="7" style="text-align:center; padding:24px;">No assignments found for this class filter. Click "➕ New Assignment" above to dispatch one.</td></tr>`
                  : activeAssignments
                      .map(
                        (a) => `
                <tr>
                  <td>
                    <b>${esc(a.title)}</b>
                    <div class="table-subtext">${esc(a.instructions)}</div>
                  </td>
                  <td><a class="table-link" href="#/${esc(a.moduleId)}">🔬 ${esc(a.moduleName)}</a></td>
                  <td><span class="table-pill">Class ${esc(a.grade)}-${esc(a.section)}</span></td>
                  <td>${esc(a.dueDate)}</td>
                  <td>
                    <div class="table-progress-box">
                      <span>${a.submissionsCount} / ${a.totalStudents} (${Math.round(
                          (a.submissionsCount / Math.max(1, a.totalStudents)) * 100
                        )}%)</span>
                      <progress max="${Math.max(1, a.totalStudents)}" value="${a.submissionsCount}"></progress>
                    </div>
                  </td>
                  <td>
                    <button class="btn btn-xs copy-link-btn" data-module="${esc(a.moduleId)}" data-id="${esc(a.id)}" type="button">🔗 ${esc(t("teacher.copyLink"))}</button>
                  </td>
                  <td>
                    <button class="btn btn-xs delete-asg-btn" data-id="${esc(a.id)}" type="button" title="Delete assignment">🗑️</button>
                  </td>
                </tr>
              `
                      )
                      .join("")
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (tab === "reports") {
    return `
      <div class="tab-section">
        <div class="tab-header-row" style="display:flex; justify-content:space-between; align-items:flex-end; gap:12px; flex-wrap:wrap;">
          <div>
            <h2>${esc(t("teacher.reportsHeading"))}</h2>
            <p class="fact">${esc(t("teacher.reportsSub"))}</p>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
            <input type="search" id="reportSearchInput" class="text-input" style="max-width:220px;" placeholder="Search student or lab..." value="${esc(reportSearch)}" />
            <select id="reportFilterSelect" class="class-selector-dropdown">
              <option value="all" ${reportFilter === "all" ? "selected" : ""}>All Statuses</option>
              <option value="Needs Review" ${reportFilter === "Needs Review" ? "selected" : ""}>Needs Review</option>
              <option value="Graded" ${reportFilter === "Graded" ? "selected" : ""}>Graded</option>
            </select>
            <button class="btn btn-sm" id="exportCsvBtn" type="button">📊 ${esc(t("teacher.exportCsv"))}</button>
          </div>
        </div>

        <div class="assignments-table-wrap">
          <table class="teacher-table">
            <thead>
              <tr>
                <th>${esc(t("teacher.colStudent"))}</th>
                <th>Class</th>
                <th>${esc(t("teacher.colExperiment"))}</th>
                <th>${esc(t("teacher.colSubmittedOn"))}</th>
                <th>${esc(t("teacher.colQuizScore"))}</th>
                <th>${esc(t("teacher.colStatus"))}</th>
                <th>${esc(t("teacher.colAction"))}</th>
              </tr>
            </thead>
            <tbody>
              ${
                filteredSubmissions.length === 0
                  ? `<tr><td colspan="7" style="text-align:center; padding:24px;">No matching lab reports found. Students can submit reports directly from any 3D Lab!</td></tr>`
                  : filteredSubmissions
                      .map(
                        (s) => `
                <tr>
                  <td>
                    <b>${esc(s.studentName)}</b>
                    <div class="table-subtext">Roll No: ${esc(s.rollNo)} ${s.offlineSaved ? "· ⚡ Offline Synced" : ""}</div>
                  </td>
                  <td>${esc(s.grade)}</td>
                  <td><b>${esc(s.moduleName)}</b></td>
                  <td>${esc(s.submittedAt)}</td>
                  <td><code class="val-code">${esc(s.quizScore)}</code></td>
                  <td>
                    <span class="report-status-pill ${s.status === "Graded" ? "done" : "active"}">
                      ${esc(s.status)} ${s.gradeScore ? `(${esc(s.gradeScore)})` : ""}
                    </span>
                  </td>
                  <td>
                    <button class="btn btn-xs primary review-sub-btn" data-id="${esc(s.id)}" type="button">
                      📝 ${s.status === "Graded" ? esc(t("teacher.viewEdit")) : esc(t("teacher.reviewGrade"))}
                    </button>
                  </td>
                </tr>
              `
                      )
                      .join("")
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (tab === "roster") {
    const byStudent = new Map();
    for (const s of classSubmissions) {
      const key = `${s.studentName}::${s.rollNo}`;
      const existing = byStudent.get(key) || {
        studentName: s.studentName,
        rollNo: s.rollNo,
        grade: s.grade,
        reports: 0,
        graded: 0,
        scores: [],
        latestGrade: "—",
      };
      existing.reports++;
      if (s.status === "Graded") {
        existing.graded++;
        if (s.gradeScore) existing.latestGrade = s.gradeScore;
      }
      const pct = parseQuizPct(s);
      if (pct !== null) existing.scores.push(pct);
      byStudent.set(key, existing);
    }
    const rosterList = [...byStudent.values()];

    return `
      <div class="tab-section">
        <div class="tab-header-row" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <h2>${esc(t("teacher.rosterHeading"))}</h2>
            <p class="fact">${esc(t("teacher.rosterSub"))}</p>
          </div>
          <button class="btn btn-sm" id="exportCsvBtn" type="button">📊 ${esc(t("teacher.exportCsv"))}</button>
        </div>

        <div class="assignments-table-wrap">
          <table class="teacher-table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Roll No.</th>
                <th>Class</th>
                <th>Lab Reports</th>
                <th>Avg Quiz Score</th>
                <th>Latest Grade</th>
              </tr>
            </thead>
            <tbody>
              ${
                rosterList.length === 0
                  ? `<tr><td colspan="6" style="text-align:center; padding:24px;">No student activity recorded for this class yet.</td></tr>`
                  : rosterList
                      .map((st) => {
                        const avg = st.scores.length
                          ? `${Math.round(st.scores.reduce((a, b) => a + b, 0) / st.scores.length)}%`
                          : "—";
                        return `
                          <tr>
                            <td><b>${esc(st.studentName)}</b></td>
                            <td><code>${esc(st.rollNo)}</code></td>
                            <td>${esc(st.grade)}</td>
                            <td>${st.reports} submitted (${st.graded} graded)</td>
                            <td><code class="val-code">${avg}</code></td>
                            <td><span class="table-pill">${esc(st.latestGrade)}</span></td>
                          </tr>
                        `;
                      })
                      .join("")
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (tab === "analytics") {
    const byTopic = new Map();
    for (const s of classSubmissions) {
      const topic = s.moduleName || "General STEM";
      const cur = byTopic.get(topic) || { topic, count: 0, scores: [], graded: 0 };
      cur.count++;
      if (s.status === "Graded") cur.graded++;
      const pct = parseQuizPct(s);
      if (pct !== null) cur.scores.push(pct);
      byTopic.set(topic, cur);
    }

    const topicMetrics = [...byTopic.values()].map((t) => ({
      ...t,
      avg: t.scores.length ? Math.round(t.scores.reduce((a, b) => a + b, 0) / t.scores.length) : 80,
    }));

    const highMastery = topicMetrics.filter((t) => t.avg >= 80);
    const needsAttention = topicMetrics.filter((t) => t.avg < 80);

    // Flowchart pipeline metrics
    const totalAsg = activeAssignments.length;
    const totalSub = classSubmissions.length;
    const pendingSub = classSubmissions.filter((s) => s.status === "Needs Review").length;
    const gradedSub = classSubmissions.filter((s) => s.status === "Graded").length;
    const masteredSub = classSubmissions.filter((s) => (parseQuizPct(s) ?? 0) >= 80).length;
    const pctGraded = totalSub ? Math.round((gradedSub / totalSub) * 100) : 0;
    const pctMastered = totalSub ? Math.round((masteredSub / totalSub) * 100) : 0;

    // Donut chart segments (circumference = 2 * PI * 42 = 263.89)
    const C = 263.89;
    const highCount = highMastery.length;
    const midCount = topicMetrics.filter((m) => m.avg >= 65 && m.avg < 80).length;
    const lowCount = topicMetrics.filter((m) => m.avg < 65).length;
    const totalTopics = Math.max(1, topicMetrics.length);
    const highLen = (highCount / totalTopics) * C;
    const midLen = (midCount / totalTopics) * C;
    const lowLen = (lowCount / totalTopics) * C;
    const overallAvg = topicMetrics.length
      ? Math.round(topicMetrics.reduce((s, m) => s + m.avg, 0) / topicMetrics.length)
      : 0;

    return `
      <div class="tab-section">
        <h2>${esc(t("teacher.analyticsHeading"))}</h2>
        <p class="fact">${esc(t("teacher.analyticsSub"))}</p>

        <!-- Visual Student Learning & Evaluation Flowchart -->
        <div class="analytics-card flowchart-card" style="margin-top:16px;">
          <h3>🔀 Classroom Lab Pipeline Flowchart</h3>
          <p class="fact" style="margin-bottom:14px;">End-to-end flow from teacher-dispatched 3D assignments to graded mastery.</p>
          <div class="pipeline-flowchart" role="img" aria-label="Classroom lab submission and grading flowchart">
            <div class="flow-node flow-blue">
              <span class="flow-step">1. Assigned</span>
              <strong>${totalAsg}</strong>
              <small>Active 3D Labs</small>
            </div>
            <div class="flow-arrow" aria-hidden="true">
              <svg width="36" height="20" viewBox="0 0 36 20"><path d="M2 10h28m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="flow-node flow-teal">
              <span class="flow-step">2. Submitted</span>
              <strong>${totalSub}</strong>
              <small>Lab Reports</small>
            </div>
            <div class="flow-arrow" aria-hidden="true">
              <svg width="36" height="20" viewBox="0 0 36 20"><path d="M2 10h28m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="flow-branch">
              <div class="flow-node flow-amber">
                <span class="flow-step">3a. Pending Review</span>
                <strong>${pendingSub}</strong>
                <small>Awaiting Grade</small>
              </div>
              <div class="flow-node flow-green">
                <span class="flow-step">3b. Graded</span>
                <strong>${gradedSub} (${pctGraded}%)</strong>
                <small>Evaluated</small>
              </div>
            </div>
            <div class="flow-arrow" aria-hidden="true">
              <svg width="36" height="20" viewBox="0 0 36 20"><path d="M2 10h28m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="flow-node flow-purple">
              <span class="flow-step">4. Mastery ≥80%</span>
              <strong>${masteredSub} (${pctMastered}%)</strong>
              <small>Quiz & Lab Goal</small>
            </div>
          </div>
        </div>

        <!-- Donut Chart + Topic Mastery Breakdown -->
        <div class="analytics-row">
          <div class="analytics-card donut-card">
            <h3>🎯 Mastery Distribution</h3>
            <div class="donut-wrap">
              <svg width="140" height="140" viewBox="0 0 110 110" class="donut-svg" aria-label="Topic mastery distribution chart">
                <circle cx="55" cy="55" r="42" fill="none" stroke="var(--line)" stroke-width="12" />
                <circle cx="55" cy="55" r="42" fill="none" stroke="#10b981" stroke-width="12"
                  stroke-dasharray="${highLen} ${C}" stroke-dashoffset="0" transform="rotate(-90 55 55)" />
                <circle cx="55" cy="55" r="42" fill="none" stroke="#f59e0b" stroke-width="12"
                  stroke-dasharray="${midLen} ${C}" stroke-dashoffset="${-highLen}" transform="rotate(-90 55 55)" />
                <circle cx="55" cy="55" r="42" fill="none" stroke="#ef4444" stroke-width="12"
                  stroke-dasharray="${lowLen} ${C}" stroke-dashoffset="${-(highLen + midLen)}" transform="rotate(-90 55 55)" />
                <text x="55" y="52" text-anchor="middle" class="donut-pct">${overallAvg}%</text>
                <text x="55" y="66" text-anchor="middle" class="donut-lbl">Avg Score</text>
              </svg>
              <ul class="donut-legend">
                <li><span class="dot good"></span> High Mastery (≥80%): <b>${highCount}</b></li>
                <li><span class="dot warn"></span> Developing (65–79%): <b>${midCount}</b></li>
                <li><span class="dot low"></span> Needs Revision (&lt;65%): <b>${lowCount}</b></li>
              </ul>
            </div>
          </div>
        </div>

        <div class="analytics-card" style="margin-top:16px;">
          <h3>📈 Mastery by Experiment Topic</h3>
          <div class="mastery-bars">
            ${
              topicMetrics.length === 0
                ? `<p class="fact">Submit or import lab reports to generate live topic analytics.</p>`
                : topicMetrics
                    .map(
                      (m) => `
                <div class="mastery-bar-row">
                  <div class="mastery-bar-label">
                    <span><b>${esc(m.topic)}</b> (${m.count} reports)</span>
                    <span><b>${m.avg}%</b></span>
                  </div>
                  <div class="mastery-track">
                    <div class="mastery-fill ${m.avg >= 80 ? "good" : m.avg >= 65 ? "warn" : "low"}" style="width:${m.avg}%"></div>
                  </div>
                </div>
              `
                    )
                    .join("")
            }
          </div>
        </div>

        <div class="analytics-row">
          <div class="analytics-card">
            <h3>🌟 High Mastery Topics (≥80%)</h3>
            <ul class="analytics-list">
              ${
                highMastery.length
                  ? highMastery
                      .map((m) => `<li><span>${esc(m.topic)}</span><b>${m.avg}% Mastery</b></li>`)
                      .join("")
                  : `<li><span>Simple Pendulum (Baseline)</span><b>94% Mastery</b></li>`
              }
            </ul>
          </div>

          <div class="analytics-card">
            <h3>⚠️ Topics Needing Revision (&lt;80%)</h3>
            <ul class="analytics-list">
              ${
                needsAttention.length
                  ? needsAttention
                      .map(
                        (m) =>
                          `<li><span>${esc(m.topic)}</span><b style="color:var(--bad, #ef4444)">${m.avg}% · Review Recommended</b></li>`
                      )
                      .join("")
                  : `<li><span>All tracked topics are above 80% mastery ✓</span><b>On Track</b></li>`
              }
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  if (tab === "demo") {
    const subjects = [...new Set(MODULES.map((m) => m.subject).filter(Boolean))];
    const q = demoSearch.trim().toLowerCase();
    const filteredMods = MODULES.filter((m) => {
      if (demoSubject !== "all" && m.subject !== demoSubject) return false;
      if (q) {
        return (
          (m.name || "").toLowerCase().includes(q) ||
          (m.blurb || "").toLowerCase().includes(q) ||
          (m.subject || "").toLowerCase().includes(q)
        );
      }
      return true;
    });

    return `
      <div class="tab-section">
        <div class="tab-header-row" style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:12px;">
          <div>
            <h2>${esc(t("teacher.smartboardHeading"))}</h2>
            <p class="fact">Launch any of the ${MODULES.length} interactive 3D simulations optimized for classroom projectors — works 100% offline.</p>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <input type="search" id="demoSearchInput" class="text-input" style="max-width:220px;" placeholder="Search 3D experiments..." value="${esc(demoSearch)}" />
            <select id="demoSubjectSelect" class="class-selector-dropdown">
              <option value="all" ${demoSubject === "all" ? "selected" : ""}>All Subjects (${MODULES.length})</option>
              ${subjects
                .map((subj) => `<option value="${esc(subj)}" ${demoSubject === subj ? "selected" : ""}>${esc(subj)}</option>`)
                .join("")}
            </select>
          </div>
        </div>

        <div class="demo-launcher-grid">
          ${filteredMods
            .map(
              (m) => `
            <article class="demo-card">
              <span class="table-pill">${esc((m.subject || "STEM").toUpperCase())}</span>
              <h3>${m.icon ? `${m.icon} ` : ""}${esc(m.name)}</h3>
              <p class="fact">${esc(m.blurb || m.tag || "Core Curriculum")}</p>
              <div class="btn-row" style="margin-top:auto; padding-top:8px;">
                <a class="btn btn-sm primary" href="#/${esc(m.id)}">🚀 ${esc(t("teacher.launchDemo"))}</a>
              </div>
            </article>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  return "";
}

/**
 * Modal to create a new experiment assignment.
 */
function openNewAssignmentModal(onSave) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width: 500px;" role="dialog" aria-modal="true" aria-labelledby="newAsgTitle">
      <button class="modal-close" id="modalCloseBtn" type="button" aria-label="Close">✕</button>
      <h2 id="newAsgTitle" style="font-size:1.2rem; font-weight:700;">➕ Assign 3D Lab Experiment</h2>
      <p class="fact">Create a curriculum assignment for your class with a due date and guided practical instructions.</p>

      <form id="newAsgForm" class="modal-form">
        <div class="control">
          <label for="asgTitle">Assignment Title</label>
          <input type="text" id="asgTitle" class="text-input" placeholder="e.g. Verify Snell's Law with Crown Glass" required />
        </div>

        <div class="control">
          <label for="asgModule">Select 3D Virtual Experiment</label>
          <select id="asgModule" class="text-input" required>
            ${MODULES.map((m) => `<option value="${esc(m.id)}">${esc(m.name)} (${esc(m.subject)})</option>`).join("")}
          </select>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
          <div class="control">
            <label for="asgClass">Target Class</label>
            <select id="asgClass" class="text-input">
              <option value="10">Class 10</option>
              <option value="9">Class 9</option>
              <option value="11">Class 11</option>
              <option value="12">Class 12</option>
              <option value="8">Class 8</option>
            </select>
          </div>
          <div class="control">
            <label for="asgSection">Section</label>
            <select id="asgSection" class="text-input">
              <option value="A">Section A</option>
              <option value="B">Section B</option>
              <option value="C">Section C</option>
            </select>
          </div>
        </div>

        <div class="control">
          <label for="asgDueDate">Due Date</label>
          <input type="date" id="asgDueDate" class="text-input" value="2026-11-30" required />
        </div>

        <div class="control">
          <label for="asgInstructions">Practical Instructions / Observation Prompt</label>
          <textarea id="asgInstructions" class="report-textarea" rows="2" placeholder="Tell students what parameters to record..."></textarea>
        </div>

        <button class="btn primary" type="submit" style="width:100%; justify-content:center; margin-top:10px;">
          Dispatch Assignment to Class
        </button>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector("#modalCloseBtn").onclick = close;
  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };

  overlay.querySelector("#newAsgForm").onsubmit = (e) => {
    e.preventDefault();
    const moduleId = overlay.querySelector("#asgModule").value;
    const mod = MODULES.find((m) => m.id === moduleId);
    const grade = overlay.querySelector("#asgClass").value;
    const section = overlay.querySelector("#asgSection").value;
    const newAsg = {
      id: `ASG-${Math.floor(100 + Math.random() * 900)}`,
      title: overlay.querySelector("#asgTitle").value.trim(),
      moduleId,
      moduleName: mod?.name || moduleId,
      subject: mod?.subject || "physics",
      grade,
      section,
      dueDate: overlay.querySelector("#asgDueDate").value,
      instructions:
        overlay.querySelector("#asgInstructions").value.trim() ||
        "Complete simulation and submit lab report.",
      submissionsCount: 0,
      totalStudents: CLASS_ROSTERS[`${grade}-${section}`]?.enrolled || 36,
    };
    onSave(newAsg);
    close();
  };
}

/**
 * Modal to review and grade a student's lab report.
 */
function openReviewModal(sub, onUpdate) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal lab-report-modal" style="max-width: 720px;" role="dialog" aria-modal="true" aria-labelledby="reviewTitle">
      <div class="report-modal-toolbar">
        <div class="report-toolbar-title">
          <span class="report-badge">Report Evaluation</span>
          <span id="reviewTitle">${esc(sub.studentName)} (${esc(sub.rollNo)}) · ${esc(sub.moduleName)}</span>
        </div>
        <button class="modal-close" id="reviewCloseBtn" type="button" aria-label="Close">✕</button>
      </div>

      <div class="lab-report-sheet" style="padding: 24px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
          <div>
            <h3>${esc(sub.moduleName)}</h3>
            <p class="fact">Submitted on ${esc(sub.submittedAt)} · Quiz: <b>${esc(sub.quizScore)}</b></p>
          </div>
          <span class="report-status-pill ${sub.status === "Graded" ? "done" : "active"}">${esc(sub.status)}</span>
        </div>

        ${
          sub.snapshotUrl
            ? `
        <section style="margin-bottom:16px;">
          <div class="section-tag">3D Apparatus Snapshot</div>
          <img src="${sub.snapshotUrl}" alt="Student 3D snapshot" style="max-height:240px; width:100%; object-fit:contain; border-radius:8px; border:1px solid var(--line);" />
        </section>`
            : ""
        }

        <section style="margin-bottom:16px;">
          <div class="section-tag">Student Measured Parameters</div>
          <table class="report-table">
            <thead>
              <tr><th>Parameter</th><th>Recorded Value</th></tr>
            </thead>
            <tbody>
              ${(sub.observations || [])
                .map(
                  (o) =>
                    `<tr><td><b>${esc(o.name)}</b></td><td><code class="val-code">${esc(o.value)}</code></td></tr>`
                )
                .join("")}
            </tbody>
          </table>
        </section>

        <section style="margin-bottom:16px;">
          <div class="section-tag">Student Findings & Hypothesis</div>
          <p style="background:var(--surface-tint); padding:10px 12px; border-radius:8px; border:1px solid var(--line); font-size:0.88rem;">
            "${esc(sub.studentConclusion)}"
          </p>
        </section>

        <hr class="report-divider" />

        <div class="rubric-chips" style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
          <button type="button" class="chip rubric-chip" data-grade="A+" data-remark="Outstanding observation table, accurate calculations, and clear scientific conclusion!">🌟 A+ Outstanding</button>
          <button type="button" class="chip rubric-chip" data-grade="A" data-remark="Well done! Verified parameters and solid experimental understanding.">✓ A Very Good</button>
          <button type="button" class="chip rubric-chip" data-grade="B+" data-remark="Good effort. Re-check boundary values and include more trials.">📝 B+ Good</button>
          <button type="button" class="chip rubric-chip" data-grade="Needs Revision" data-remark="Please re-run the 3D simulation and record at least 3 parameter readings.">⚠️ Needs Revision</button>
        </div>

        <form id="evaluationForm" style="display:flex; flex-direction:column; gap:12px;">
          <div style="display:grid; grid-template-columns: 140px 1fr; gap:12px;">
            <div class="control">
              <label for="gradeScore">Grade / Marks</label>
              <input type="text" id="gradeScore" class="text-input" value="${esc(sub.gradeScore || "A")}" placeholder="e.g. A+ or 19/20" required />
            </div>
            <div class="control">
              <label for="teacherRemark">Teacher Feedback & Remarks</label>
              <input type="text" id="teacherRemark" class="text-input" value="${esc(sub.teacherRemark || "Well done! Verified calculations.")}" placeholder="Write evaluation feedback..." />
            </div>
          </div>

          <div class="btn-row" style="justify-content:flex-end; margin-top:8px;">
            <button class="btn primary" type="submit">Save Evaluation & Mark Graded</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector("#reviewCloseBtn").onclick = close;
  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };

  overlay.querySelectorAll(".rubric-chip").forEach((chip) => {
    chip.onclick = () => {
      overlay.querySelector("#gradeScore").value = chip.dataset.grade;
      overlay.querySelector("#teacherRemark").value = chip.dataset.remark;
    };
  });

  overlay.querySelector("#evaluationForm").onsubmit = (e) => {
    e.preventDefault();
    const updated = {
      ...sub,
      status: "Graded",
      gradeScore: overlay.querySelector("#gradeScore").value.trim(),
      teacherRemark: overlay.querySelector("#teacherRemark").value.trim(),
    };
    onUpdate(updated);
    close();
  };
}
