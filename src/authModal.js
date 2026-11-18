import { signUp, signIn, signInGoogle, syncUserRoleProfile } from "./auth.js";
import {
  setLoginRole,
  enableDemoTeacherSession,
  clearDemoTeacherSession,
} from "./features/classroomStore.js";

const TEACHER_VERIFIED_KEY = "sparklab.teacher.verified.uid";
const VALID_TEACHER_CODES = new Set(["SPARK-TEACHER-2026", "TEACHER2026", "SPARKTEACHER"]);

let overlay = null;

function build() {
  const el = document.createElement("div");
  el.className = "modal-overlay";
  el.innerHTML = `
    <div class="modal dual-auth-modal" role="dialog" aria-modal="true" aria-labelledby="authTitle">
      <button class="modal-close" type="button" aria-label="Close">✕</button>

      <!-- Step 1: Role Selection -->
      <div id="authStepRole" class="auth-step-role">
        <span class="gate-eyebrow">Dual Login Portal</span>
        <h2 id="authTitle" class="dual-auth-title">Who is signing in?</h2>
        <p class="fact" style="margin-bottom:14px;">Choose your role to continue to your personalized SparkLab workspace.</p>
        <div class="role-picker-grid">
          <button type="button" class="role-pick-card" data-role="student">
            <span class="role-pick-icon">🎓</span>
            <strong>I am a Student</strong>
            <span>Explore 75+ 3D STEM labs, earn XP &amp; badges, and submit lab reports.</span>
          </button>
          <button type="button" class="role-pick-card" data-role="teacher">
            <span class="role-pick-icon">🏫</span>
            <strong>I am a Teacher</strong>
            <span>Assign experiments, grade lab reports, view analytics &amp; smartboard mode.</span>
          </button>
        </div>
      </div>

      <!-- Step 2: Role-Specific Login Form -->
      <div id="authStepForm" hidden>
        <div class="auth-role-header">
          <button type="button" class="btn btn-xs" id="authBackRoleBtn">← Change Role</button>
          <span class="role-active-pill" id="authRoleBadge"></span>
        </div>

        <div class="modal-tabs" role="tablist">
          <button class="modal-tab" type="button" data-tab="signin" aria-selected="true">Sign in</button>
          <button class="modal-tab" type="button" data-tab="signup" aria-selected="false">Sign up</button>
        </div>

        <form id="authForm" class="modal-form">
          <div class="control" id="nameRow" hidden>
            <label for="authName">Name</label>
            <input type="text" id="authName" class="text-input" autocomplete="name">
          </div>
          <div class="control">
            <label for="authEmail">Email</label>
            <input type="email" id="authEmail" class="text-input" autocomplete="email" required>
          </div>
          <div class="control">
            <label for="authPass">Password</label>
            <input type="password" id="authPass" class="text-input" autocomplete="current-password" required minlength="6">
          </div>
          <div class="control" id="teacherCodeRow" hidden>
            <label for="authTeacherCode">Teacher Verification Code</label>
            <input type="text" id="authTeacherCode" class="text-input" placeholder="e.g. SPARK-TEACHER-2026" autocomplete="off">
            <small class="fact" style="font-size:0.75rem;">Required for non-.edu emails (Demo code: <code>SPARK-TEACHER-2026</code>)</small>
          </div>
          <p class="fact modal-error" id="authError" role="alert" hidden></p>
          <button class="btn primary" type="submit" id="authSubmit">Sign in</button>
        </form>

        <div class="modal-or"><span>or</span></div>
        <button class="btn btn-google" type="button" id="authGoogle">
          <svg class="google-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Continue with Google</span>
        </button>

        <button class="btn" type="button" id="authDemoTeacherBtn" hidden style="width:100%; justify-content:center; margin-top:8px;">
          🏫 Enter Offline / Demo Teacher Mode
        </button>

        <p class="fact" id="authRoleHint" style="margin-top:10px;">No account? Sign up takes ten seconds — just an email and a password.</p>
      </div>
    </div>
  `;
  return el;
}

function isEducatorEmail(email = "") {
  const e = email.toLowerCase();
  return (
    e.includes("teacher") ||
    e.includes("faculty") ||
    e.includes("educator") ||
    e.endsWith(".edu") ||
    e.includes("school") ||
    e.includes("kv")
  );
}

export function openAuthModal(onDone, initialRole = null) {
  closeAuthModal();
  overlay = build();
  document.body.appendChild(overlay);

  let mode = "signin";
  let selectedRole = initialRole;

  const stepRole = overlay.querySelector("#authStepRole");
  const stepForm = overlay.querySelector("#authStepForm");
  const roleBadge = overlay.querySelector("#authRoleBadge");
  const teacherCodeRow = overlay.querySelector("#teacherCodeRow");
  const demoTeacherBtn = overlay.querySelector("#authDemoTeacherBtn");
  const roleHint = overlay.querySelector("#authRoleHint");

  const tabs = overlay.querySelectorAll(".modal-tab");
  const nameRow = overlay.querySelector("#nameRow");
  const submitBtn = overlay.querySelector("#authSubmit");
  const errorEl = overlay.querySelector("#authError");
  const form = overlay.querySelector("#authForm");

  function showRolePicker() {
    selectedRole = null;
    stepRole.hidden = false;
    stepForm.hidden = true;
    errorEl.hidden = true;
  }

  function selectRole(role) {
    selectedRole = role;
    stepRole.hidden = true;
    stepForm.hidden = false;
    errorEl.hidden = true;

    if (role === "teacher") {
      roleBadge.textContent = "🏫 Teacher / Educator Login";
      roleBadge.className = "role-active-pill is-teacher";
      teacherCodeRow.hidden = false;
      demoTeacherBtn.hidden = false;
      roleHint.textContent = "Teacher Dashboard is unlocked only for verified educators.";
    } else {
      roleBadge.textContent = "🎓 Student Login";
      roleBadge.className = "role-active-pill is-student";
      teacherCodeRow.hidden = true;
      demoTeacherBtn.hidden = true;
      roleHint.textContent = "No account? Sign up takes ten seconds — just an email and a password.";
    }
    setTimeout(() => overlay.querySelector("#authEmail")?.focus(), 0);
  }

  function setMode(m) {
    mode = m;
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === m)));
    nameRow.hidden = m !== "signup";
    submitBtn.textContent = m === "signup" ? "Create account" : "Sign in";
    errorEl.hidden = true;
  }

  overlay.querySelectorAll(".role-pick-card").forEach((btn) => {
    btn.addEventListener("click", () => selectRole(btn.dataset.role));
  });
  overlay.querySelector("#authBackRoleBtn").addEventListener("click", showRolePicker);
  tabs.forEach((t) => t.addEventListener("click", () => setMode(t.dataset.tab)));

  overlay.querySelector(".modal-close").addEventListener("click", closeAuthModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeAuthModal();
  });
  document.addEventListener("keydown", onEsc);

  async function finalizeRoleForUser(user, enteredCode = "") {
    if (selectedRole === "teacher") {
      clearDemoTeacherSession();
      const cleanCode = enteredCode.trim().toUpperCase();
      if (VALID_TEACHER_CODES.has(cleanCode) && user?.uid) {
        try {
          localStorage.setItem(TEACHER_VERIFIED_KEY, user.uid);
        } catch {}
      }
      setLoginRole("teacher");
      await syncUserRoleProfile(user, "teacher");
    } else {
      clearDemoTeacherSession();
      try {
        localStorage.removeItem(TEACHER_VERIFIED_KEY);
      } catch {}
      setLoginRole("student");
      await syncUserRoleProfile(user, "student");
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const email = overlay.querySelector("#authEmail").value.trim();
    const pass = overlay.querySelector("#authPass").value;
    const name = overlay.querySelector("#authName").value.trim();
    const teacherCode = overlay.querySelector("#authTeacherCode")?.value || "";

    if (selectedRole === "teacher" && !isEducatorEmail(email)) {
      const clean = teacherCode.trim().toUpperCase();
      if (!VALID_TEACHER_CODES.has(clean)) {
        errorEl.textContent =
          "Enter a valid Teacher Verification Code (e.g. SPARK-TEACHER-2026) or use a school/educator email.";
        errorEl.hidden = false;
        return;
      }
    }

    submitBtn.disabled = true;
    const result = mode === "signup" ? await signUp(name, email, pass) : await signIn(email, pass);
    submitBtn.disabled = false;
    if (result.error) {
      errorEl.textContent = result.error;
      errorEl.hidden = false;
      return;
    }
    await finalizeRoleForUser(result.user, teacherCode);
    closeAuthModal();
    onDone?.(result.user, selectedRole);
  });

  overlay.querySelector("#authGoogle").addEventListener("click", async () => {
    errorEl.hidden = true;
    const teacherCode = overlay.querySelector("#authTeacherCode")?.value || "";
    const result = await signInGoogle();
    if (result.error) {
      errorEl.textContent = result.error;
      errorEl.hidden = false;
      return;
    }
    await finalizeRoleForUser(result.user, teacherCode);
    closeAuthModal();
    onDone?.(result.user, selectedRole);
  });

  demoTeacherBtn.addEventListener("click", () => {
    const demoUser = enableDemoTeacherSession();
    setLoginRole("teacher");
    closeAuthModal();
    onDone?.(demoUser, "teacher");
  });

  setMode("signin");
  if (initialRole === "student" || initialRole === "teacher") {
    selectRole(initialRole);
  } else {
    showRolePicker();
  }
}

function onEsc(e) {
  if (e.key === "Escape") closeAuthModal();
}

export function closeAuthModal() {
  if (!overlay) return;
  document.removeEventListener("keydown", onEsc);
  overlay.remove();
  overlay = null;
}
