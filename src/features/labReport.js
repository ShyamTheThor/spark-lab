import { escapeHtml } from "../lib/html.js";

/**
 * Procedural camera shutter click using Web Audio API (zero external assets).
 */
export function playShutterSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // First click sound
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(1200, now);
    osc1.frequency.exponentialRampToValueAtTime(300, now + 0.04);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.05);

    // Second mechanical shutter snap
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(600, now + 0.05);
    osc2.frequency.exponentialRampToValueAtTime(150, now + 0.09);
    gain2.gain.setValueAtTime(0.25, now + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.05);
    osc2.stop(now + 0.1);
  } catch {
    // AudioContext blocked or not supported - silently ignore
  }
}

/**
 * Visual shutter flash on the target element.
 */
export function triggerShutterFlash(element) {
  if (!element) return;
  element.classList.remove("shutter-flash");
  // force reflow
  void element.offsetWidth;
  element.classList.add("shutter-flash");
  setTimeout(() => element.classList.remove("shutter-flash"), 450);
}

/**
 * Downloads a dataURL as a file with a given filename.
 */
export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Scrapes experimental parameters, sliders, inputs, and outputs from the active control panel.
 */
export function extractPanelObservations(panel) {
  if (!panel) return [];
  const observations = [];

  // 1. Check controls / labels
  const labels = panel.querySelectorAll("label, .control, .slider-control");
  labels.forEach((lbl) => {
    // Get label name without the nested input/output values
    const clone = lbl.cloneNode(true);
    clone.querySelectorAll("input, output, select, button, .unit").forEach((n) => n.remove());
    let name = clone.textContent.trim().replace(/[:=]\s*$/, "");
    if (!name && lbl.getAttribute("aria-label")) {
      name = lbl.getAttribute("aria-label");
    }

    // Find value
    let val = "";
    const out = lbl.querySelector("output");
    const input = lbl.querySelector("input");
    const sel = lbl.querySelector("select");

    if (out && out.textContent.trim()) {
      val = out.textContent.trim();
    } else if (sel && sel.selectedIndex >= 0) {
      val = sel.options[sel.selectedIndex].text.trim();
    } else if (input) {
      if (input.type === "checkbox") {
        val = input.checked ? "Enabled / Active" : "Disabled / Inactive";
      } else {
        val = input.value;
      }
    }

    if (name && val && !observations.some((o) => o.name === name)) {
      observations.push({ name, value: val });
    }
  });

  // 2. Check standalone readouts or stats
  panel.querySelectorAll(".readout, .metric, .stat-item, .data-item").forEach((el) => {
    const nameEl = el.querySelector(".label, span:first-child");
    const valEl = el.querySelector(".value, b, strong, output");
    if (nameEl && valEl) {
      const name = nameEl.textContent.trim().replace(/[:=]\s*$/, "");
      const value = valEl.textContent.trim();
      if (name && value && !observations.some((o) => o.name === name)) {
        observations.push({ name, value });
      }
    }
  });

  // Default fallback if no inputs/outputs detected
  if (observations.length === 0) {
    observations.push(
      { name: "Simulation Mode", value: "Real-time 3D Interactive" },
      { name: "Apparatus Calibration", value: "Standard Laboratory Benchmark" }
    );
  }

  return observations;
}

/**
 * Extracts a concise summary of the theory / lesson.
 */
export function extractTheoryText(html) {
  if (!html) return "Experimental study of fundamental STEM principles through interactive 3D simulation.";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const p = tmp.querySelector("p");
  if (p && p.textContent.trim()) {
    return p.textContent.trim();
  }
  return tmp.textContent.trim().slice(0, 280) + "...";
}

let activeReportOverlay = null;

export function closeLabReportModal() {
  if (activeReportOverlay) {
    activeReportOverlay.remove();
    activeReportOverlay = null;
    document.body.classList.remove("report-modal-open");
  }
}

/**
 * Opens the comprehensive SparkLab Experiment Report modal.
 */
export function openLabReportModal({
  module,
  viewer,
  panel,
  currentUser = null,
  quizScore = null,
  completed = false,
  snapshotUrl = null,
}) {
  closeLabReportModal();

  // If no snapshot provided, take one right now
  const imageSrc = snapshotUrl || viewer?.takeSnapshot?.(module.scene) || "";
  const observations = extractPanelObservations(panel);
  const theory = extractTheoryText(module.lesson);

  const reportId = `SL-${new Date().getFullYear()}-${(module.id || "LAB").toUpperCase().slice(0, 4)}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;

  const now = new Date();
  const dateFormatted = now.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const studentName = currentUser?.displayName || (currentUser?.email ? currentUser.email.split("@")[0] : "Student Scholar");
  const gradeTag = module.tag || "Classes 9–12 STEM";
  const defaultObservationNote = `Successfully performed the 3D virtual experiment for "${module.name}". All parameters were recorded and observed to be consistent with theoretical laws.`;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay lab-report-overlay";
  overlay.innerHTML = `
    <div class="modal lab-report-modal" role="dialog" aria-modal="true" aria-labelledby="reportTitle">
      <div class="report-modal-toolbar">
        <div class="report-toolbar-title">
          <span class="report-badge">NCERT & CBSE Aligned</span>
          <span>Virtual Lab Experiment Report</span>
        </div>
        <div class="report-actions-top">
          <button class="btn btn-sm" id="reportCopyBtn" type="button" title="Copy text summary">📋 Copy Summary</button>
          <button class="btn btn-sm" id="reportDownloadPngBtn" type="button" title="Download snapshot image">📸 Download Snapshot</button>
          <button class="btn btn-sm primary" id="reportPrintBtn" type="button" title="Print or save as PDF">🖨️ Print / Save PDF</button>
          <button class="modal-close" id="reportCloseBtn" type="button" aria-label="Close">✕</button>
        </div>
      </div>

      <div class="lab-report-sheet" id="labReportSheet">
        <!-- Header -->
        <header class="report-header">
          <div class="report-brand">
            <svg class="brand-mark" viewBox="0 0 26 26" fill="none" width="28" height="28" aria-hidden="true">
              <circle cx="13" cy="13" r="3.6" fill="currentColor"/>
              <ellipse cx="13" cy="13" rx="12" ry="5.2" stroke="currentColor" stroke-width="1.6"/>
              <ellipse cx="13" cy="13" rx="12" ry="5.2" stroke="currentColor" stroke-width="1.6" transform="rotate(60 13 13)"/>
            </svg>
            <div>
              <h1 class="report-brand-title">SparkLab Virtual STEM Laboratory</h1>
              <p class="report-brand-sub">Interactive 3D Science & Mathematics Curriculum</p>
            </div>
          </div>
          <div class="report-meta-box">
            <div class="meta-row"><span class="meta-lbl">Report ID:</span> <b class="meta-val">${escapeHtml(reportId)}</b></div>
            <div class="meta-row"><span class="meta-lbl">Date:</span> <span class="meta-val">${escapeHtml(dateFormatted)}</span></div>
            <div class="meta-row"><span class="meta-lbl">Status:</span> <span class="report-status-pill ${completed ? "done" : "active"}">${completed ? "Completed ✓" : "Active Simulation"}</span></div>
          </div>
        </header>

        <hr class="report-divider" />

        <!-- Student & Academic Metadata -->
        <section class="report-section student-info-grid">
          <div class="info-cell">
            <label class="info-label">Student Name</label>
            <input class="report-input-field" id="reportStudentName" value="${escapeHtml(studentName)}" placeholder="Enter your name" />
          </div>
          <div class="info-cell">
            <label class="info-label">Class & Section</label>
            <input class="report-input-field" id="reportStudentClass" value="${escapeHtml(gradeTag)}" placeholder="e.g. Class 10 - Section A" />
          </div>
          <div class="info-cell">
            <label class="info-label">School / Institution</label>
            <input class="report-input-field" id="reportSchool" value="National Science School" placeholder="Enter school name" />
          </div>
          <div class="info-cell">
            <label class="info-label">Subject & Discipline</label>
            <div class="report-static-val"><b>${escapeHtml((module.subject || "Science").toUpperCase())}</b> · Virtual Practical</div>
          </div>
        </section>

        <!-- Experiment Title -->
        <section class="report-section report-aim">
          <div class="section-tag">Aim of Experiment</div>
          <h2 class="experiment-title" id="reportTitle">${escapeHtml(module.name)}</h2>
          <p class="experiment-theory">${escapeHtml(theory)}</p>
        </section>

        <!-- 3D Snapshot & Setup View -->
        <section class="report-section setup-visual-section">
          <div class="section-tag">Experimental Setup & 3D Apparatus</div>
          <div class="snapshot-frame">
            ${
              imageSrc
                ? `<img class="report-snapshot-img" id="reportSnapshotImg" src="${imageSrc}" alt="3D Experiment Snapshot of ${escapeHtml(module.name)}" />`
                : `<div class="snapshot-placeholder">3D Canvas Setup Captured</div>`
            }
            <div class="snapshot-caption">
              <b>Figure 1:</b> Real-time 3D apparatus state and geometric configuration captured at the moment of measurement.
            </div>
          </div>
        </section>

        <!-- Experimental Parameters Table -->
        <section class="report-section observations-section">
          <div class="section-tag">Experimental Parameters & Recorded Observations</div>
          <table class="report-table">
            <thead>
              <tr>
                <th style="width: 45%;">Parameter / Controlled Variable</th>
                <th style="width: 55%;">Measured / Configured Value</th>
              </tr>
            </thead>
            <tbody>
              ${observations
                .map(
                  (obs) => `
                <tr>
                  <td><b>${escapeHtml(obs.name)}</b></td>
                  <td><code class="val-code">${escapeHtml(obs.value)}</code></td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </section>

        <!-- Observations & Findings Textarea -->
        <section class="report-section findings-section">
          <div class="section-tag">Student Analysis & Conclusion</div>
          <textarea class="report-textarea" id="reportNotes" rows="3" placeholder="Write your hypothesis, observations, and conclusions here...">${escapeHtml(defaultObservationNote)}</textarea>
        </section>

        <!-- Footer / Signatures -->
        <footer class="report-footer">
          <div class="sig-block">
            <div class="sig-line"></div>
            <p>Student's Signature</p>
          </div>
          <div class="stamp-seal">
            <div class="seal-inner">
              <span>SPARKLAB</span>
              <b>VERIFIED</b>
              <small>VIRTUAL LAB</small>
            </div>
          </div>
          <div class="sig-block">
            <div class="sig-line"></div>
            <p>Teacher / Evaluator Signature</p>
          </div>
        </footer>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.classList.add("report-modal-open");
  activeReportOverlay = overlay;

  // Wire actions
  overlay.querySelector("#reportCloseBtn").addEventListener("click", closeLabReportModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeLabReportModal();
  });

  // Print
  overlay.querySelector("#reportPrintBtn").addEventListener("click", () => {
    window.print();
  });

  // Download snapshot
  overlay.querySelector("#reportDownloadPngBtn").addEventListener("click", () => {
    if (imageSrc) {
      downloadDataUrl(imageSrc, `SparkLab-${module.id}-snapshot.png`);
    }
  });

  // Copy text summary
  const copyBtn = overlay.querySelector("#reportCopyBtn");
  copyBtn.addEventListener("click", async () => {
    const sName = overlay.querySelector("#reportStudentName")?.value || studentName;
    const sClass = overlay.querySelector("#reportStudentClass")?.value || gradeTag;
    const notes = overlay.querySelector("#reportNotes")?.value || "";

    const text = [
      `=========================================`,
      `SPARKLAB VIRTUAL STEM LABORATORY REPORT`,
      `Report ID: ${reportId} | Date: ${dateFormatted}`,
      `=========================================`,
      `Student: ${sName} (${sClass})`,
      `Experiment: ${module.name} [${module.subject}]`,
      `Aim: ${theory}`,
      `-----------------------------------------`,
      `RECORDED PARAMETERS:`,
      ...observations.map((o) => `• ${o.name}: ${o.value}`),
      `-----------------------------------------`,
      `CONCLUSION & OBSERVATIONS:`,
      notes,
      `=========================================`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = "✓ Copied!";
      setTimeout(() => (copyBtn.textContent = "📋 Copy Summary"), 2500);
    } catch {
      copyBtn.textContent = "Error copying";
    }
  });

  // Escape key to close
  const onKey = (e) => {
    if (e.key === "Escape") {
      closeLabReportModal();
      window.removeEventListener("keydown", onKey);
    }
  };
  window.addEventListener("keydown", onKey);
}

/**
 * Shows an interactive floating toast over the 3D viewport right after snapshotting.
 */
export function showSnapshotToast({ stageWrap, dataUrl, module, onOpenReport }) {
  if (!stageWrap || !dataUrl) return;

  // Remove existing toast if any
  stageWrap.querySelectorAll(".snapshot-toast").forEach((t) => t.remove());

  const toast = document.createElement("div");
  toast.className = "snapshot-toast";
  toast.innerHTML = `
    <div class="toast-preview">
      <img src="${dataUrl}" alt="Snapshot preview" />
    </div>
    <div class="toast-content">
      <div class="toast-title">📸 3D Snapshot Captured!</div>
      <div class="toast-actions">
        <button class="btn btn-xs primary" id="toastDownloadBtn" type="button">💾 Download PNG</button>
        <button class="btn btn-xs secondary" id="toastReportBtn" type="button">📄 Export Lab Report</button>
      </div>
    </div>
    <button class="toast-dismiss" type="button" aria-label="Dismiss">✕</button>
  `;

  stageWrap.appendChild(toast);

  // Wire download
  toast.querySelector("#toastDownloadBtn").addEventListener("click", () => {
    downloadDataUrl(dataUrl, `SparkLab-${module.id}-snapshot.png`);
    toast.remove();
  });

  // Wire report
  toast.querySelector("#toastReportBtn").addEventListener("click", () => {
    toast.remove();
    onOpenReport?.();
  });

  // Wire dismiss
  toast.querySelector(".toast-dismiss").addEventListener("click", () => toast.remove());

  // Auto dismiss after 8 seconds
  setTimeout(() => {
    if (toast.isConnected) {
      toast.classList.add("toast-fade-out");
      setTimeout(() => toast.remove(), 400);
    }
  }, 8000);
}
