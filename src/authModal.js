import { signUp, signIn, signInGoogle } from "./auth.js";

let overlay = null;

function build() {
  const el = document.createElement("div");
  el.className = "modal-overlay";
  el.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="authTitle">
      <button class="modal-close" type="button" aria-label="Close">✕</button>
      <div class="modal-tabs" role="tablist">
        <button class="modal-tab" type="button" data-tab="signin" aria-selected="true">Sign in</button>
        <button class="modal-tab" type="button" data-tab="signup" aria-selected="false">Sign up</button>
      </div>
      <h2 id="authTitle" class="sr-only">Sign in or sign up</h2>
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
      <p class="fact">No account? Sign up takes ten seconds — just an email and a password.</p>
    </div>
  `;
  return el;
}

export function openAuthModal(onDone) {
  closeAuthModal();
  overlay = build();
  document.body.appendChild(overlay);

  let mode = "signin";
  const tabs = overlay.querySelectorAll(".modal-tab");
  const nameRow = overlay.querySelector("#nameRow");
  const submitBtn = overlay.querySelector("#authSubmit");
  const errorEl = overlay.querySelector("#authError");
  const form = overlay.querySelector("#authForm");

  function setMode(m) {
    mode = m;
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === m)));
    nameRow.hidden = m !== "signup";
    submitBtn.textContent = m === "signup" ? "Create account" : "Sign in";
    errorEl.hidden = true;
  }

  tabs.forEach((t) => t.addEventListener("click", () => setMode(t.dataset.tab)));

  overlay.querySelector(".modal-close").addEventListener("click", closeAuthModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeAuthModal();
  });
  document.addEventListener("keydown", onEsc);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    submitBtn.disabled = true;
    const email = overlay.querySelector("#authEmail").value.trim();
    const pass = overlay.querySelector("#authPass").value;
    const name = overlay.querySelector("#authName").value.trim();
    const result = mode === "signup" ? await signUp(name, email, pass) : await signIn(email, pass);
    submitBtn.disabled = false;
    if (result.error) {
      errorEl.textContent = result.error;
      errorEl.hidden = false;
      return;
    }
    closeAuthModal();
    onDone?.(result.user);
  });

  overlay.querySelector("#authGoogle").addEventListener("click", async () => {
    errorEl.hidden = true;
    const result = await signInGoogle();
    if (result.error) {
      errorEl.textContent = result.error;
      errorEl.hidden = false;
      return;
    }
    closeAuthModal();
    onDone?.(result.user);
  });

  setMode("signin");
  setTimeout(() => overlay.querySelector("#authEmail")?.focus(), 0);
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
