import { escapeHtml as esc } from "../lib/html.js";
import { MODULES } from "../modules/index.js";
import { isAdmin, auth } from "../firebase.js";
import { openAuthModal } from "../authModal.js";

export const TEACHER_ACCESS_CODE = "SPARK-TEACHER-2026";
const TEACHER_STORAGE_KEY = "sparklab.teacher.verified.uid";
const ASSIGNMENTS_KEY = "sparklab.teacher.assignments.v1";
const SUBMISSIONS_KEY = "sparklab.teacher.submissions.v1";

/**
 * Checks if the currently authenticated user is an authorized teacher.
 */
export function isTeacher(user) {
  if (!user) return false;
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
}

// Default initial assignments for demonstration
const DEFAULT_ASSIGNMENTS = [
  {
    id: "ASG-101",
    title: "Verify Snell's Law with Crown Glass Prism",
    moduleId: "refraction",
    moduleName: "Refraction & Snell's Law",
    subject: "physics",
    grade: "10",
    section: "A",
    dueDate: "2026-11-25",
    instructions: "Record 4 different angles of incidence (30°, 45°, 60°, 75°), calculate n = sin(i)/sin(r), and submit the 3D snapshot report.",
    submissionsCount: 28,
    totalStudents: 36,
  },
  {
    id: "ASG-102",
    title: "Simple Pendulum: Length vs Time Period (T² ∝ L)",
    moduleId: "pendulum",
    moduleName: "Simple Pendulum",
    subject: "physics",
    grade: "9",
    section: "B",
    dueDate: "2026-11-28",
    instructions: "Measure time period T for lengths 0.5m, 1.0m, 1.5m and 2.0m. Export the lab report with your observation table.",
    submissionsCount: 32,
    totalStudents: 35,
  },
  {
    id: "ASG-103",
    title: "Ohm's Law: Resistance Verification",
    moduleId: "circuit",
    moduleName: "Ohm's Law Virtual Circuit",
    subject: "physics",
    grade: "10",
    section: "A",
    dueDate: "2026-12-02",
    instructions: "Adjust voltage between 2V and 12V. Plot V vs I to calculate effective circuit resistance.",
    submissionsCount: 14,
    totalStudents: 36,
  },
];

// Default initial student submissions for teacher review
const DEFAULT_SUBMISSIONS = [
  {
    id: "SUB-801",
    assignmentId: "ASG-101",
    studentName: "Aarav Sharma",
    rollNo: "10-A-04",
    grade: "Class 10 - Section A",
    moduleName: "Refraction & Snell's Law",
    submittedAt: "17 Nov 2026, 04:30 PM",
    snapshotUrl: "",
    observations: [
      { name: "Incident Angle (i)", value: "45°" },
      { name: "Refracted Angle (r)", value: "28.1°" },
      { name: "Medium 1", value: "Air (n=1.00)" },
      { name: "Medium 2", value: "Crown Glass (n=1.52)" },
      { name: "Calculated Ratio sin(i)/sin(r)", value: "1.503" },
    ],
    studentConclusion: "Observed that light bends towards the normal when entering glass. Snell's ratio remained constant within 1% experimental tolerance.",
    quizScore: "3/3 (100%)",
    status: "Needs Review",
    gradeScore: "",
    teacherRemark: "",
  },
  {
    id: "SUB-802",
    assignmentId: "ASG-102",
    studentName: "Diya Patel",
    rollNo: "09-B-12",
    grade: "Class 9 - Section B",
    moduleName: "Simple Pendulum",
    submittedAt: "17 Nov 2026, 06:15 PM",
    snapshotUrl: "",
    observations: [
      { name: "String Length (L)", value: "1.0 m" },
      { name: "Bob Mass", value: "0.2 kg" },
      { name: "Initial Angle", value: "10°" },
      { name: "Measured Period (T)", value: "2.01 s" },
    ],
    studentConclusion: "The time period is proportional to the square root of string length and independent of bob mass.",
    quizScore: "2/2 (100%)",
    status: "Graded",
    gradeScore: "A+",
    teacherRemark: "Excellent observation table and clear scientific conclusion!",
  },
  {
    id: "SUB-803",
    assignmentId: "ASG-101",
    studentName: "Rohan Verma",
    rollNo: "10-A-21",
    grade: "Class 10 - Section A",
    moduleName: "Refraction & Snell's Law",
    submittedAt: "18 Nov 2026, 03:10 AM",
    observations: [
      { name: "Incident Angle (i)", value: "60°" },
      { name: "Refracted Angle (r)", value: "35.2°" },
      { name: "Medium 1", value: "Air" },
      { name: "Medium 2", value: "Dense Flint Glass" },
    ],
    studentConclusion: "Higher refractive index results in greater deviation toward normal.",
    quizScore: "2/3 (67%)",
    status: "Needs Review",
    gradeScore: "",
    teacherRemark: "",
  },
];

function loadAssignments() {
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_ASSIGNMENTS;
  } catch {
    return DEFAULT_ASSIGNMENTS;
  }
}

function saveAssignments(list) {
  try {
    localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(list));
  } catch {}
}

function loadSubmissions() {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_SUBMISSIONS;
  } catch {
    return DEFAULT_SUBMISSIONS;
  }
}

function saveSubmissions(list) {
  try {
    localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(list));
  } catch {}
}

/**
 * Mounts the Teacher's Dashboard or Teacher Authorization Gate.
 */
export async function mount(root) {
  const user = auth?.currentUser;

  // 1. Access Check: Not a verified teacher
  if (!isTeacher(user)) {
    renderAccessGate(root, user);
    return;
  }

  // 2. Verified Teacher: Render Dashboard
  renderTeacherPortal(root, user);
}

/**
 * Renders the Teacher Verification Gate screen.
 */
function renderAccessGate(root, user) {
  root.innerHTML = `
    <div class="teacher-gate-wrap">
      <div class="teacher-gate-card">
        <div class="gate-icon-circle">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <span class="gate-eyebrow">Educator & School Administration</span>
        <h1 class="gate-title">SparkLab Teacher Portal</h1>
        <p class="gate-subtitle">
          This portal allows teachers and school instructors to assign 3D virtual experiments, inspect classroom progress, and evaluate student lab reports.
        </p>

        ${
          !user
            ? `
          <div class="gate-prompt-box">
            <p><strong>Educator Sign In Required</strong></p>
            <p class="fact">Please sign in with your school Google account or registered educator email.</p>
            <button class="btn primary" id="gateSignInBtn" type="button" style="width:100%; justify-content:center; margin-top:12px;">
              Sign In as Teacher
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
          <a class="linklike" href="#/">← Back to Student Virtual Lab</a>
        </div>
      </div>
    </div>
  `;

  // Wire Sign In
  root.querySelector("#gateSignInBtn")?.addEventListener("click", () => {
    openAuthModal(() => mount(root));
  });

  // Wire Passcode Verification
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

/**
 * Renders the full Educator & Teacher Portal.
 */
function renderTeacherPortal(root, user) {
  let activeTab = "assignments"; // 'assignments' | 'reports' | 'analytics' | 'demo'
  let selectedClass = "10-A";
  let assignments = loadAssignments();
  let submissions = loadSubmissions();

  function paint() {
    const teacherName = user?.displayName || (user?.email ? user.email.split("@")[0] : "Educator");
    const activeAssignments = assignments.filter((a) => !selectedClass || `${a.grade}-${a.section}` === selectedClass);
    const activeSubmissions = submissions.filter((s) => !selectedClass || s.grade.includes(selectedClass.replace("-", " - Section ")));
    const pendingReports = submissions.filter((s) => s.status === "Needs Review").length;

    root.innerHTML = `
      <div class="teacher-portal-view">
        <!-- Top Teacher Navigation Bar -->
        <header class="teacher-topbar">
          <div class="teacher-brand">
            <span class="teacher-badge">Verified Educator Portal</span>
            <h1>Welcome, Prof. ${esc(teacherName)}</h1>
            <p class="teacher-subtitle">Kendriya Vidyalaya / Central STEM Faculty · Academic Session 2026–27</p>
          </div>
          <div class="teacher-top-actions">
            <select class="class-selector-dropdown" id="classSelector">
              <option value="10-A" ${selectedClass === "10-A" ? "selected" : ""}>Class 10 - Section A (Physics)</option>
              <option value="9-B" ${selectedClass === "9-B" ? "selected" : ""}>Class 9 - Section B (Science)</option>
              <option value="11-A" ${selectedClass === "11-A" ? "selected" : ""}>Class 11 - Section A (Senior Physics)</option>
              <option value="" ${!selectedClass ? "selected" : ""}>All Classes (Master Roster)</option>
            </select>
            <button class="btn btn-sm secondary" id="newAssignmentBtn" type="button">➕ New Assignment</button>
            <button class="btn btn-sm" id="exitTeacherBtn" type="button" title="Switch to student view">Student View</button>
          </div>
        </header>

        <!-- Summary Metric Cards -->
        <div class="teacher-stats-grid">
          <article class="stat-card">
            <div class="stat-meta">Total Enrolled Students</div>
            <div class="stat-val">36</div>
            <div class="stat-hint">Class 10 - Section A Active Roster</div>
          </article>
          <article class="stat-card">
            <div class="stat-meta">Active Lab Assignments</div>
            <div class="stat-val">${assignments.length}</div>
            <div class="stat-hint">Across physics, chemistry, biology</div>
          </article>
          <article class="stat-card">
            <div class="stat-meta">Pending Lab Reports</div>
            <div class="stat-val ${pendingReports > 0 ? "highlight-val" : ""}">${pendingReports}</div>
            <div class="stat-hint">${pendingReports > 0 ? "Awaiting teacher review & grade" : "All reports evaluated ✓"}</div>
          </article>
          <article class="stat-card">
            <div class="stat-meta">Average Quiz & Lab Mastery</div>
            <div class="stat-val">87.4%</div>
            <div class="stat-hint">↑ 4.2% higher than state average</div>
          </article>
        </div>

        <!-- Portal Tabs Navigation -->
        <nav class="teacher-tabs-nav" role="tablist">
          <button class="teacher-tab ${activeTab === "assignments" ? "active" : ""}" data-tab="assignments" type="button">
            📋 Class Assignments (${activeAssignments.length})
          </button>
          <button class="teacher-tab ${activeTab === "reports" ? "active" : ""}" data-tab="reports" type="button">
            📑 Student Lab Reports (${submissions.length})
          </button>
          <button class="teacher-tab ${activeTab === "analytics" ? "active" : ""}" data-tab="analytics" type="button">
            📊 Topic Mastery Analytics
          </button>
          <button class="teacher-tab ${activeTab === "demo" ? "active" : ""}" data-tab="demo" type="button">
            📽️ Smartboard Projector Mode
          </button>
        </nav>

        <!-- Tab Body Content -->
        <div class="teacher-tab-body">
          ${renderTabContent(activeTab, { activeAssignments, submissions, selectedClass })}
        </div>
      </div>
    `;

    // Event Wire: Tab switching
    root.querySelectorAll(".teacher-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTab = btn.dataset.tab;
        paint();
      });
    });

    // Event Wire: Class dropdown
    root.querySelector("#classSelector")?.addEventListener("change", (e) => {
      selectedClass = e.target.value;
      paint();
    });

    // Event Wire: New Assignment Modal
    root.querySelector("#newAssignmentBtn")?.addEventListener("click", () => {
      openNewAssignmentModal((newAsg) => {
        assignments.unshift(newAsg);
        saveAssignments(assignments);
        paint();
      });
    });

    // Event Wire: Exit / Student View
    root.querySelector("#exitTeacherBtn")?.addEventListener("click", () => {
      location.hash = "#/lab";
    });

    // Event Wire: Delete Assignment
    root.querySelectorAll(".delete-asg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        assignments = assignments.filter((a) => a.id !== id);
        saveAssignments(assignments);
        paint();
      });
    });

    // Event Wire: Review Lab Report Modal
    root.querySelectorAll(".review-sub-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const sub = submissions.find((s) => s.id === id);
        if (sub) {
          openReviewModal(sub, (updated) => {
            const idx = submissions.findIndex((s) => s.id === id);
            if (idx >= 0) {
              submissions[idx] = updated;
              saveSubmissions(submissions);
              paint();
            }
          });
        }
      });
    });
  }

  paint();
}

/**
 * Returns HTML for the active tab.
 */
function renderTabContent(tab, { activeAssignments, submissions, selectedClass }) {
  if (tab === "assignments") {
    return `
      <div class="tab-section">
        <div class="tab-header-row">
          <div>
            <h2>Active Classroom Assignments</h2>
            <p class="fact">Curriculum experiments assigned to students with real-time submission tracking.</p>
          </div>
        </div>

        <div class="assignments-table-wrap">
          <table class="teacher-table">
            <thead>
              <tr>
                <th>Assignment Title</th>
                <th>Target 3D Lab</th>
                <th>Class & Section</th>
                <th>Due Date</th>
                <th>Submissions</th>
                <th>Student Link</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${
                activeAssignments.length === 0
                  ? `<tr><td colspan="7" style="text-align:center; padding:24px;">No assignments found for this class filter. Click "+ New Assignment" above to dispatch one.</td></tr>`
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
                          (a.submissionsCount / a.totalStudents) * 100
                        )}%)</span>
                      <progress max="${a.totalStudents}" value="${a.submissionsCount}"></progress>
                    </div>
                  </td>
                  <td>
                    <button class="btn btn-xs copy-link-btn" type="button" onclick="navigator.clipboard.writeText(location.origin + '/#/' + '${esc(
                      a.moduleId
                    )}?assign=' + '${esc(a.id)}'); alert('Copied student link to clipboard!')">🔗 Copy Link</button>
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
        <div class="tab-header-row">
          <div>
            <h2>Submitted Virtual Lab Reports</h2>
            <p class="fact">Inspect student 3D apparatus snapshots, parameter measurements, and theoretical findings.</p>
          </div>
        </div>

        <div class="assignments-table-wrap">
          <table class="teacher-table">
            <thead>
              <tr>
                <th>Student & Roll No.</th>
                <th>Class</th>
                <th>Experiment</th>
                <th>Submitted On</th>
                <th>Quiz Score</th>
                <th>Review Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${submissions
                .map(
                  (s) => `
                <tr>
                  <td>
                    <b>${esc(s.studentName)}</b>
                    <div class="table-subtext">Roll No: ${esc(s.rollNo)}</div>
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
                      📝 Review & Grade
                    </button>
                  </td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (tab === "analytics") {
    return `
      <div class="tab-section">
        <h2>Curriculum Topic Mastery & Diagnostic Analytics</h2>
        <p class="fact">Aggregated quiz benchmarks, parameter accuracies, and conceptual misconceptions across 36 students.</p>

        <div class="analytics-row">
          <div class="analytics-card">
            <h3>🌟 High Mastery Topics (>80%)</h3>
            <ul class="analytics-list">
              <li>
                <span>Simple Pendulum (Oscillations & Gravity)</span>
                <b>94% Mastery</b>
              </li>
              <li>
                <span>Ohm's Law & Circuit Resistances</span>
                <b>88% Mastery</b>
              </li>
              <li>
                <span>Reflection in Plane & Curved Mirrors</span>
                <b>85% Mastery</b>
              </li>
            </ul>
          </div>

          <div class="analytics-card">
            <h3>⚠️ Topics Needing Revision & Intervention</h3>
            <ul class="analytics-list">
              <li>
                <span>Refraction & Snell's Law (Relative Indices)</span>
                <b style="color:var(--bad, #ef4444)">58% (Confusion with critical angle)</b>
              </li>
              <li>
                <span>Electromagnetic Induction (Faraday's Law)</span>
                <b style="color:var(--bad, #ef4444)">64% (Lenz's rule direction)</b>
              </li>
              <li>
                <span>Calorimetry & Heat Transfer</span>
                <b style="color:var(--bad, #ef4444)">68% (Specific heat capacity math)</b>
              </li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  if (tab === "demo") {
    return `
      <div class="tab-section">
        <h2>Smartboard / Classroom Demonstration Launcher</h2>
        <p class="fact">Launch high-visibility 3D simulations optimized for classroom projectors and interactive smartboards.</p>

        <div class="demo-launcher-grid">
          ${MODULES.slice(0, 12)
            .map(
              (m) => `
            <article class="demo-card">
              <span class="table-pill">${esc((m.subject || "STEM").toUpperCase())}</span>
              <h3>${esc(m.name)}</h3>
              <p class="fact">${esc(m.tag || "Core Curriculum")}</p>
              <div class="btn-row" style="margin-top:10px;">
                <a class="btn btn-sm primary" href="#/${esc(m.id)}" target="_blank">🚀 Launch Demo</a>
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
    const newAsg = {
      id: `ASG-${Math.floor(100 + Math.random() * 900)}`,
      title: overlay.querySelector("#asgTitle").value.trim(),
      moduleId,
      moduleName: mod?.name || moduleId,
      subject: mod?.subject || "physics",
      grade: overlay.querySelector("#asgClass").value,
      section: overlay.querySelector("#asgSection").value,
      dueDate: overlay.querySelector("#asgDueDate").value,
      instructions: overlay.querySelector("#asgInstructions").value.trim() || "Complete simulation and submit lab report.",
      submissionsCount: 0,
      totalStudents: 36,
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
        <div style="display:flex; justify-content:space-between; margin-bottom:16px;">
          <div>
            <h3>${esc(sub.moduleName)}</h3>
            <p class="fact">Submitted on ${esc(sub.submittedAt)} · Quiz: <b>${esc(sub.quizScore)}</b></p>
          </div>
          <span class="report-status-pill ${sub.status === "Graded" ? "done" : "active"}">${esc(sub.status)}</span>
        </div>

        <section style="margin-bottom:16px;">
          <div class="section-tag">Student Measured Parameters</div>
          <table class="report-table">
            <thead>
              <tr><th>Parameter</th><th>Recorded Value</th></tr>
            </thead>
            <tbody>
              ${sub.observations.map((o) => `<tr><td><b>${esc(o.name)}</b></td><td><code class="val-code">${esc(o.value)}</code></td></tr>`).join("")}
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
